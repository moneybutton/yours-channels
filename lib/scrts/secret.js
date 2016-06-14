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

  asyncInitialize () {
    return asink(function * () {
      this.generateBuf()
      yield this.asyncGenerateHash()
      return this
    }, this)
  }

  generateBuf () {
    this.buf = Random.getRandomBuffer(32)
  }

  asyncGenerateHash () {
    return asink(function * () {
      if (!this.buf) {
        return new Error('buffer must be generated before hash can be')
      }
      this.hash = yield Hash.asyncSha256Ripemd160(this.buf)
    }, this)
  }

  asyncSuperCheck () {
    return asink(function * () {
      if (!this.buf) {
        throw new Error('secret.buf is not set')
      }
      if (!this.hash) {
        throw new Error('secret.hash is not set')
      }
      let hashedBuf = yield Hash.asyncSha256Ripemd160(this.buf)
      return hashedBuf.equals(this.hash)
    }, this)
  }

  /*
   * returns a new secret with the buffer toPublic
   */
  toPublic () {
    let secret = new Secret().fromObject(this)
    secret.buf = undefined
    return secret
  }

  toJSON () {
    let json = {}
    json.buf = this.buf ? this.buf.toString('hex') : undefined
    json.hash = this.hash ? this.hash.toString('hex') : undefined
    return json
  }

  fromJSON (json) {
    this.buf = json.buf ? new Buffer(json.buf, 'hex') : undefined
    this.hash = json.hash ? new Buffer(json.hash, 'hex') : undefined
    return this
  }
}

module.exports = Secret
