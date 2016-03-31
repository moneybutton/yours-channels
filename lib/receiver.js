'use strict'

let Struct = require('fullnode/lib/struct')
let Txbuilder = require('fullnode/lib/txbuilder')
let Txverifier = require('fullnode/lib/txverifier')
let Interp = require('fullnode/lib/interp')
let Keypair = require('fullnode/lib/keypair')
let asink = require('asink')

function Receiver (receiverMsPrivkey, receiverAddress) {
  if (!(this instanceof Receiver)) {
    return new Receiver(receiverMsPrivkey, receiverAddress)
  }
  this.fromObject({receiverMsPrivkey, receiverAddress})
}

Receiver.prototype = Object.create(Struct.prototype)
Receiver.prototype.constructor = Receiver

Receiver.prototype.asyncCheckFundingTx = function (tx, txoutmap) {
  return asink(function *() {
    // TODO check that tx has one conf
    this.txoutmap = txoutmap
  }, this)
}

Receiver.prototype.asyncSignPaymentTx = function (tx) {
  return asink(function *() {
    if (!this.receiverMsPrivkey) {
      throw new Error('receiverMsPrivkey must be initialized before signing a transaction')
    }
    let receiverMsKeypair = Keypair().fromPrivkey(this.receiverMsPrivkey)
    let txb = Txbuilder()
    txb.importPartiallySignedTx(tx)
    yield txb.asyncSign(0, receiverMsKeypair)
    return txb.tx
  }, this)
}

// TODO make Txverifier.verify async
Receiver.prototype.verifyTx = function (tx) {
  return Txverifier.verify(tx, this.txoutmap, Interp.SCRIPT_VERIFY_P2SH)
}

Receiver.prototype.asyncAcceptPayment = function (tx, txoutmap) {
  return asink(function *() {
    let signedTx = yield this.asyncSignPaymentTx(tx)
    return this.verifyTx(signedTx, txoutmap)
  }, this)
}

Receiver.prototype.closeChannel = function () {
  return true
}

module.exports = Receiver
