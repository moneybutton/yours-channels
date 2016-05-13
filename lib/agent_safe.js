'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let Bn = require('yours-bitcoin/lib/bn')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let Sig = require('yours-bitcoin/lib/sig')

let Multisig = require('./multisig.js')
let Secret = require('./secret.js')
let Scripts = require('./scripts.js')
let Wallet = require('./wallet.js')

function Agent (name, privKey, pubKey, address, keyPair, other, remoteAgent, multisig, initialized,
                amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret) {
  if (!(this instanceof Agent)) {
    return new Agent(name, privKey, pubKey, address, keyPair, other, remoteAgent, multisig, initialized,
                    amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret)
  }
  this.fromObject({name, privKey, pubKey, address, keyPair, other, remoteAgent, multisig, initialized,
                  amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret})
}

Agent.prototype = Object.create(Struct.prototype)
Agent.prototype.constructor = Agent

/* ======== INITIALIZE THE CHANNEL ======== */

Agent.prototype.asyncInitialize = function (fundingPrivKey, multisigPrivKey, spendingPrivKey) {
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
    this.htlcSecret = Secret()
    this.htlcSecret.generateBuf()
    yield this.htlcSecret.asyncGenerateHash()

    // the wallet
    this.wallet = Wallet()

    this.initialized = true
  }, this)
}

Agent.prototype.asyncInitializeOther = function (otherPubKey, otherMsPubKey, otherHtlcSecret) {
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

/* ---- channel communication ---- */

/*
 * Stores the other agents public keys and creats a shared multisig address.
 */
Agent.prototype.asyncBuildMultisig = function () {
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
 * The party not funding the channel will need to know the transaction hashes in
 * order to be able to build the refund transaction and then send it to the funder.
 */
Agent.prototype.storeOtherFundingTxHash = function (amount, fundingTxhashbuf, fundingTxout) {
  this.fundingTxhashbuf = fundingTxhashbuf
  this.fundingTxout = fundingTxout
  this.amountFunded = amount
}

/*
 * Checks if a commitment trasnaction is built and signed correctly.
 * If so this function signes it so that it can be sent to the other party.
 */
Agent.prototype.asyncAcceptCommitmentTx = function (txb) {
  return asink(function *() {
    this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keyPair, this.fundingTxout)
    let txVerifier = new TxVerifier(this.commitmentTxb.tx, this.commitmentTxb.uTxOutMap)
    let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
    if (error) {
      throw new Error('error in asyncAcceptCommitmentTx ' + error)
    } else {
      if (this.funder) {
        this.htlcOutNum = 0
        this.rhtlcOutNum = 1
      } else {
        this.htlcOutNum = 1
        this.rhtlcOutNum = 0
      }
      return this.commitmentTxb
    }
  }, this)
}

/*
 * Agent generates a secret a htlc secret and and revocation secret.
 */
Agent.prototype.asyncGenerateRevocationSecret = function () {
  return asink(function *() {
    this.revocationSecret = Secret()
    this.revocationSecret.generateBuf()
    yield this.revocationSecret.asyncGenerateHash()
  }, this)
}

/*
 * Agent stores the hash of other agent's revocation secret. This will allow her
 * to build a commitment transaction that other agent can later revoke.
 */
Agent.prototype.storeOtherRevocationSecret = function (revocationSecret) {
  if (!this.other) {
    throw new Error('asyncInitializeOther must be called before storeOtherSecrets')
  }
  if (!revocationSecret) {
    throw new Error('revocationSecret required when calling storeOtherSecrets')
  }
  if (revocationSecret.buf) {
    throw new Error('revocationSecret should be shared hidden.')
  }
  this.other.revocationSecrets.push(revocationSecret)
}

Agent.prototype.storeOtherRevocationSecretSolution = function (secret) {
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

/* ======== TRANSACTION BUILDER ======== */

/* ---- FUNDING TRANSACTION ---- */

Agent.prototype.asyncBuildFundingTx = function (amount, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before funding transaction can be built')
    }
    if (!this.multisig) {
      throw new Error('Multisig address must be created before funding transaction can be built')
    }

    let txb = new TxBuilder()
    txb.inputFromPubKeyHash(inputTxHashbuf, inputTxoutnum, inputTxout, pubKey)
    txb.setChangeAddress(this.funding.address)
    txb.outputToAddress(amount, this.multisig.address)
    txb.build()
    txb.sign(0, this.funding.keyPair, inputTxout)

    this.amountFunded = amount

    this.fundingTx = txb.tx
    this.fundingTxhashbuf = yield txb.tx.asyncHash()
    this.fundingTxout = yield txb.tx.txOuts[0]

    return txb
  }, this)
}

/* ---- REFUND TRANSACTION ---- */

Agent.prototype.asyncBuildRefundTxb = function () {
  return asink(function *() {
    if (!this.amountFunded) {
      throw new Error('asyncBuildFundingTx must be called before asyncBuildRefundTxb')
    }
    let txb = yield this.asyncBuildCommitmentTxb(Bn(0), this.amountFunded)
    return txb
  }, this)
}

/* ---- COMMITMENT TRANSACTION ---- */

/*
 * Agent builds and signs a commitment transaction that she later sends to other agent.
 * This is a transaction that other agent will be able to revoke.
 */
Agent.prototype.asyncBuildCommitmentTxb = function (amount, amountToOther) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before payment transaction can be built')
    }
    if (!this.multisig) {
      throw new Error('Multisig address must be created before payment transaction can be built')
    }
    if (!this.fundingTx && !this.fundingTxout) {
      throw new Error('Funding transaction must be created before payment transaction can be built')
    }
    if (!amount.add(amountToOther).eq(this.amountFunded)) {
      throw new Error('amount plus amountToOther should equal amountFunded')
    }

    let htlcScript = Scripts.htlc(this.spending.keyPair.pubKey, this.other.pubKey, this.htlcSecret)
    let rhtlcScript = Scripts.rhtlc(this.spending.keyPair.pubKey, this.other.pubKey, this.other.htlcSecret, this.other.revocationSecrets)

    let txb = new TxBuilder()
    txb.inputFromScriptHashMultiSig(this.fundingTxhashbuf, 0, this.fundingTxout, this.multisig.script)
    // funder pays the transaction fee
    // note that the changeScript will always be on the last output
    if (this.funder) {
      txb.outputToScript(amountToOther, rhtlcScript)
      txb.setChangeScript(htlcScript)
      this.htlcOutNum = 1
      this.rhtlcOutNum = 0
    } else {
      txb.outputToScript(amount, htlcScript)
      txb.setChangeScript(rhtlcScript)
      this.htlcOutNum = 0
      this.rhtlcOutNum = 1
    }
    txb.build()

    // fnuder will have this.fundingTx, the other guy has this.fundingTxout
    let txouts = this.fundingTxout || this.fundingTx.txouts[0]

    this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keyPair, txouts)

    return this.commitmentTxb
  }, this)
}

/* ---- SPENDING TRANSACTIONS ---- */

/*
 * Builds a transaction that spends from the commitment transaction.
 * Requires payee to present their htlc secret.
 * Used if the agent himself published the commitment transaction.
 * This is branch 1.1.2 in the picture
 */
Agent.prototype.asyncBuildSpendingTx = function (commitmentTx) {
  return asink(function *() {
    let txb = yield this.buildNonStandardTx(commitmentTx, Scripts.spendFromRhtlc(this.htlcSecret), 1, this.rhtlcOutNum)
    return txb
  }, this)
}

/*
 * Builds a transaction that spends from the commitment transaction.
 * Requires payee to present their htlc secret.
 * Used if the agent himself published the commitment transaction.
 * This is branch 1.1.2 in the picture
 */
Agent.prototype.asyncBuildOtherSpendingTx = function (commitmentTx) {
  return asink(function *() {
    let txb = yield this.buildNonStandardTx(commitmentTx, Scripts.spendFromHtlc(this.htlcSecret), 1, this.htlcOutNum)
    return txb
  }, this)
}

/*
 * Builds a transaction that spends from the commitment transaction,
 * in case that the othere party did not present his htlc secret on time.
 * Used if the agent himself published the commitment transaction.
 * This is branch 1.1.2 in the picture
 */
Agent.prototype.asyncBuildHtlcEnforcementTx = function (commitmentTx) {
  return asink(function *() {
    let txb = yield this.buildNonStandardTx(commitmentTx, Scripts.enforceFromHtlc(), 0, this.htlcOutNum)
    return txb
  }, this)
}

/*
 * Builds a transaction that spends from the commitment transaction,
 * in case that the othere party did not present his htlc secret on time.
 * Used if the other agent published the commitment transaction
 * This is branch 2.2.2 in the picture
 */
Agent.prototype.asyncBuildOtherHtlcEnforcementTx = function (commitmentTx) {
  return asink(function *() {
    let txb = yield this.buildNonStandardTx(commitmentTx, Scripts.enforceFromRhtlc(), 0, this.rhtlcOutNum)
    return txb
  }, this)
}

/*
 * Builds a transaction that spends from the commitment transaction.
 * Requires payee to present their htlc secret.
 * Used if the agent himself published the commitment transaction.
 * This is branch 1.1.2 in the picture
 */
Agent.prototype.asyncSpendRevokedCommitmentTx = function (commitmentTx) {
  return asink(function *() {
    let revocationSecrets = this.other.revocationSecrets
    let revocationSecret = revocationSecrets[revocationSecrets.length - 1]
    let script = Scripts.revokeRhtlc(revocationSecret)
    let txb = yield this.buildNonStandardTx(commitmentTx, script, 1, this.rhtlcOutNum)
    return txb
  }, this)
}

/* Used to build spending transactions in which spend from non-standard outputs
 * like htlc or rhtlc. Conveniance function that all spending transactions call
 */
Agent.prototype.buildNonStandardTx = function (commitmentTx, scriptSig, sigPos, txoutnum) {
  return asink(function *() {
    let txhashbuf = commitmentTx.hash()
    let txb = new TxBuilder()
    // txoutnum should be 0 if this.funder and 1 otherwise
    // let txoutnum = this.funder ? 0 : 1
    let txout = commitmentTx.txOuts[txoutnum]

    txb.setVersion(2)
    let txseqnum = 100
    txb.inputFromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
    txb.setChangeAddress(this.spending.address)
    txb.build()

    let subScript = commitmentTx.txOuts[txoutnum].script
    let sig = txb.getSig(this.spending.keyPair, Sig.SIGHASH_ALL, 0, subScript)

    scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
    txb.tx.txIns[0].setScript(scriptSig)
    return txb
  }, this)
}

/* ======== PROTOCOL ======== */

Agent.prototype.asyncOpenChannel = function (amount, otherPubKey, otherMsPubKey, otherHtlcSecret) {
  return asink(function *() {
    if (!amount || !otherPubKey || !otherMsPubKey) {
      throw new Error('amount, otherPubKey, otherMsPubKey required in asyncOpenChannel')
    }

    yield this.asyncInitializeOther(otherPubKey, otherMsPubKey, otherHtlcSecret)
    yield this.asyncBuildMultisig()

    if (!this.funder) {
      yield this.remoteAgent.asyncOpenChannel(amount, this.funding.keyPair.pubKey, this.multisig.pubKey, this.htlcSecret.hidden())
    } else {
      let fee = Bn(20000)
      let output = this.wallet.getUnspentOutput(amount.add(fee), this.funding.keyPair.pubKey)
      yield this.asyncBuildFundingTx(amount, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
      this.remoteAgent.storeOtherFundingTxHash(amount, this.fundingTxhashbuf, this.fundingTxout)
    }
  }, this)
}

// we assume that both agents have already created fresh secrets
Agent.prototype.asyncSend = function (amount, amountToOther, revocationSecret, txb) {
  return asink(function *() {
    this.other.revocationSecrets.push(revocationSecret)
    yield this.asyncBuildCommitmentTxb(amount, amountToOther)
    if (!this.sender) {
      yield this.remoteAgent.asyncSend(amountToOther, amount, this.revocationSecret.hidden())
    } else {
      yield this.remoteAgent.asyncSendTxb(this.commitmentTxb)
    }
  }, this)
}

Agent.prototype.asyncSendTxb = function (txb) {
  return asink(function *() {
    yield this.asyncAcceptCommitmentTx(txb)

    if (!this.sender) {
      yield this.remoteAgent.asyncSendTxb(this.commitmentTxb)
    } else {
      yield this.remoteAgent.asyncSendRevocationSecret(this.revocationSecret)
    }
  }, this)
}

Agent.prototype.asyncSendRevocationSecret = function (revocationSecret) {
  return asink(function *() {
    this.other.revocationSecrets.push(revocationSecret)
    if (!this.sender) {
      yield this.remoteAgent.asyncSendRevocationSecret(this.revocationSecret)
    }
  }, this)
}

/* ---- STATIC METHODS ---- */

/*
 * Computes the sum of unspent outputs of a transaction that go to a given address.
 */
/*
Agent.amountSpentToAddress = function (tx, address) {
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
module.exports = Agent
