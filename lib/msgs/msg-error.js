/**
 * MsgError
 * ========
 *
 * A fatal error message. Contains an error string explaining the nature of the
 * error. An error message is always fatal; the channel should be closed if you
 * are sending or receiving an error message.
 */
'use strict'
let Msg = require('./msg')

class MsgError extends Msg {
  constructor (args, chanId) {
    let cmd = 'error'
    super(cmd, args, chanId)
  }

  setErrorString (errorString) {
    this.args.error = errorString
    return this
  }

  getErrorString () {
    return this.args.error
  }
}

module.exports = MsgError
