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
let Script = require('yours-bitcoin/lib/script')
let Sig = require('yours-bitcoin/lib/sig')
let OpCode = require('yours-bitcoin/lib/op-code')

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

/* ---- open & fund a channel ---- */

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
 * Creates the funding transaction.
 */
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

/*
 * The party not funding the channel will need to know the transaction hashes in
 * order to be able to build the refund transaction and then send it to the funder.
 */
Agent.prototype.storeOtherFundingTxHash = function (amount, fundingTxhashbuf, fundingTxout) {
  this.fundingTxhashbuf = fundingTxhashbuf
  this.fundingTxout = fundingTxout
  this.amountFunded = amount
}

/* ---- send a payment ---- */

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
  this.other.revocationSecret = revocationSecret
}

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

    let script = Scripts.htlc(this)
    let scriptToOther = Scripts.rhtlc(this)

    let txb = new TxBuilder()
    txb.inputFromScriptHashMultiSig(this.fundingTxhashbuf, 0, this.fundingTxout, this.multisig.script)
    // funder pays the transaction fee
    if (this.funder) {
      txb.setChangeScript(script)
      txb.outputToScript(amountToOther, scriptToOther)
    } else {
      txb.outputToScript(amount, script)
      txb.setChangeScript(scriptToOther)
    }
    txb.build()

    // fnuder will have this.fundingTx, the other guy has this.fundingTxout
    let txouts = this.fundingTxout || this.fundingTx.txouts[0]

    this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keyPair, txouts)

    return this.commitmentTxb
  }, this)
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
      return this.commitmentTxb
    }
  }, this)
}

/* ---- SPENDING TRANSACTIONS ---- */

/*
 * Builds a transaction that spends from the own commitment transaction
 */
Agent.prototype.asyncBuildSpendingOwnCommitmentTxb = function (commitmentTx) {
  return asink(function *() {
    let txhashbuf = commitmentTx.hash()
    let txoutnum = 0
    let txout = commitmentTx.txOuts[0]

    let txb = new TxBuilder()
    let scriptSig = new Script()
      .writeOpCode(OpCode.OP_TRUE)
      .writeOpCode(OpCode.OP_FALSE)

    // A this point, scriptSig should be the script in the input, and it should
    // contain any necessary keys or hash preimages. It cannot contain the
    // signature, however, because you cannot sign a tx until you are finished
    // build it. Instead of a signature, it should contain an OP_0.
    txb.setVersion(2)
    let txseqnum = 100
    txb.inputFromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
    txb.setChangeAddress(this.spending.address)
    txb.build()

    // Now that you have built the tx, you can sign it.
    //
    // We cannot simply sign it like this:
    // yield txb.sign(0, this.spending.keyPair, txout)
    // That method only works for pubKeyhash or p2sh multisig scripts.
    //
    // Instead, use the getSig method:
    // output of the commitment transaction
    let subScript = commitmentTx.txOuts[0].script
    let sig = txb.getSig(this.spending.keyPair, Sig.SIGHASH_ALL, 0, subScript)

    // Now that you have the signature, you must manually insert it back into
    // the trasaction where the OP_0 is, probably the 2 position:
    scriptSig.setChunkBuffer(0, sig.toTxFormat())
    txb.tx.txIns[0].setScript(scriptSig)

    return txb
  }, this)
}

/* ---- BUILDING A REFUND TRANSACTION ---- */

/*
 * Builds a refund transaction.
 */
Agent.prototype.asyncBuildRefundTxb = function () {
  return asink(function *() {
    if (!this.amountFunded) {
      throw new Error('asyncBuildFundingTx must be called before asyncBuildRefundTxb')
    }
    let txb = yield this.asyncBuildCommitmentTxb(Bn(0), this.amountFunded)
    return txb
  }, this)
}

/* ---- PROTOCOL ---- */

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
    this.other.revocationSecret = revocationSecret
    // build a new commitment transaction and store locally
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
