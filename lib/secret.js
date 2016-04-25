'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')
let Hash = require('fullnode/lib/hash')

function Secret (privkey, pubkey, otherPubkey, script, address, keypair) {
  if (!(this instanceof Secret)) {
    return new Secret(privkey, pubkey, otherPubkey, script, address, keypair)
  }
  this.fromObject({privkey, pubkey, otherPubkey, script, address, keypair})
}

Secret.prototype = Object.create(Struct.prototype)
Secret.prototype.constructor = Secret

Secret.prototype.setBuffer = function (buf) {
  this.buf = buf
}

Secret.prototype.setHash = function (hash) {
  this.hash = hash
}

Secret.prototype.asyncCheck = function () {
  return asink(function *() {
    if (!this.buf) {
      throw new Error('secret must be set before it can be checked')
    }
    if (!this.hash) {
      throw new Error('hash must be set before secret can be checked')
    }
    let hashedBuf = yield Hash.asyncSha256ripemd160(this.buf)

    return hashedBuf.equals(this.hash)
  }, this)
}

module.exports = Secret
