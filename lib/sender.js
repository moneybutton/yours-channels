'use strict'
let Struct = require('fullnode/lib/struct')
let Script = require('fullnode/lib/script')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Txbuilder = require('fullnode/lib/txbuilder')
let Keypair = require('fullnode/lib/keypair')
let asink = require('asink')

function Sender (senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress, msPubkey, MsScript, msAddress, amountFunded, balance, fundingTx) {
  if (!(this instanceof Sender)) {
    return new Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress, msPubkey, MsScript, msAddress, amountFunded, balance, fundingTx)
  }
  this.fromObject({senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress, msPubkey, MsScript, msAddress, amountFunded, balance, fundingTx})
}

Sender.prototype = Object.create(Struct.prototype)
Sender.prototype.constructor = Sender

Sender.prototype.setupMsScript = function () {
  this.msPubkey = Pubkey().fromPrivkey(this.senderMsPrivkey)
  this.msScript = Script().fromPubkeys(2, [this.msPubkey, this.receiverMsPubkey])
  return this.msScript
}

Sender.prototype.setupMsAddress = function () {
  if (!this.msScript) {
    throw new Error('multisig script must be created before address can be created')
  }
  this.msAddress = Address().fromRedeemScript(this.msScript)
  return this.msAddress
}

Sender.prototype.initialize = function () {
  this.setupMsScript()
  this.setupMsAddress()
}

/*
 * Creat a funding transaction
 * @param amount the amount used to fund the channel, in satoshi
 * @param txhashbuf, txoutnum, txout, pubkey identify the output to spend
 */
Sender.prototype.asyncCreateAndSignFundingTx = function (amount, changeaddr, txhashbuf, txoutnum, txout, pubkey) {
  return asink(function *() {
    if (!this.msAddress) {
      throw new Error('multisig address must be initialized before signing the funding transaction')
    }

    // build transaction
    let txb = Txbuilder()
    txb.setChangeAddress(changeaddr)
    txb.fromPubkeyhash(txhashbuf, txoutnum, txout, pubkey)
    txb.to(amount, this.msAddress)
    txb.build()

    // sign it
    let senderMsKeypair = yield Keypair().asyncFromPrivkey(this.senderMsPrivkey)
    yield txb.asyncSign(0, senderMsKeypair)

    // save the amount funded in the object
    this.amountFunded = amount  // the amount the channel has been funded via the original funding transaction
    this.balance = amount // the current balance of the channel
    this.fundingTx = txb.tx

    return txb.tx
  }, this)
}

/*
 * will create a partially signed transaction that spends aldalsdkn
 * funds of the channel back to the sender
 */
Sender.prototype.asyncCreateAndSignRefundTx = function () {
  return asink(function *() {
    if (!this.msScript) {
      throw new Error('multisig script must be created before payment can be sent')
    }
    if (!this.msPubkey) {
      throw new Error('multisig script must be created before payment can be sent')
    }
    if (!this.fundingTx) {
      throw new Error('funding tx must be set up before sending a payment')
    }

    let senderMsKeypair = Keypair().fromPrivkey(this.senderMsPrivkey)

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    // build the transaction
    let txb = Txbuilder()
    txb.setChangeAddress(this.senderAddress)
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)
    txb.build()

    yield txb.asyncSign(0, senderMsKeypair)
    // this is now a partially signed tx,
    // receiver still has to sign when he get's it

    return txb.tx
  }, this)
}

/*
 * Creat a payment transaction
 * @param amount the amount used to fund the channel, in satoshi
 * @param txhashbuf, txoutnum, txout, pubkey identify the output to spend from the multisig addr
 */
Sender.prototype.asyncCreateAndSignPaymentTx = function (amountToSend, changeaddr) {
  return asink(function *() {
    if (!this.msScript) {
      throw new Error('multisig script must be created before payment can be sent')
    }
    if (!this.msPubkey) {
      throw new Error('multisig script must be created before payment can be sent')
    }
    if (!this.fundingTx) {
      throw new Error('funding tx must be set up before sending a payment')
    }
    if (amountToSend > this.balance) {
      throw new Error('balance too low to send this payment')
    }

    let senderMsKeypair = Keypair().fromPrivkey(this.senderMsPrivkey)

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    // build the transaction
    let txb = Txbuilder()
    txb.setChangeAddress(changeaddr)
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)
    txb.to((this.amountFunded).sub(amountToSend), this.senderAddress)
    txb.to(amountToSend, this.receiverAddress)
    txb.build()

    yield txb.asyncSign(0, senderMsKeypair)
    // this is now a partially signed tx,
    // receiver still has to sign when he get's it

    return txb.tx
  }, this)
}

Sender.prototype.closeChannel = function () {
  // TODO
  return true
}

module.exports = Sender
