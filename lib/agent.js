'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let Multisig = require('./addrs/multisig.js')
let KeyPairAddress = require('./addrs/key-pair-address.js')
let HtlcSecret = require('./scrts/htlc-secret.js')
let RevocationSecret = require('./scrts/revocation-secret.js')
let FundingTxo = require('./txs/funding-txo.js')
let CommitmentTxo = require('./txs/commitment-txo.js')
let Wallet = require('./wallet.js')

class Agent extends Struct {
  constructor (id,
    sourceAddress, // the address that the funding transaction is funded from
    multisigAddress, // the shared multisigAddress address
    destinationAddress, // the address that the spending transactions spend to
    fundingTxo, // an object storing information about the funding tx
    commitmentTxos, // a list of objects storing information about previous commitment txs
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
      fundingTxo,
      commitmentTxos,
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
    return asink(function *() {
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

      // initialize first commitmentTxo
      this.commitmentTxos = []
      // yield this.asyncInitializeCommitmentTxo()

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
    return asink(function *() {
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

        this.fundingTxo = new FundingTxo()
        this.fundingTxo.asyncInitialize(amount, this.sourceAddress, this.multisigAddress,
          output.txhashbuf, output.txoutnum, output.txout, output.pubKey)

        // send the sourceAddress tx hash to the other agent
        this.remoteAgent.setFundingTxo(yield this.fundingTxo.asyncToPublic())
      }
    }, this)
  }

  asyncSendOutputList (outputList, changeOutput) {
    return asink(function *() {
      if (!this.multisigAddress || !this.fundingTxo) {
        throw new Error('Agent not sufficiently initialized in asyncSendOutputList')
      }

      // create new commitmentTxo and add all info that is not realted to builder vs owner
      let commitmentTxo = new CommitmentTxo()
      commitmentTxo.revocationSecret = new RevocationSecret()
      yield commitmentTxo.revocationSecret.asyncInitialize()
      commitmentTxo.multisigAddress = this.multisigAddress
      commitmentTxo.fundingTxo = this.fundingTxo
      commitmentTxo.outputList = outputList.map((output) => this.completeOutput(output, commitmentTxo.revocationSecret))
      commitmentTxo.changeOutput = this.completeOutput(changeOutput, commitmentTxo.revocationSecret)
      this.commitmentTxos.push(commitmentTxo)
      this.other.commitmentTxos.push(commitmentTxo)

      if (!this.sender) {
        yield this.remoteAgent.asyncSendOutputList(outputList, changeOutput)
      } else {
        yield this.remoteAgent.asyncBuildCommitmentTxo()
      }
    }, this)
  }

  asyncBuildCommitmentTxo () {
    return asink(function *() {
      let otherCommitmentTxo = this.other.commitmentTxos.pop()
      otherCommitmentTxo.builderId = this.id
      otherCommitmentTxo.builderDestinationAddress = this.destinationAddress
      otherCommitmentTxo.ownerId = this.other.id
      otherCommitmentTxo.ownerDesitinationAddress = this.other.destinationAddress
      yield otherCommitmentTxo.asyncBuild()
      this.other.commitmentTxos.push(otherCommitmentTxo)

      if (!this.sender) {
        yield this.remoteAgent.asyncBuildCommitmentTxo()
      } else {
        yield this.remoteAgent.sendCommitmentTxo(otherCommitmentTxo)
      }
    }, this)
  }

  sendCommitmentTxo (newCommitmentTxo) {
    return asink(function *() {
      let storedCommitmentTxo = this.commitmentTxos[this.commitmentTxos.length - 1]
      if (this.checkCommitmentTxo(storedCommitmentTxo, newCommitmentTxo)) {
        this.commitmentTxos.pop()
        this.commitmentTxos.push(newCommitmentTxo)
      }

      if (!this.sender) {
        let otherCommitmentTxo = this.other.commitmentTxos[this.other.commitmentTxos.length - 1]
        yield this.remoteAgent.sendCommitmentTxo(otherCommitmentTxo)
      } else {
        let revocationSecret = this.getRevocationSecret()
        if (revocationSecret) {
          yield this.remoteAgent.sendRevocationSecret(revocationSecret)
        }
      }
    }, this)
  }

  sendRevocationSecret (revocationSecret) {
    return asink(function *() {
      // TODO
    }, this)
  }

  /* ---- SETTERS ---- */

  setFundingTxo (txo) {
    this.fundingTxo = txo
  }

  setCommitmentTxo (txo) {
    this.commitmentTxos[this.commitmentTxos.length - 1] = txo
  }

  setOtherCommitmentTxo (txo) {
    this.other.commitmentTxos[this.other.commitmentTxos.length - 1] = txo
  }

  /* ---- GETTERS ---- */

  getRevocationSecret () {
    // if there is a transaction to revoke, return it's revocation secret
    if (this.commitmentTxos.length > 1) {
      return this.commitmentTxos[this.commitmentTxos.length - 2].revocationSecret
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

  checkCommitmentTxo (storedCommitmentTxo, newCommitmentTxo) {
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
    if (json.name) {
      this.name = json.name
    }
    if (json.sourceAddress) {
      this.sourceAddress = new KeyPairAddress().fromJSON(json.sourceAddress)
    }
    if (json.multisigAddress) {
      this.multisigAddress = new Multisig().fromJSON(json.multisigAddress)
    }
    if (json.destinationAddress) {
      this.destinationAddress = new KeyPairAddress().fromJSON(json.destinationAddress)
    }
    if (json.htlcSecret) {
      this.htlcSecret = new HtlcSecret().fromJSON(json.htlcSecret)
    }
    if (json.nextRevocationSecret) {
      this.nextRevocationSecret = new RevocationSecret().fromJSON(json.nextRevocationSecret)
    }
    if (typeof json.funder !== undefined) {
      this.funder = json.funder
    }
    if (json.wallet) {
      this.wallet = new Wallet().fromJSON(json.wallet)
    }
    if (typeof json.initialized !== undefined) {
      this.initialized = json.initialized
    }
    if (typeof json.sender !== undefined) {
      this.sender = json.sender
    }
    if (json.fundingTxo) {
      this.fundingTxo = new FundingTxo().fromJSON(json.fundingTxo)
    }
    if (json.commitmentTxos) {
      let commitmentTxos = []
      json.commitmentTxos.forEach(function (tx) {
        commitmentTxos.push(new CommitmentTxo().fromJSON(tx))
      })
      this.commitmentTxos = commitmentTxos
    }
    return this
  }

  asyncToPublic () {
    return asink(function *() {
      let agent = new Agent().fromObject()
      if (this.id) {
        agent.id = this.id
      }
      if (this.sourceAddress) {
        agent.sourceAddress = this.sourceAddress.toPublic()
      }
      if (this.multisigAddress) {
        agent.multisigAddress = this.multisigAddress.toPublic()
      }
      if (this.destinationAddress) {
        agent.destinationAddress = this.destinationAddress.toPublic()
      }
      if (this.fundingTxo) {
        agent.fundingTxo = yield this.fundingTxo.asyncToPublic()
      }
      if (this.commitmentTxos) {
        let commitmentTxos = []
        this.commitmentTxos.forEach(function (txo) {
          commitmentTxos.push(txo.toPublic())
        })
        agent.commitmentTxos = commitmentTxos
      }
      if (this.wallet) {
        agent.wallet = this.wallet.toPublic()
      }
      if (typeof this.initialized !== 'undefined') {
        agent.initialized = this.initialized
      }
      if (typeof this.funder !== 'undefined') {
        agent.funder = this.funder
      }
      if (typeof this.sender !== 'undefined') {
        agent.sender = this.sender
      }
      return agent
    }, this)
  }
}

module.exports = Agent
