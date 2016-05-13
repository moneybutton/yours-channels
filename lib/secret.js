'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Hash = require('yours-bitcoin/lib/hash')
let Random = require('yours-bitcoin/lib/random')

class Secret extends Struct {
  constructor (buf, hash) {
    super()
    this.fromObject({buf, hash})
  }

  generateBuf () {
    this.buf = Random.getRandomBuffer(32)
  }

  asyncGenerateHash () {
    return asink(function *() {
      if (!this.buf) {
        return new Error('buffer must be generated before hash can be')
      }
      this.hash = yield Hash.asyncSha256Ripemd160(this.buf)
    }, this)
  }

  asyncCheck () {
    return asink(function *() {
      if (!this.buf) {
        throw new Error('secret must be set before it can be checked')
      }
      if (!this.hash) {
        throw new Error('hash must be set before secret can be checked')
      }
      let hashedBuf = yield Hash.asyncSha256Ripemd160(this.buf)
      return hashedBuf.equals(this.hash)
    }, this)
  }

  /*
   * returns a new secret with the buffer hidden
   */
  hidden () {
    if (!this.hash) {
      throw new Error('hash must be set before secret can be hidden')
    }
    return new Secret(null, this.hash)
  }
}

module.exports = Secret
