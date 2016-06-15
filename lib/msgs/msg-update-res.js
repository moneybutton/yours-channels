/**
 * MsgUpdateRes
 * ============
 *
 * 'update-res' is a response to an 'update' message. This is the same as an
 * 'update' message, except it is always sent in response to an 'update'
 * message, and never sent uninitiated.
 */
'use strict'
let MsgUpdate = require('./msg-update')

class MsgUpdateRes extends MsgUpdate {
  constructor (args, chanId) {
    super(args, chanId)
    this.cmd = 'update-res'
  }
}

module.exports = MsgUpdateRes
