'use strict'
let Struct = require('fullnode/lib/struct')
let Script = require('fullnode/lib/script')
let BN = require('fullnode/lib/bn')
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

Agent.prototype.asyncInitialize = function () {
  return asink(function *() {
    // towardsMe indicates whether the last payment increased this.balance
    this.towardsMe = false

    // the senders private address
    this.pubkey = Pubkey().fromPrivkey(this.privkey)
    this.address = Address().fromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // the multisig address used in the agent
    this.msPubkey = Pubkey().fromPrivkey(this.msPrivkey)
    let pubkeys = [this.msPubkey, this.otherMsPubkey]
    pubkeys.sort()
    this.msScript = Script().fromPubkeys(2, pubkeys)
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
    this.balance = amount

    return txb
  }, this)
}

Agent.prototype.storeOtherFundingTx = function (tx) {
  // store
  this.otherFundingTx = tx
  this.otherBalance = Agent.amountSpentToAddress(tx, this.msAddress)
  this.funded = true
}

/* refund transaction */

Agent.prototype.asyncBuildPartialRefundTx = function (nlocktime) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before partial refund transaction can be made')
    }
    if (!this.fundingTx) {
      throw new Error('Funding transaction must be created before refund transaction can be built')
    }
    if (!nlocktime) {
      throw new Error('nlocktime must be set when building a refund transaction')
    }

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    // build the transaction TODO add ntimelock
    let txb = Txbuilder()
    txb.setChangeAddress(this.address)
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)
    txb.setNLocktime(nlocktime)
    txb.build()

    yield txb.asyncSign(0, this.msKeypair)

    this.nlocktime = nlocktime

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

/*
 * builds a transaction that spends the output that the sender
 * funded the multisig wallet with back to the agent
 */
Agent.prototype.asyncBuildParitalPaymentTx = function (amountToOther, nlocktime) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before partial funding transaction can be made')
    }
    if (!this.funded) {
      throw new Error('Funding process must be completed before payment can be sent')
    }
    if (!nlocktime) {
      throw new Error('nlocktime must be set when building a payment transaction')
    }

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    let otherFundingTxhashbuf = yield this.otherFundingTx.asyncHash()
    let otherFundingTxout = yield this.otherFundingTx.txouts[0]

    // build the transaction
    let txb = Txbuilder()
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)
    txb.fromScripthashMultisig(otherFundingTxhashbuf, 0, otherFundingTxout, this.msScript)

    txb.toAddress(amountToOther, this.otherAddress)
    txb.setChangeAddress(this.address)
    txb.setNLocktime(nlocktime)
    txb.build()

    yield txb.asyncSign(0, this.msKeypair)

    this.nlocktime = nlocktime
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
  // store
  this.paymentTx = tx
  this.balance = Agent.amountSpentToAddress(tx, this.address)
  this.otherBalance = Agent.amountSpentToAddress(tx, this.otherAddress)
}

/* static methods */

/*
 * compute the sum of unspent outputs of a transaction that
 * go to address
 */
Agent.amountSpentToAddress = function (tx, address) {
  let amount = BN(0)
  tx.txouts.forEach((el, index) => {
    if (el.script.isScripthashOut()) {
      let scriptbuf = el.script.chunks[1].buf
      let addressbuf = address.hashbuf
      if (!Buffer.compare(scriptbuf, addressbuf)) {
        amount = amount.add(BN(el.valuebn.toString()))
      }
    } else if (el.script.isPubkeyhashOut()) {
      let scriptbuf = el.script.chunks[2].buf
      let addressbuf = address.hashbuf
      if (!Buffer.compare(scriptbuf, addressbuf)) {
        amount = amount.add(BN(el.valuebn.toString()))
      }
    }
  })
  return amount
}

module.exports = Agent
