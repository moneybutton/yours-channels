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
  constructor (name,
    source, // the address that the funding transaction is funded from
    multisig, // the shared multisig address
    destination, // the address that the spending transactions spend to
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
    this.fromObject({name,
      source,
      multisig,
      destination,
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
   * Initializes an agent locally. In particular, the source address, the multisig
   * address, the destination address are initialized. The list of commitment txouts
   * is initialized with secrets for the next payment.
   */
  asyncInitialize (sourcePrivKey, multisigPrivKey, destinationPrivKey) {
    return asink(function *() {
      if (!sourcePrivKey || !multisigPrivKey || !destinationPrivKey || sourcePrivKey.constructor.name !== 'PrivKey' || multisigPrivKey.constructor.name !== 'PrivKey' || destinationPrivKey.constructor.name !== 'PrivKey') {
        throw new Error('sourcePrivKey, multisigPrivKey, destinationPrivKey must be PrivKeys and are required in asyncInitialize')
      }

      // the address that's the input to the source trasnaction
      this.source = new KeyPairAddress()
      yield this.source.asyncInitialize(sourcePrivKey)

      // the shared multisig address
      this.multisig = new Multisig()
      yield this.multisig.initializePrivKey(multisigPrivKey)

      // the address that's the output to a commitment trasnaction
      this.destination = new KeyPairAddress()
      yield this.destination.asyncInitialize(destinationPrivKey)

      // initialize first commitmentTxo
      this.commitmentTxos = []
      // yield this.asyncInitializeCommitmentTxo()

      // the wallet
      this.wallet = new Wallet()

      this.initialized = true
    }, this)
  }

  initializeOther (other) {
    this.other = other
  }

  /*
   * Stores the other agents public keys and creats a shared multisig address.
   */
  asyncInitializeMultisig () {
    return asink(function *() {
      if (!this.multisig) {
        throw new Error('multisig must be created before it can be initialized')
      }

      if (!this.other || !this.other.multisig || !this.other.multisig.pubKey) {
        throw new Error('other agent\'s multisig must be created before multisig can be initialized')
      }
      yield this.multisig.asyncInitialize(this.other.multisig.pubKey)
    }, this)
  }

  /*
   * Creates secrets to be used in the next payment and stores them in a
   * commitmentTx object. This object is added to the list of commitmentTxos
   */
  asyncInitializeCommitmentTxo () {
    return asink(function *() {
       // create new secrets to be used in the payment
      let myHtlcSecret = new HtlcSecret()
      yield myHtlcSecret.asyncInitialize()
      let myRevocationSecret = new RevocationSecret()
      yield myRevocationSecret.asyncInitialize()

      // console.log(this.name, 'is pushing commitment tx with htlc secret', myHtlcSecret.hash.toString('hex'))

      // build an commitmentTxo object that only stores secrets at this point
      let myCommitmentTxo = new CommitmentTxo()
      myCommitmentTxo.initializeSecrets(myHtlcSecret, myRevocationSecret)

      this.commitmentTxos.push(myCommitmentTxo)
    }, this)
  }

  initializeOtherCommitmentTxo (otherHtlcSecret, otherRevocationSecret) {
    let otherCommitmentTxo = new CommitmentTxo()
    // console.log(this.name, 'is pushing other commitment tx with htlc secret', otherHtlcSecret.hash.toString('hex'))
    otherCommitmentTxo.initializeSecrets(otherHtlcSecret, otherRevocationSecret)
    this.other.commitmentTxos.push(otherCommitmentTxo)
  }

  /* ---- PROTOCOL ---- */

  /*
   * This is the first point of communication between the two agents. Arguments are
   * the amount to fund the channel with and the public projection of the other agent.
   * Stores the public information about the other agent and initializes the multisig
   * address. The funder of the channel will build the funding transaction and send
   * it's hash to the other party.
   */
  asyncOpenChannel (amount, publicOther) {
    return asink(function *() {
      // initialize information about other agent
      this.initializeOther(publicOther)

      // initialize multisig
      yield this.asyncInitializeMultisig()

      if (this.funder) {
        // the funder will build the source transaction and cache it's hashbuf and txout
        let fee = Bn(20000)
        let output = this.wallet.getUnspentOutput(amount.add(fee), this.source.keyPair.pubKey)

        this.fundingTxo = new FundingTxo()
        this.fundingTxo.asyncInitialize(amount, this.source, this.multisig,
          output.txhashbuf, output.txoutnum, output.txout, output.pubKey)

        // send the source tx hash to the other agent
        this.remoteAgent.setFundingTxo(yield this.fundingTxo.asyncToPublic())
      } else {
        // send your information to the other agent
        yield this.remoteAgent.asyncOpenChannel(amount, yield this.asyncToPublic())

        // TODO sign fundingTx and send back to funder
      }
    }, this)
  }


    logOtherCommitmentTxs () {
      // console.log(this.name, 'logOtherCommitmentTxs');
      /*
      let otherStr = this.name + ' has other commitmentTxos '
      let str = ''
      for(let i = 0; i<this.other.commitmentTxos.length; i++) {
        str += this.commitmentTxos[i].htlcSecret.hash.toString('hex') + ' '
        otherStr += this.other.commitmentTxos[i].htlcSecret.hash.toString('hex') + ' '
      }
      console.log(otherStr + 'and own '+str)
*/
    }

  /*
   * This will build and sign a commitment transaction over the specified amount.
   * The commitment transaction is then sent to the other party to sign and
   * store. Note that both agents have already created fresh secrets.
   */
  asyncSend (amount, amountToOther, otherHtlcSecret, otherRevocationSecret) {
    return asink(function *() {

      // build myCommitmentTxo
      let myCommitmentTxo = new CommitmentTxo()
      let myHtlcSecret = new HtlcSecret()
      yield myHtlcSecret.asyncInitialize()
      let myRevocationSecret = new RevocationSecret()
      yield myRevocationSecret.asyncInitialize()
      myCommitmentTxo.initializeSecrets(myHtlcSecret, myRevocationSecret)
      myCommitmentTxo.initializeOtherSecrets(otherHtlcSecret, otherRevocationSecret)
      this.commitmentTxos.push(myCommitmentTxo)

      // build the commitmentTxo for the other agent
      let otherCommitmentTxo = new CommitmentTxo()
      otherCommitmentTxo.initializeSecrets(
        otherHtlcSecret,
        otherRevocationSecret)
      otherCommitmentTxo.initializeOtherSecrets(
        this.getCommitmentTxo(1).htlcSecret,
        this.getCommitmentTxo(1).revocationSecret)
      yield otherCommitmentTxo.asyncInitialize(
        amount, amountToOther,
        this.fundingTxo, this.multisig,
        this.destination, this.other.destination, this.funder)
      this.other.commitmentTxos.push(otherCommitmentTxo)

      if (!this.sender) {
        // ask the other agent to send you a partially signed commitment transaction
        yield this.remoteAgent.asyncSend(amountToOther, amount, this.getCommitmentTxo(1).htlcSecret.toPublic(), this.getCommitmentTxo(1).revocationSecret.toPublic())
      } else {
        // send your partially signed transaction to other agent
        // this.logOtherCommitmentTxs()
        //yield this.remoteAgent.asyncSendTxb(otherCommitmentTxo.toPublic())
      }
    }, this)
  }

  /*
   * Called by asyncSend during the protocol. Receives the commitmentTx from the other
   * agent, checks it, and stores if the checks pass.
   */
  asyncSendTxb (newCommitmentTxo) {
    return asink(function *() {
      // console.log(this.name, 'asyncSendTxb', this.commitmentTxos.length, this.other.commitmentTxos.length);

      // check the other parties commitment transaction and store it
      // console.log(this.name, 'is checking secrets');
      if (yield this.getCommitmentTxo(2).asyncCheck(newCommitmentTxo, this.fundingTxo, this.multisig)) {
        // store the solutions to the secrets with the transaction
        newCommitmentTxo.revocationSecret = this.getCommitmentTxo(2).revocationSecret
        newCommitmentTxo.htlcSecret = this.getCommitmentTxo(2).htlcSecret
        this.setCommitmentTxo(newCommitmentTxo)
      } else {
        throw new Error('commitmentTxo check failed')
      }

      if (!this.sender) {
        // send your partially signed commitment transaction to the other party
        // this.logOtherCommitmentTxs()
        yield this.remoteAgent.asyncSendTxb(this.getOtherCommitmentTxo(1).toPublic())
      } else {
        // prepare the next payment
        let oldRevocationSecret = this.getCommitmentTxo(3) ?
          this.getCommitmentTxo(3).revocationSecret :
          null
        console.log(this.name, 'is sending secret', this.getCommitmentTxo(1).htlcSecret.hash.toString('hex'), 1);
        yield this.remoteAgent.asyncPrepareNextPayment(oldRevocationSecret,
          this.getCommitmentTxo(1).htlcSecret.toPublic(),
          this.getCommitmentTxo(1).revocationSecret.toPublic())

      }
    }, this)
  }

  /*
   * Prepares the agent for the next payment. This involves storing the revocation
   * secret from the other agent, and creates new secrets for the next payment.
   */
  asyncPrepareNextPayment (otherOldRevocationSecret, otherHtlcSecret, otherRevocationSecret) {
    return asink(function *() {

      // store the other agents secrets for the next payment
      this.initializeOtherCommitmentTxo(otherHtlcSecret, otherRevocationSecret)

      // check the if the last transaction was correctly revoked
      if (otherOldRevocationSecret) {
        if (yield this.getOtherCommitmentTxo(2).revocationSecret.asyncCheck(otherOldRevocationSecret)) {
          //this.other.commitmentTxos[this.other.commitmentTxos.length - 2].revocationSecret = revocationSecret
          console.log('check passed');
        } else {
          //throw new Error('revocation secret check failed')
          console.log('check failed');
        }
      }


      // console.log('alksdlaskdnalksdn', this.name, this.sender);

      if (!this.sender) {
        // prepare the next payment
        let oldRevocationSecret = this.getCommitmentTxo(3) ?
          this.getCommitmentTxo(3).revocationSecret : null
        console.log(this.name, 'is sending secret', this.getCommitmentTxo(1).htlcSecret.hash.toString('hex'), 2);
        yield this.remoteAgent.asyncPrepareNextPayment(oldRevocationSecret,
          this.getCommitmentTxo(1).htlcSecret.toPublic(),
          this.getCommitmentTxo(1).revocationSecret.toPublic())
      }

this.logOtherCommitmentTxs()

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

  /*
   * get the n-th last commitmentTxo
   */
  getCommitmentTxo (n) {
    if(this.commitmentTxos.length >= n) {
      return this.commitmentTxos[this.commitmentTxos.length - n]
    } else {
      return null
    }
  }

  /*
   * get the other agents n-th last commitmentTxo
   */
  getOtherCommitmentTxo (n) {
    if(this.other.commitmentTxos.length >= n) {
      return this.other.commitmentTxos[this.other.commitmentTxos.length - n]
    } else {
      return null
    }
  }

  getRevocationSecret () {
    // if there is a transaction to revoke, return it's revocation secret
    if (this.commitmentTxos.length > 1) {
      return this.commitmentTxos[this.commitmentTxos.length - 2].revocationSecret
    } else {
      return false
    }
  }

  /* ---- HELPERS ---- */

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
    if (json.source) {
      this.source = new KeyPairAddress().fromJSON(json.source)
    }
    if (json.multisig) {
      this.multisig = new Multisig().fromJSON(json.multisig)
    }
    if (json.destination) {
      this.destination = new KeyPairAddress().fromJSON(json.destination)
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
      if (this.name) {
        agent.name = this.name
      }
      if (this.source) {
        agent.source = this.source.toPublic()
      }
      if (this.multisig) {
        agent.multisig = this.multisig.toPublic()
      }
      if (this.destination) {
        agent.destination = this.destination.toPublic()
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
