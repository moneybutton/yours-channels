'use strict'
let Struct = require('fullnode/lib/struct')
let Script = require('fullnode/lib/script')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Txbuilder = require('fullnode/lib/txbuilder')
let Keypair = require('fullnode/lib/keypair')
let asink = require('asink')

function Agent (privkey, msPrivkey, otherMsPubkey, otherAddress) {
  if (!(this instanceof Agent)) {
    return new Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
  }
  this.fromObject({privkey, msPrivkey, otherMsPubkey, otherAddress})
}

Agent.prototype = Object.create(Struct.prototype)
Agent.prototype.constructor = Agent

Agent.prototype.initialize = function () {
  return asink(function *() {
    // the senders private address
    this.pubkey = Pubkey().fromPrivkey(this.privkey)
    this.address = Address().fromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // the multisig address used in the channel
    this.msPubkey = Pubkey().fromPrivkey(this.msPrivkey)
    this.msScript = Script().fromPubkeys(2, [this.msPubkey, this.otherMsPubkey])
    this.msAddress = Address().fromRedeemScript(this.msScript)
    this.msKeypair = yield Keypair().asyncFromPrivkey(this.msPrivkey)
    this.initialized = true
  }, this)
}

/* funding transaction */

Agent.prototype.asyncBuildFundingTx = function (amount, txhashbuf, txoutnum, txout, pubkey) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before partial funding transaction can be made')
    }

    // build and sign transaction
    let txb = Txbuilder()
    txb.fromPubkeyhash(txhashbuf, txoutnum, txout, pubkey)
    txb.toAddress(amount, this.msAddress)
    txb.setChangeAddress(this.address)
    txb.build()
    yield txb.asyncSign(0, this.keypair)
    this.fundingTx = txb.tx

    return txb
  }, this)
}

Agent.prototype.storeOtherFundingTx = function (tx) {
  this.otherFundingTx = tx
}

/* refund transaction */

Agent.prototype.asyncBuildPartialRefundTx = function () {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before partial refund transaction can be made')
    }
    if (!this.fundingTx) {
      throw new Error('Funding transaction must be created before refund transaction can be built')
    }

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    // build the transaction TODO add ntimelock
    let txb = Txbuilder()
    txb.setChangeAddress(this.address)
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)
    txb.build()

    yield txb.asyncSign(0, this.msKeypair)

    return txb
  }, this)
}

Agent.prototype.asyncBuildRefundTx = function (txb) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before refund transaction can be made')
    }

    // sign transaction
    yield txb.asyncSign(0, this.msKeypair)
    return txb.tx
  }, this)
}

Agent.prototype.storeRefundTx = function (tx) {
  this.refundTx = tx
}

/* payment transaction */

Agent.prototype.asyncBuildParitalPaymentTx = function (amountToMe, amountToOther) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before partial funding transaction can be made')
    }
    if (!this.fundingTx || !this.otherFundingTx) {
      throw new Error('Funding process must be completed before payment can be sent')
    }

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    let otherFundingTxhashbuf = yield this.otherFundingTx.asyncHash()
    let otherFundingTxout = yield this.otherFundingTx.txouts[0]

    // build the transaction
    let txb = Txbuilder()
    txb.setChangeAddress(this.address)
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)
    txb.fromScripthashMultisig(otherFundingTxhashbuf, 0, otherFundingTxout, this.msScript)

    txb.toAddress(amountToMe, this.address)
    txb.toAddress(amountToOther, this.otherAddress)
    txb.build()

    yield txb.asyncSign(0, this.msKeypair)
    return txb
  }, this)
}

Agent.prototype.asyncBuildPaymentTx = function (txb) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before refund transaction can be made')
    }

    // sign transaction
    yield txb.asyncSign(0, this.msKeypair)
    return txb.tx
  }, this)
}

Agent.prototype.storePaymentTx = function (tx) {
  this.paymentTx = tx
}

module.exports = Agent
