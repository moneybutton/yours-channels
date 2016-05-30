'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let Multisig = require('./addrs/multisig.js')
let KeyPairAddress = require('./addrs/key-pair-address.js')
let Secret = require('./scrts/secret.js')
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

  /* ---- initialization ---- */

  /*
   * Initializes an agent locally. In particular, the source address, the multisig
   * address, the destination address are initialized. The list of commitment txouts
   * is initialized with secrets for the next payment.
   */
  asyncInitialize (sourcePrivKey, multisigPrivKey, destinationPrivKey) {
    return asink(function *() {
      if (!sourcePrivKey || !multisigPrivKey || !destinationPrivKey || sourcePrivKey.constructor.name !== 'PrivKey' || multisigPrivKey.constructor.name !== 'PrivKey' || destinationPrivKey.constructor.name !== 'PrivKey') {
        throw new Error('privKey and msPrivKey must be PrivKeys and are required in asyncInitialize')
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
      yield this.asyncInitializeCommitmentTxo()

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
      let myHtlcSecret = new Secret()
      yield myHtlcSecret.asyncInitialize()
      let myRevocationSecret = new Secret()
      yield myRevocationSecret.asyncInitialize()

      // build an commitmentTxo object that only stores secrets at this point
      let myCommitmentTxo = new CommitmentTxo()
      myCommitmentTxo.initializeSecrets(myHtlcSecret, myRevocationSecret)

      this.commitmentTxos.push(myCommitmentTxo)
    }, this)
  }

  initializeOtherCommitmentTxo (otherHtlcSecret, otherRevocationSecret) {
    let otherCommitmentTxo = new CommitmentTxo()
    otherCommitmentTxo.initializeSecrets(otherHtlcSecret, otherRevocationSecret)
    this.other.commitmentTxos.push(otherCommitmentTxo)
  }

  /* ---- protocol ---- */

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
        // the funder will build the source transaction and cache it's hashbuf
        // and txout
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

  /*
   * This will build and sign a commitment transaction over the specified amount.
   * The commitment transaction is then sent to the other party to sign and
   * store. Note that both agents have already created fresh secrets.
   */
  asyncSend (amount, amountToOther) {
    return asink(function *() {
      // build the commitment tx for the other agent
      this.getOtherCommitmentTxo().initializeOtherSecrets(this.getCommitmentTxo().htlcSecret, this.getCommitmentTxo().revocationSecret)
      yield this.getOtherCommitmentTxo().asyncInitialize(amount, amountToOther,
        this.fundingTxo, this.multisig,
        this.destination, this.other.destination, this.funder)

      if (!this.sender) {
        // ask the other agent to send you a partially signed commitment transaction
        yield this.remoteAgent.asyncSend(amountToOther, amount,
          this.getCommitmentTxo().revocationSecret.toPublic(),
          this.getCommitmentTxo().htlcSecret.toPublic())
      } else {
        // send your partially signed transaction to other agent
        yield this.remoteAgent.asyncSendTxb(this.getOtherCommitmentTxo().toPublic())
      }
    }, this)
  }

  /*
   * Called by asyncSend during the protocol. Receives the commitmentTx from the other
   * agent, checks it, and stores if the checks pass.
   */
  asyncSendTxb (newCommitmentTxo) {
    return asink(function *() {
      // check the other parties commitment transaction and store it
      if (yield this.getCommitmentTxo().asyncCheck(newCommitmentTxo, this.fundingTxo, this.multisig)) {
        // store the solutions to the secrets with the transaction
        newCommitmentTxo.revocationSecret = this.getCommitmentTxo().revocationSecret
        newCommitmentTxo.htlcSecret = this.getCommitmentTxo().htlcSecret
        this.setCommitmentTxo(newCommitmentTxo)
      } else {
        throw new Error('commitmentTxo check failed')
      }

      if (!this.sender) {
        // send your partially signed commitment transaction to the other party
        yield this.remoteAgent.asyncSendTxb(this.getOtherCommitmentTxo().toPublic())
      } else {
        // prepare the next payment
        yield this.asyncInitializeCommitmentTxo()
        yield this.remoteAgent.asyncPrepareNextPayment(this.getRevocationSecret(),
          this.getCommitmentTxo().htlcSecret.toPublic(), this.getCommitmentTxo().revocationSecret.toPublic())
      }
    }, this)
  }

  /*
   * Prepares the agent for the next payment. This involves storing the revocation
   * secret from the other agent, and creates new secrets for the next payment.
   */
  asyncPrepareNextPayment (revocationSecret, otherHtlcSecret, otherRevocationSecret) {
    return asink(function *() {
/*
      if (revocationSecret) {
        if (yield this.checkRevocationSecret(revocationSecret)) {
          this.other.commitmentTxos[this.other.commitmentTxos.length - 2].revocationSecret = revocationSecret
        } else {
          throw new Error('revocation secret check failed')
        }
      }
*/
      this.initializeOtherCommitmentTxo(otherHtlcSecret, otherRevocationSecret)

      if (!this.sender) {
        // prepare the next payment
        yield this.asyncInitializeCommitmentTxo()
        yield this.remoteAgent.asyncPrepareNextPayment(this.getRevocationSecret(),
          this.getCommitmentTxo().htlcSecret.toPublic(), this.getCommitmentTxo().revocationSecret.toPublic())
      }
    }, this)
  }

  /* ---- setters ---- */

  setFundingTxo (txo) {
    this.fundingTxo = txo
  }

  setCommitmentTxo (txo) {
    this.commitmentTxos[this.commitmentTxos.length - 1] = txo
  }

  setOtherCommitmentTxo (txo) {
    this.other.commitmentTxos[this.other.commitmentTxos.length - 1] = txo
  }

  /* ---- getters ---- */

  getCommitmentTxo () {
    return this.commitmentTxos[this.commitmentTxos.length - 1]
  }

  getOtherCommitmentTxo () {
    return this.other.commitmentTxos[this.other.commitmentTxos.length - 1]
  }

  getRevocationSecret () {
    // if there is a transaction to revoke, return it's revocation secret
    if (this.commitmentTxos.length > 1) {
      return this.commitmentTxos[this.commitmentTxos.length - 2].revocationSecret
    } else {
      return false
    }
  }

  /* ---- checks ---- */

  /*
   * Checks that a revocation secret solution obtained by the other party
   * is an actual solution and stores if so
   */
  checkRevocationSecret (secret) {
    return asink(function *() {
      // check that the provided solution validates
      if (!(yield secret.asyncCheck())) {
        throw new Error('Provided secret does not validate')
      }

      // check that the provided solution matches the stored secret
      let storedRevocationSecret = this.other.commitmentTxos[this.other.commitmentTxos.length - 2].revocationSecret
      if (!secret.hash || secret.hash.toString('hex') !== storedRevocationSecret.hash.toString('hex')) {
        throw new Error('Provided secret does not match local secret')
      }
      return true
    }, this)
  }

  /* ---- helpers ---- */

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
      this.htlcSecret = new Secret().fromJSON(json.htlcSecret)
    }
    if (json.nextRevocationSecret) {
      this.nextRevocationSecret = new Secret().fromJSON(json.nextRevocationSecret)
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

  /* ---- static methods ---- */

  /*
   * Computes the sum of unspent outputs of a transaction that go to a given address.
   */
/*
  static amountSpentToAddress (tx, address) {
    let amount = Bn(0)
    tx.txouts.forEach((el, index) => {
      if (el.script.isScripthashOut()) {
        let scriptbuf = el.script.chunks[1].buf
        let addressbuf = address.hashbuf
        if (!Buffer.compare(scriptbuf, addressbuf)) {
          amount = amount.add(Bn(el.valueBn.toString()))
        }
      } else if (el.script.isPubKeyhashOut()) {
        let scriptbuf = el.script.chunks[2].buf
        let addressbuf = address.hashbuf
        if (!Buffer.compare(scriptbuf, addressbuf)) {
          amount = amount.add(Bn(el.valueBn.toString()))
        }
      }
    })
    return amount
  }
*/
}
module.exports = Agent
