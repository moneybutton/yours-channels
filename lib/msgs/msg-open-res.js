/**
 * MsgOpenRes
 * ==========
 *
 * This message, 'open-res' or MsgOpenRes, is sent in response to the 'open'
 * message (MsgOpen).
 */
'use strict'
let Msg = require('./msg')
let asink = require('asink')
let Bip32 = require('yours-bitcoin/lib/bip-32')

class MsgOpenRes extends Msg {
  constructor (args, chanId) {
    let cmd = 'open-res'
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
}

module.exports = MsgOpenRes
