/**
 * MsgOpenRes
 * ==========
 *
 * This message, "open-res" or MsgOpenRes, is sent in response to the "open"
 * message (MsgOpen).
 */
'use strict'
let Msg = require('./msg')
let PubKey = require('yours-bitcoin/lib/pub-key')

class MsgOpenRes extends Msg {
  constructor (args) {
    let cmd = 'open-res'
    super(cmd, args)
  }

  setPubKey (pubKey) {
    this.args.pubKey = pubKey.toHex()
    return this
  }

  asyncGetPubKey () {
    return PubKey.asyncFromHex(this.args.pubKey)
  }
}

module.exports = MsgOpenRes
