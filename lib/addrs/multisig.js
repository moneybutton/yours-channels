'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')

class Multisig extends Struct {
  constructor (privKey,
    pubKey,
    otherPubKey,
    pubKeys,
    script,
    address,
    keyPair,
    initialized
  ) {
    super()
    this.fromObject({privKey,
      pubKey,
      otherPubKey,
      pubKeys,
      script,
      address,
      keyPair,
      initialized
    })
  }

  initializePrivKey (privKey) {
    return asink(function * () {
      this.privKey = privKey
      this.pubKey = yield PubKey.asyncFromPrivKey(privKey)
    }, this)
  }

  asyncInitialize (otherPubKey) {
    return asink(function * () {
      if (!this.privKey || this.privKey.constructor.name !== 'PrivKey') {
        throw new Error('this.privKey must be set before multisigAddress can be initialized')
      }
      if (!otherPubKey || otherPubKey.constructor.name !== 'PubKey') {
        throw new Error('otherPubKey required to build a multisigAddress')
      }
      this.otherPubKey = otherPubKey
      this.pubKey = yield PubKey.asyncFromPrivKey(this.privKey)

      this.pubKeys = [this.pubKey, this.otherPubKey]
      this.script = Script.fromPubKeys(2, this.pubKeys)
      this.address = yield Address.asyncFromRedeemScript(this.script)
      this.keyPair = yield KeyPair.asyncFromPrivKey(this.privKey)

      this.initialized = true
    }, this)
  }

  fromJSON (json) {
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
      this.address = Address.fromJSON(json.address)
    }
    if (json.keyPair) {
      this.keyPair = KeyPair.fromJSON(json.keyPair)
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
    let multisigAddress = new Multisig().fromObject(this)
    multisigAddress.privKey = undefined
    if (this.keyPair) {
      multisigAddress.keyPair = this.keyPair.toPublic()
    }
    return multisigAddress
  }
}

module.exports = Multisig
