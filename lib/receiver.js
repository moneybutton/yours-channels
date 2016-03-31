'use strict'

let Struct = require('fullnode/lib/struct')
let Txbuilder = require('fullnode/lib/txbuilder')
let Txverifier = require('fullnode/lib/txverifier')
let Txoutmap = require('fullnode/lib/txoutmap')
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

/*
 * signes a partially signes transaction obtained from the client
 */
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
Receiver.prototype.verifyTx = function (tx, txoutmap) {
  return Txverifier.verify(tx, txoutmap, Interp.SCRIPT_VERIFY_P2SH)
}

Receiver.prototype.asyncCheckAndSignRefundTx = function (refundTx, fundingTx) {
  return asink(function *() {
    // store the fundingTx
    this.fundingTx = fundingTx

    // store the fundingTxOutputmap
    let txoutmap = Txoutmap()
    txoutmap.addTx(fundingTx)
    this.fundingTxOutputmap = txoutmap

    let signedRefundTx = yield this.asyncSignPaymentTx(refundTx)
    var verified = this.verifyTx(signedRefundTx, this.fundingTxOutputmap)
    if (verified) {
      // TODO: monitor the blockchain in a worker to see if the fundingTx has 1 conf
      return signedRefundTx
    } else {
      return false
    }
  }, this)
}

Receiver.prototype.asyncAcceptPayment = function (tx) {
  return asink(function *() {
    if (!this.fundingTxOutputmap) {
      throw new Error('asyncCheckAndSignRefundTx must be called before asyncAcceptPayment')
    }

    let signedTx = yield this.asyncSignPaymentTx(tx)
    let verified = this.verifyTx(signedTx, this.fundingTxOutputmap)
    if (verified) {
      return signedTx.toString()
    } else {
      return false
    }
  }, this)
}

Receiver.prototype.closeChannel = function () {
  return true
}

module.exports = Receiver
