'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')

function Multisig (privKey, pubKey, otherPubKey, script, address, keyPair) {
  if (!(this instanceof Multisig)) {
    return new Multisig(privKey, pubKey, otherPubKey, script, address, keyPair)
  }
  this.fromObject({privKey, pubKey, otherPubKey, script, address, keyPair})
}

Multisig.prototype = Object.create(Struct.prototype)
Multisig.prototype.constructor = Multisig

Multisig.prototype.asyncInitialize = function (otherPubKey) {
  return asink(function *() {
    if (!this.privKey || this.privKey.constructor.name !== 'PrivKey') {
      throw new Error('this.privKey must be set before multisig can be initialized')
    }
    if (!otherPubKey || otherPubKey.constructor.name !== 'PubKey') {
      throw new Error('otherPubKey required to build a multisig')
    }
    this.otherPubKey = otherPubKey
    this.pubKey = yield PubKey.asyncFromPrivKey(this.privKey)
    this.pubKeys = [this.pubKey, this.otherPubKey]
    this.pubKeys.sort()

    this.script = Script.fromPubKeys(2, this.pubKeys)
    this.address = yield Address.asyncFromRedeemScript(this.script)
    this.keyPair = yield KeyPair.asyncFromPrivKey(this.privKey)

    this.initialized = true
  }, this)
}

module.exports = Multisig
