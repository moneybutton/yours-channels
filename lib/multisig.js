'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')

class Multisig extends Struct {
  constructor (privKey, pubKey, otherPubKey, script, address, keyPair) {
    super()
    this.fromObject({privKey, pubKey, otherPubKey, script, address, keyPair})
  }

  initializePrivKey (privKey) {
    return asink(function *() {
      this.privKey = privKey
      this.pubKey = yield PubKey.asyncFromPrivKey(privKey)
    }, this)
  }

  asyncInitialize (otherPubKey) {
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
      // this.pubKeys.sort()

      this.script = Script.fromPubKeys(2, this.pubKeys)
      this.address = yield Address.asyncFromRedeemScript(this.script)
      this.keyPair = yield KeyPair.asyncFromPrivKey(this.privKey)

      this.initialized = true
    }, this)
  }

  toJSON () {
    return JSON.stringify(this)
  }

  fromJson (json) {
    if (json.privKey) {
      this.privKey = PrivKey.fromHex(json.privKey)
    }
    if (json.pubKey) {
      this.pubKey = PubKey.fromFastHex(json.pubKey)
    }
    if (json.otherPubKey) {
      this.otherPubKey = PubKey.fromFastHex(json.otherPubKey)
    }
    if (json.script) { //
      this.script = Script.fromHex(json.script)
    }
    if (json.address) {
      this.address = Address.fromHex(json.address)
    }
    if (json.keyPair) {
      this.keyPair = KeyPair.fromHex(json.keyPair)
    }
    if (typeof json.initialized !== undefined) {
      this.initialized = json.initialized
    }
    if (json.pubKeys) {
      let pubKeys = []
      json.pubKeys.forEach(function (pubKey) {
        pubKeys.push(PubKey.fromFastHex(pubKey))
      })
      this.pubKeys = pubKeys
    }
    return this
  }

  toPublic () {
    let multisig = new Multisig().fromObject(this)
    multisig.privKey = undefined
    if (this.keyPair) {
      multisig.keyPair = this.keyPair.toPublic()
    }
    return multisig
  }
}

module.exports = Multisig
