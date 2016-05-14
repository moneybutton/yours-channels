'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let Bn = require('yours-bitcoin/lib/bn')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let TxOutMap = require('yours-bitcoin/lib/tx-out-map')

let Multisig = require('./multisig.js')
let Secret = require('./secret.js')
let Wallet = require('./wallet.js')
let CnlTxBuilder = require('./cnl-tx-builder.js')

class Agent extends Struct {
  constructor (name, // name of the agent
              funding, // information about to input of the funding transaction
              spending, // information about to output of the commitment transaction
              multisig,  // information about to input of multisig address
              htlcSecret,  // the most recent htlc secret
              revocationSecret, // the most recent revocation secret
              commitmentTxb, // the most recent commitmentTxb
              wallet, // the wallet (dummy for now)
              initialized, // true if agent is initialized
              remoteAgent, // temporarily used to similate a communication channel with the other agent (will go away)
              other, // information about the other agent
              funder, // true if the agent is fundign the channel
              sender, // true if the agent has sent the last transaction
              amountFunded, // the amount that the channel was funded with
              htlcOutNum, // output number of the htlc script in commitmentTxb
              rhtlcOutNum // output number of the rhtlc script in commitmentTxb
            ) {
    super()
    this.fromObject({name,
                    funding,
                    spending,
                    multisig,
                    htlcSecret,
                    revocationSecret,
                    commitmentTxb,
                    wallet,
                    initialized,
                    remoteAgent,
                    other,
                    funder,
                    sender,
                    amountFunded,
                    htlcOutNum,
                    rhtlcOutNum}
              )
  }

  /* ---- initialization ---- */

  asyncInitialize (fundingPrivKey, multisigPrivKey, spendingPrivKey) {
    return asink(function *() {
      if (!fundingPrivKey || !multisigPrivKey || !spendingPrivKey || fundingPrivKey.constructor.name !== 'PrivKey' || multisigPrivKey.constructor.name !== 'PrivKey' || spendingPrivKey.constructor.name !== 'PrivKey') {
        throw new Error('privKey and msPrivKey must be PrivKeys and are required in asyncInitialize')
      }

      // the address that's the input to the funding trasnaction
      this.funding = {}
      this.funding.keyPair = yield KeyPair.asyncFromPrivKey(fundingPrivKey)
      this.funding.address = yield Address.asyncFromPubKey(this.funding.keyPair.pubKey)

      // the shared multisig address
      this.multisig = new Multisig(multisigPrivKey)
      this.multisig.pubKey = yield PubKey.asyncFromPrivKey(this.multisig.privKey)

      // the address that's the output to a commitment trasnaction
      this.spending = {}
      this.spending.keyPair = yield KeyPair.asyncFromPrivKey(spendingPrivKey)
      this.spending.address = yield Address.asyncFromPubKey(this.funding.keyPair.pubKey)

      // generate htlc secret
      this.htlcSecret = new Secret()
      this.htlcSecret.generateBuf()
      yield this.htlcSecret.asyncGenerateHash()

      // the wallet
      this.wallet = new Wallet()

      this.initialized = true
    }, this)
  }

  asyncInitializeOther (otherPubKey, otherMsPubKey, otherHtlcSecret) {
    return asink(function *() {
      if (!otherPubKey || !otherMsPubKey || otherPubKey.constructor.name !== 'PubKey' || otherMsPubKey.constructor.name !== 'PubKey') {
        throw new Error('otherPubKey and otherMsPubKey must be pubKeys and are required in asyncInitializeOther')
      }
      if (!otherHtlcSecret || otherHtlcSecret.constructor.name !== 'Secret' || otherHtlcSecret.buf) {
        throw new Error('otherHtlcSecret must be a hidden secret in asyncInitializeOther')
      }

      // otherHtlcSecret

      this.other = {}
      this.other.revocationSecrets = []
      this.other.htlcSecret = otherHtlcSecret
      this.other.pubKey = otherPubKey
      this.other.address = Address.fromPubKey(this.other.pubKey)  // TODO make async

      this.other.msPubKey = otherMsPubKey

      this.other.initialized = true
    }, this)
  }

  /*
   * Stores the other agents public keys and creats a shared multisig address.
   */
  asyncInitializeMultisig () {
    return asink(function *() {
      if (!this.initialized) {
        throw new Error('agent must be initialized before multisig can be built')
      }
      if (!this.other || !this.other.initialized) {
        throw new Error('other agent must be initialized before multisig can be built')
      }
      yield this.multisig.asyncInitialize(this.other.msPubKey)
    }, this)
  }

  /*
   * Agent generates a secret a htlc secret and and revocation secret.
   */
  asyncInitializeRevocationSecret () {
    return asink(function *() {
      this.revocationSecret = new Secret()
      this.revocationSecret.generateBuf()
      yield this.revocationSecret.asyncGenerateHash()
    }, this)
  }

  /* ---- setters ---- */

  /*
   * Store a funding transaction that the agent himself has created.that the agent himself has created
   */
  asyncSetFundingTx (txb, amount) {
    return asink(function *() {
      this.funding.txb = txb
      this.funding.txb.tx.hashbuf = yield this.funding.txb.tx.asyncHash()
      this.amountFunded = amount
    }, this)
  }

  /*
   * Store the hash of the funding transaction that the other agent created.
   */
  setFundingTxHash (amount, fundingTxhashbuf, fundingTxouts) {
    this.funding.txb = {}
    this.funding.txb.tx = {}
    this.funding.txb.tx.hashbuf = fundingTxhashbuf
    this.funding.txb.tx.txOuts = fundingTxouts
    this.funding.txb.tx.hash = () => this.funding.txb.tx.hashbuf

    // TODO check the blockchain to see if the amount is correct
    this.amountFunded = amount
  }

  /*
   * Store a commitment transaction object that the agent himself has created.
   */
  setCommitmentTxo (obj) {
    this.commitmentTxb = obj.txb
    this.htlcOutNum = obj.htlcOutNum
    this.rhtlcOutNum = obj.rhtlcOutNum
  }

  /*
   * Checks if a commitment trasnaction obtained from the other agent is built
   * and signed correctly. If so, sign and stores it.
   */
  asyncSetOtherCommitmentTx (txb) {
    return asink(function *() {
      let commitmentTxb = yield txb.asyncSign(0, this.multisig.keyPair, this.funding.txb.tx.txOuts[0])

      // check that the commitment transaction spends from the funding transaction
      let fundingTxHash = this.funding.txb.tx.hashbuf.toString('hex')
      let commitmentTxInputHash = commitmentTxb.tx.txIns[0].txHashBuf.toString('hex')
      if (fundingTxHash !== commitmentTxInputHash) {
        throw new Error('Commitment transaction does not spend from funding transaction')
      }

      // check that there is only one input
      if (commitmentTxb.tx.txIns.length !== 1) {
        throw new Error('Commitment transaction can only have one input')
      }

      // check that txOutNum == 0
      if (commitmentTxb.tx.txIns[0].txOutNum !== 0) {
        throw new Error('Commitment transaction spends from non-existing output')
      }

      // check that the commitment transaction spends from the funding transaction
      let txOutMap = new TxOutMap()
      txOutMap.addTx(this.funding.txb.tx)
      let txVerifier = new TxVerifier(commitmentTxb.tx, txOutMap)
      let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
      if (error) {
        throw new Error('Commitment transaction does not spend from the funding transaction')
      }

      // if no error was thrown, we store the tranaction
      this.commitmentTxb = commitmentTxb
      // the order of the outputs depsnds on who funded the channel (that's bc
      // the fee is payed by funder)
      if (this.funder) {
        this.htlcOutNum = 0
        this.rhtlcOutNum = 1
      } else {
        this.htlcOutNum = 1
        this.rhtlcOutNum = 0
      }
    }, this)
  }

  /*
   * Agent stores the hash of other agent's revocation secret. This will allow her
   * to build a commitment transaction that other agent can later revoke.
   */
  setOtherRevocationSecret (revocationSecret) {
    if (!this.other) {
      throw new Error('asyncInitializeOther must be called before storeOtherSecrets')
    }
    if (!revocationSecret || revocationSecret.buf || !revocationSecret instanceof Secret) {
      throw new Error('hidden revocationSecret required when calling storeOtherSecrets')
    }
    this.other.revocationSecrets.push(revocationSecret)
  }

  /*
   * Checks that a revocation secret solution obtained by the other party
   * is an actual solution and stores if so
   */
  setOtherRevocationSecretSolution (secret) {
    return asink(function *() {
      if (!this.other || !this.other.revocationSecrets) {
        throw new Error('AsyncInitializeOther must be called before storeOtherSecrets')
      }
      // check that the provided secret validates
      if (!(yield secret.asyncCheck())) {
        throw new Error('Provided secret does not validate')
      }
      // check that secret is a solution to the topmost element of the stored
      // revocation secrets
      let revocationSecrets = this.other.revocationSecrets
      let pos = revocationSecrets.length - 1
      let revocationSecret = revocationSecrets[pos]
      if (!secret.hash || secret.hash.toString('hex') !== revocationSecret.hash.toString('hex')) {
        throw new Error('Provided secret does not match local secret')
      }

      // if no error was thrown, we store the new secret
      this.other.revocationSecrets[pos] = secret
    }, this)
  }

  /* ---- protocol ---- */

  asyncOpenChannel (amount, otherPubKey, otherMsPubKey, otherHtlcSecret) {
    return asink(function *() {
      if (!amount || !otherPubKey || !otherMsPubKey) {
        throw new Error('amount, otherPubKey, otherMsPubKey required in asyncOpenChannel')
      }

      // initialize information about other agent
      yield this.asyncInitializeOther(otherPubKey, otherMsPubKey, otherHtlcSecret)

      // initialize locally
      yield this.asyncInitializeRevocationSecret()
      yield this.asyncInitializeMultisig()

      if (!this.funder) {
        // send your information to the other agent, make sure to not share any
        // secrets when you do that.
        yield this.remoteAgent.asyncOpenChannel(amount, this.funding.keyPair.pubKey, this.multisig.pubKey, this.htlcSecret.hidden())
      } else {
        // the funder will build the funding transaction and cache it's hashbuf
        // and txout
        let fee = Bn(20000)
        let output = this.wallet.getUnspentOutput(amount.add(fee), this.funding.keyPair.pubKey)
        yield this.asyncSetFundingTx(yield CnlTxBuilder.asyncBuildFundingTx(amount, this.funding, this.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey), amount)

        // send hash of funding transaction to the other party
        this.remoteAgent.setFundingTxHash(amount, this.funding.txb.tx.hashbuf, this.funding.txb.tx.txOuts)
      }
    }, this)
  }

  /*
   * This will build and sign a commitment transaction over the specified amount.
   * The commitment transaction is then sent to the other party to sign and
   * store. Note that both agents have already created fresh secrets.
   */
  asyncSend (amount, amountToOther, revocationSecret, txb) {
    return asink(function *() {
      this.other.revocationSecrets.push(revocationSecret)
      this.setCommitmentTxo(yield CnlTxBuilder.asyncBuildCommitmentTxb(amount, amountToOther, this.spending, this.funding, this.multisig, this.other, this.htlcSecret, this.funder))

      if (!this.sender) {
        // ask the other agent to send you a partially signed commitment transaction
        yield this.remoteAgent.asyncSend(amountToOther, amount, this.revocationSecret.hidden())
      } else {
        // send your partially signed transaction to other agent
        yield this.remoteAgent.asyncSendTxb(this.commitmentTxb)
      }
    }, this)
  }

  asyncSendTxb (txb) {
    return asink(function *() {
      // check the other parties commitment transaction
      yield this.asyncSetOtherCommitmentTx(txb)

      // TODO react to a wrongly sent transaction

      if (!this.sender) {
        // send your partially signed commitment transaction to the other party
        yield this.remoteAgent.asyncSendTxb(this.commitmentTxb)
      } else {
        // revoke your last transaction
        yield this.remoteAgent.asyncSendRevocationSecret(this.revocationSecret)
      }
    }, this)
  }

  asyncSendRevocationSecret (revocationSecret) {
    return asink(function *() {
      // check and store the other agents revocation secret
      this.other.revocationSecrets.push(revocationSecret)

      // TODO react to a wrong solution to the revocation secret

      if (!this.sender) {
        // revoke your last transaction
        yield this.remoteAgent.asyncSendRevocationSecret(this.revocationSecret)
      }
    }, this)
  }

  /* ---- static methods ---- */

  /*
   * Computes the sum of unspent outputs of a transaction that go to a given address.
   */

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
}
module.exports = Agent
