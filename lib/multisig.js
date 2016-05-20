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
      this.pubKeys.sort()

      this.script = Script.fromPubKeys(2, this.pubKeys)
      this.address = yield Address.asyncFromRedeemScript(this.script)
      this.keyPair = yield KeyPair.asyncFromPrivKey(this.privKey)

      this.initialized = true
    }, this)
  }

  toJson () {
    let pubKeys = []
    this.pubKeys.forEach(function (pubKey) {
      pubKeys.push(pubKey.toJson())
    })
    return {
      privKey: this.privKey.toHex(),
      otherPubKey: this.otherPubKey.toFastBuffer(),
      pubKey: this.pubKey.toFastBuffer(),
      pubKeys: pubKeys,
      script: this.script.toHex(),
      address: this.address.toHex(),
      keyPair: this.keyPair.toHex(),
      initialized: this.initialized
    }
  }

  fromJson (json) {
    this.fromObject({
      privKey: PrivKey.fromHex(json.privKey),
      otherPubKey: PubKey.fromFastBuffer(json.otherPubKey),
      pubKey: PubKey.fromFastBuffer(json.pubKey),
      pubKeys: json.pubKeys,
      script: Script.fromHex(json.script),
      address: Address.fromHex(json.address),
      keyPair: KeyPair.fromHex(json.keyPair),
      initialized: json.initialized
    })
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
