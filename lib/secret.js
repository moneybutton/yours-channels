'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Hash = require('yours-bitcoin/lib/hash')
let Random = require('yours-bitcoin/lib/random')

function Secret (buf, hash) {
  if (!(this instanceof Secret)) {
    return new Secret(buf, hash)
  }
  this.fromObject({buf, hash})
}

Secret.prototype = Object.create(Struct.prototype)
Secret.prototype.constructor = Secret

Secret.prototype.generateBuf = function () {
  this.buf = Random.getRandomBuffer(32)
}

Secret.prototype.asyncGenerateHash = function () {
  return asink(function *() {
    if (!this.buf) {
      return new Error('buffer must be generated before hash can be')
    }
    this.hash = yield Hash.asyncSha256Ripemd160(this.buf)
  }, this)
}

Secret.prototype.asyncCheck = function () {
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
Secret.prototype.hidden = function () {
  if (!this.hash) {
    throw new Error('hash must be set before secret can be hidden')
  }
  return new Secret(null, this.hash)
}

module.exports = Secret
