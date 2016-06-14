/**
 * MsgSecret
 * =========
 *
 * When an agent needs to reveal the secret for a particular hash. This works
 * either for an HTLC secret or a revocation secret.
 */
'use strict'
let Hash = require('yours-bitcoin/lib/hash')
let Msg = require('./msg')
let asink = require('asink')

class MsgSecret extends Msg {
  constructor (args, chanId) {
    let cmd = 'secret'
    super(cmd, args, chanId)
  }

  setSecret (secretBuf, hashBuf) {
    this.args.secret = secretBuf.toString('hex')
    this.args.hash = hashBuf.toString('hex')
    return this
  }

  getSecret () {
    return new Buffer(this.args.secret, 'hex')
  }

  getSecretHash () {
    return new Buffer(this.args.hash, 'hex')
  }

  asyncIsValid () {
    return asink(function * () {
      if (!Msg.prototype.isValid.call(this)) {
        return false
      }
      let secret = new Buffer(this.args.secret, 'hex')
      let hash1 = yield Hash.asyncSha256Ripemd160(secret)
      let hash2 = new Buffer(this.args.hash, 'hex')
      return Buffer.compare(hash1, hash2) === 0
    }, this)
  }
}

module.exports = MsgSecret
