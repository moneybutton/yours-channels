/**
 * MsgSecret
 * =========
 *
 * When an agent needs to reveal the secret for a particular hash. The type can
 * be "HTLC" or "Revocation".
 */
'use strict'
let Msg = require('./msg')

class MsgSecret extends Msg {
  constructor (args, chanId) {
    let cmd = 'secret'
    super(cmd, args, chanId)
  }

  setSecret (type = 'HTLC', secretBuf, secretHashBuf) {
    this.args.type = type
    this.args.secret = secretBuf.toString('hex')
    this.args.secretHash = secretHashBuf.toString('hex')
    return this
  }

  getSecret () {
    return new Buffer(this.args.secret, 'hex')
  }

  getSecretHash () {
    return new Buffer(this.args.secretHash, 'hex')
  }

  getType () {
    return this.args.type
  }
}

module.exports = MsgSecret
