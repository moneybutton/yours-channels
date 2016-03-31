'use strict'

let Struct = require('fullnode/lib/struct')
let Script = require('fullnode/lib/script')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Txbuilder = require('fullnode/lib/txbuilder')
let Keypair = require('fullnode/lib/keypair')
let Txout = require('fullnode/lib/txout')
let BN = require('fullnode/lib/bn')
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
    if(!this.receiverMsPrivkey) {
      throw new Error('receiverMsPrivkey must be initialized before signing a transaction')
    }
    let receiverMsKeypair = Keypair().fromPrivkey(this.receiverMsPrivkey)
    let txb = Txbuilder()
    txb.tx = tx // TODO replace with line below
    // txb.importPartiallySignedTx(tx)
    yield txb.asyncSign(0, receiverMsKeypair)
    return txb.tx
  }, this)
}

Receiver.prototype.asyncVerifyTx = function (tx) {
  return asink(function *() {
    return Txverifier.verify(tx, this.txoutmap, Interp.SCRIPT_VERIFY_P2SH)
  }, this)
}

Receiver.prototype.acceptPayment = function (tx, txoutmap) {
  let signedTx = this.signPaymentTx(tx)
  return this.verifyTx(signedTx, txoutmap)
}

Receiver.prototype.closeChannel = function () {
  return true
}

module.exports = Receiver
