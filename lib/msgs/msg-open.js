/**
 * MsgOpen
 * =======
 *
 * This is the "open" message and is used to open a channel. This is the first
 * message sent on a channel. It is what you sent when you want to open a
 * channel with someone. It contains your extended public key for use in the
 * multisig funding transaction as well as in payments.
 */
'use strict'
let Bn = require('yours-bitcoin/lib/bn')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let Msg = require('./msg')
let asink = require('asink')

class MsgOpen extends Msg {
  constructor (args, chanId) {
    let cmd = 'open'
    super(cmd, args, chanId)
  }

  asyncSetXPub (bip32) {
    return asink(function * () {
      this.args.xPub = yield bip32.toPublic().asyncToString()
      return this
    }, this)
  }

  asyncGetXPub () {
    return Bip32.asyncFromString(this.args.xPub)
  }

  /**
   * amount: Bn, the quantity of satoshis channel is to be funded with
   */
  setAmount (amount) {
    this.args.amount = amount.toString()
  }

  getAmount () {
    return Bn(this.args.amount)
  }
}

module.exports = MsgOpen
