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
    return asink(function *() {
      this.generateBuf()
      yield this.asyncGenerateHash()
    }, this)
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

  toJson () {
    let json = {}
    if (this.buf) {
      json.buf = this.buf
    }
    if (this.hash) {
      json.hash = this.hash
    }
    return json
  }

  fromJson (json) {
    if (json.buf) {
      this.buf = json.buf
    }
    if (json.hash) {
      this.hash = json.hash
    }
    return this
  }

  toString () {
    let obj = {}
    if (this.buf) {
      obj.buf = this.buf.toString('hex')
    }
    if (this.hash) {
      obj.hash = this.hash.toString('hex')
    }
    return JSON.stringify(obj)
  }
}

module.exports = Secret
