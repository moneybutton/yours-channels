'use strict'
let Struct = require('fullnode/lib/struct')
let Script = require('fullnode/lib/script')
let BN = require('fullnode/lib/bn')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Txbuilder = require('fullnode/lib/txbuilder')
let Keypair = require('fullnode/lib/keypair')
let asink = require('asink')

// the amount of time by which nlocktime is reduced every time the direction
// of the channel changes
const DELTA_NLOCKTIME = 60 * 60 * 24

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

    // the multisig address used in the channel
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

    // agent sends amountToOther to the other agent and the rest to himself
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

/* conveniance methods */

Agent.prototype.asyncSendPayment = function (amount) {
  return asink(function *() {
    if (!this.funded) {
      throw new Error('Agent must me funded before payment can be sent')
    }

    // if the last payment did go in the direction of payer, decrease nlocktime
    if (this.towardsMe) {
      this.towardsMe = false
      this.nlocktime -= DELTA_NLOCKTIME
    }
    this.balance = this.balance.sub(amount)
    this.otherBalance = this.otherBalance.add(amount)

    let txb = yield this.asyncBuildParitalPaymentTx(this.otherBalance.add(amount), this.nlocktime)
    return txb
  }, this)
}

Agent.prototype.asyncAcceptPayment = function (txb) {
  return asink(function *() {
    // if the last payment did _not_ go in the direction of payer,
    // check that sender has decreased nlocktime
    if (!this.towardsMe) {
      this.towardsMe = true
      // if the transaction's nlocktime plus DELTA_NLOCKTIME is bigger than the
      // nlocktime stored in the agent, the nlocktime has not been decreased sufficiently
      // in this case agent rejects the transaction
      if (txb.tx.nlocktime + DELTA_NLOCKTIME > this.nlocktime) {
        return false
      }
    }
  }, this)
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
