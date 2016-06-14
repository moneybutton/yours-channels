'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let Multisig = require('./addrs/multisig')
let KeyPairAddress = require('./addrs/key-pair-address')
let HtlcSecret = require('./scrts/htlc-secret')
let RevocationSecret = require('./scrts/revocation-secret')
let FundingTxObj = require('./txs/funding-tx-obj')
let CommitmentTxObj = require('./txs/commitment-tx-obj')
let Wallet = require('./wallet')

class Agent extends Struct {
  constructor (id,
    sourceAddress, // the address that the funding transaction is funded from
    multisigAddress, // the shared multisigAddress address
    destinationAddress, // the address that the spending transactions spend to
    fundingTxObj, // an object storing information about the funding tx
    commitmentTxObjs, // a list of objects storing information about previous commitment txs
    wallet, // the wallet (dummy for now)
    initialized, // boolean, set to true once local initialization is complete
    funder, // boolean, set to true if agent funds the channel
    sender, // boolean, set to true if agent has sent the last payment
    other, // public information about the other agent and all commitment txs that he stores
    remoteAgent // used temporarily to communicate with the other agent (will go away once we integrate msgs)
  ) {
    super()
    this.fromObject({id,
      sourceAddress,
      multisigAddress,
      destinationAddress,
      fundingTxObj,
      commitmentTxObjs,
      wallet,
      initialized,
      funder,
      sender,
      other,
      remoteAgent
    })
  }

  /* ---- INITIALIZATION ---- */

  /*
   * Initializes an agent locally. In particular, the sourceAddress address, the multisigAddress
   * address, the destinationAddress address are initialized. The list of commitment txouts
   * is initialized with secrets for the next payment.
   */
  asyncInitialize (sourcePrivKey, multisigPrivKey, destinationPrivKey) {
    return asink(function * () {
      if (!sourcePrivKey || !multisigPrivKey || !destinationPrivKey || sourcePrivKey.constructor.name !== 'PrivKey' || multisigPrivKey.constructor.name !== 'PrivKey' || destinationPrivKey.constructor.name !== 'PrivKey') {
        throw new Error('sourcePrivKey, multisigPrivKey, destinationPrivKey must be PrivKeys and are required in asyncInitialize')
      }

      // the address that's the input to the sourceAddress trasnaction
      this.sourceAddress = new KeyPairAddress()
      yield this.sourceAddress.asyncInitialize(sourcePrivKey)

      // the shared multisigAddress address
      this.multisigAddress = new Multisig()
      yield this.multisigAddress.initializePrivKey(multisigPrivKey)

      // the address that's the output to a commitment trasnaction
      this.destinationAddress = new KeyPairAddress()
      yield this.destinationAddress.asyncInitialize(destinationPrivKey)

      // initialize first commitmentTxObj
      this.commitmentTxObjs = []
      // yield this.asyncInitializeCommitmentTxObj()

      // the wallet
      this.wallet = new Wallet()

      this.initialized = true
    }, this)
  }

  /* ---- PROTOCOL ---- */

  /*
   * This is the first point of communication between the two agents. Arguments are
   * the amount to fund the channel with and the public projection of the other agent.
   * Stores the public information about the other agent and initializes the multisigAddress
   * address. The funder of the channel will build the funding transaction and send
   * it's hash to the other party.
   */
  asyncOpenChannel (amount, publicOther) {
    return asink(function * () {
      // initialize information about other agent
      this.other = publicOther

      // initialize multisigAddress
      yield this.multisigAddress.asyncInitialize(this.other.multisigAddress.pubKey)

      if (!this.funder) {
        // send your information to the other agent
        // TODO sign fundingTx and send back to funder
        yield this.remoteAgent.asyncOpenChannel(amount, yield this.asyncToPublic())
      } else {
        // the funder will build the sourceAddress transaction and cache it's hashbuf and txout
        let fee = Bn(20000)
        let output = this.wallet.getUnspentOutput(amount.add(fee), this.sourceAddress.keyPair.pubKey)

        this.fundingTxObj = new FundingTxObj()
        this.fundingTxObj.asyncInitialize(amount, this.sourceAddress, this.multisigAddress,
          output.txhashbuf, output.txoutnum, output.txout, output.pubKey)

        // send the sourceAddress tx hash to the other agent
        this.remoteAgent.setFundingTxObj(yield this.fundingTxObj.asyncToPublic())
      }
    }, this)
  }

  asyncSendOutputList (outputList, changeOutput) {
    return asink(function * () {
      if (!this.multisigAddress || !this.fundingTxObj) {
        throw new Error('Agent not sufficiently initialized in asyncSendOutputList')
      }

      // create new commitmentTxObj and add all info that is not realted to builder vs owner
      let commitmentTxObj = new CommitmentTxObj()
      commitmentTxObj.revocationSecret = new RevocationSecret()
      yield commitmentTxObj.revocationSecret.asyncInitialize()
      commitmentTxObj.multisigAddress = this.multisigAddress
      commitmentTxObj.fundingTxObj = this.fundingTxObj
      commitmentTxObj.outputList = outputList.map((output) => this.completeOutput(output, commitmentTxObj.revocationSecret))
      commitmentTxObj.changeOutput = this.completeOutput(changeOutput, commitmentTxObj.revocationSecret)
      this.commitmentTxObjs.push(commitmentTxObj)
      this.other.commitmentTxObjs.push(commitmentTxObj)

      if (!this.sender) {
        yield this.remoteAgent.asyncSendOutputList(outputList, changeOutput)
      } else {
        yield this.remoteAgent.asyncBuildCommitmentTxObj()
      }
    }, this)
  }

  asyncBuildCommitmentTxObj () {
    return asink(function * () {
      let otherCommitmentTxObj = this.other.commitmentTxObjs.pop()
      otherCommitmentTxObj.builderId = this.id
      otherCommitmentTxObj.builderDestinationAddress = this.destinationAddress
      otherCommitmentTxObj.ownerId = this.other.id
      otherCommitmentTxObj.ownerDestinationAddress = this.other.destinationAddress
      yield otherCommitmentTxObj.asyncBuild()
      this.other.commitmentTxObjs.push(otherCommitmentTxObj)

      if (!this.sender) {
        yield this.remoteAgent.asyncBuildCommitmentTxObj()
      } else {
        yield this.remoteAgent.sendCommitmentTxObj(otherCommitmentTxObj)
      }
    }, this)
  }

  sendCommitmentTxObj (newCommitmentTxObj) {
    return asink(function * () {
      let storedCommitmentTxObj = this.commitmentTxObjs[this.commitmentTxObjs.length - 1]
      if (this.checkCommitmentTxObj(storedCommitmentTxObj, newCommitmentTxObj)) {
        yield newCommitmentTxObj.txb.asyncSign(0, this.multisigAddress.keyPair, this.fundingTxObj.txb.tx.txOuts[0])

        this.commitmentTxObjs.pop()
        this.commitmentTxObjs.push(newCommitmentTxObj)
      }

      if (!this.sender) {
        let otherCommitmentTxObj = this.other.commitmentTxObjs[this.other.commitmentTxObjs.length - 1]
        yield this.remoteAgent.sendCommitmentTxObj(otherCommitmentTxObj)
      } else {
        let revocationSecret = this.getRevocationSecret()
        if (revocationSecret) {
          yield this.remoteAgent.sendRevocationSecret(revocationSecret)
        }
      }
    }, this)
  }

  sendRevocationSecret (revocationSecret) {
    return asink(function * () {
      // TODO
    }, this)
  }

  /* ---- SETTERS ---- */

  setFundingTxObj (txo) {
    this.fundingTxObj = txo
  }

  setCommitmentTxObj (txo) {
    this.commitmentTxObjs[this.commitmentTxObjs.length - 1] = txo
  }

  setOtherCommitmentTxObj (txo) {
    this.other.commitmentTxObjs[this.other.commitmentTxObjs.length - 1] = txo
  }

  /* ---- GETTERS ---- */

  getRevocationSecret () {
    // if there is a transaction to revoke, return it's revocation secret
    if (this.commitmentTxObjs.length > 1) {
      return this.commitmentTxObjs[this.commitmentTxObjs.length - 2].revocationSecret
    } else {
      return false
    }
  }

  /* ---- HELPERS ---- */

  completeOutput (output, revocationSecret) {
    if (output.intermediateDestId === this.id) {
      output.revocationSecret = revocationSecret
    }
    return output
  }

  checkCommitmentTxObj (storedCommitmentTxObj, newCommitmentTxObj) {
    // TODO
    return true
  }

  // We have to delete other and remoteAgent and restore after constructing json.
  // Ideallt we'd call super.toJSON after that, but that's not possible due to
  // some stupid error (TODO)
  toJSON () {
    let other = this.other
    let remoteAgent = this.remoteAgent
    let that = this
    that.other = undefined
    that.remoteAgent = undefined
    var json = {}
    for (var val in this) {
      if (this[val] instanceof Array) {
        let arr = []
        for (var i in this[val]) {
          arr.push(this[val][i].toJSON())
        }
        json[val] = arr
      } else if (typeof this[val] === 'object') {
        json[val] = this[val].toJSON()
      } else if (typeof this[val] !== 'undefined') {
        json[val] = this[val]
      }
    }
    this.other = other
    this.remoteAgent = remoteAgent
    return json
  }

  fromJSON (json) {
    this.name = json.name
    this.sourceAddress = json.sourceAddress ? new KeyPairAddress().fromJSON(json.sourceAddress) : undefined
    this.multisigAddress = json.multisigAddress ? new Multisig().fromJSON(json.multisigAddress) : undefined
    this.destinationAddress = json.destinationAddress ? new KeyPairAddress().fromJSON(json.destinationAddress) : undefined
    this.htlcSecret = json.htlcSecret ? new HtlcSecret().fromJSON(json.htlcSecret) : undefined
    this.nextRevocationSecret = json.nextRevocationSecret ? new RevocationSecret().fromJSON(json.nextRevocationSecret) : undefined
    this.funder = json.funder
    this.wallet = json.wallet ? new Wallet().fromJSON(json.wallet) : undefined
    this.initialized = json.initialized
    this.sender = json.sender
    this.fundingTxObj = json.fundingTxObj ? new FundingTxObj().fromJSON(json.fundingTxObj) : undefined
    if (json.commitmentTxObjs) {
      let commitmentTxObjs = []
      json.commitmentTxObjs.forEach(function (tx) {
        commitmentTxObjs.push(new CommitmentTxObj().fromJSON(tx))
      })
      this.commitmentTxObjs = commitmentTxObjs
    }
    return this
  }

  asyncToPublic () {
    return asink(function * () {
      let agent = new Agent()
      agent.id = this.id
      agent.sourceAddress = this.sourceAddress ? this.sourceAddress.toPublic() : undefined
      agent.multisigAddress = this.multisigAddress ? this.multisigAddress.toPublic() : undefined
      agent.destinationAddress = this.destinationAddress ? this.destinationAddress.toPublic() : undefined
      agent.fundingTxObj = this.fundingTxObj ? yield this.fundingTxObj.asyncToPublic() : undefined
      if (this.commitmentTxObjs) {
        let commitmentTxObjs = []
        this.commitmentTxObjs.forEach(function (txo) {
          commitmentTxObjs.push(txo.toPublic())
        })
        agent.commitmentTxObjs = commitmentTxObjs
      }
      agent.wallet = this.wallet ? this.wallet.toPublic() : undefined
      agent.initialized = this.initialized
      agent.funder = this.funder
      agent.sender = this.sender
      return agent
    }, this)
  }
}

module.exports = Agent
