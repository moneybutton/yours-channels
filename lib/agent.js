'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let Bn = require('yours-bitcoin/lib/bn')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

let Multisig = require('./multisig.js')
let Secret = require('./secret.js')
let Wallet = require('./wallet.js')
let CnlTxBuilder = require('./cnl-tx-builder.js')

class Agent extends Struct {
  constructor (name, privKey, pubKey, address, keyPair, other, remoteAgent, multisig, initialized,
                  amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret) {
    super()
    this.fromObject({name, privKey, pubKey, address, keyPair, other, remoteAgent, multisig, initialized,
                    amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret})
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

  // TODO compute amount from tx
  asyncSetFundingTx (tx, amount) {
    return asink(function *() {
      this.funding.txb = tx
      this.funding.txb.tx.hashbuf = yield this.funding.txb.tx.asyncHash()
      this.amountFunded = amount
    }, this)
  }

  /*
   * The party not funding the channel will need to know the transaction hashes in
   * order to be able to build the refund transaction and then send it to the funder.
   */
  setFundingTxHash (amount, fundingTxhashbuf, fundingTxout) {
    this.funding.txb = {}
    this.funding.txb.tx = {}
    this.funding.txb.tx.txOuts = [fundingTxout]
    this.funding.txb.tx.hashbuf = fundingTxhashbuf

    this.amountFunded = amount
  }

  /*
   * Store the latest commitment transaction.
   */
  setCommitmentTxb (obj) {
    this.commitmentTxb = obj.txb
    this.htlcOutNum = obj.htlcOutNum
    this.rhtlcOutNum = obj.rhtlcOutNum
  }

  /*
   * Checks if a commitment trasnaction obtained from the other party is built
   * and signed correctly. If so this function signes and stores it.
   */
  asyncSetOtherCommitmentTx (txb) {
    return asink(function *() {
      this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keyPair, this.funding.txb.tx.txOuts[0])
      let txVerifier = new TxVerifier(this.commitmentTxb.tx, this.commitmentTxb.uTxOutMap)
      let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
      if (error) {
        throw new Error('Could not verify other agents commitment transaction')
      } else {
        if (this.funder) {
          this.htlcOutNum = 0
          this.rhtlcOutNum = 1
        } else {
          this.htlcOutNum = 1
          this.rhtlcOutNum = 0
        }
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
    if (!revocationSecret || revocationSecret.buf) {
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
        throw new Error('asyncInitializeOther must be called before storeOtherSecrets')
      }
      let revocationSecrets = this.other.revocationSecrets
      let pos = revocationSecrets.length - 1
      let revocationSecret = revocationSecrets[pos]
      revocationSecret.buf = secret.buf
      let bool = yield revocationSecret.asyncCheck()
      if (bool) {
        revocationSecrets[pos] = revocationSecret
      }
      return bool
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
        this.remoteAgent.setFundingTxHash(amount, this.funding.txb.tx.hashbuf, this.funding.txb.tx.txOuts[0])
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
      this.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(amount, amountToOther, this.spending, this.funding, this.multisig, this.other, this.htlcSecret, this.funder))

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
