'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')

class KeyPairAddress extends Struct {
  constructor (privKey, keyPair, address) {
    super()
    this.fromObject({privKey, keyPair, address})
  }

  asyncInitialize (privKey) {
    return asink(function *() {
      if (!privKey || privKey.constructor.name !== 'PrivKey') {
        throw new Error('this.privKey must be set before multisig can be initialized')
      }
//      this.privKey = privKey
      this.keyPair = yield KeyPair.asyncFromPrivKey(privKey)
      this.address = yield Address.asyncFromPubKey(this.keyPair.pubKey)

      this.initialized = true
    }, this)
  }

  toJson () {
    let json = {}
    if (this.keyPair && this.keyPair !== undefined) {
      json.keyPair = this.keyPair.toJson()
    }
    if (this.address && this.address !== undefined) {
      json.address = this.address.toHex()
    }
    if (typeof this.initialized !== undefined && this.initialized !== undefined) {
      json.initialized = this.initialized
    }
    return json
  }

  fromJson (json) {
    if (json.keyPair) {
      this.keyPair = KeyPair.fromJson(json.keyPair)
    }
    if (json.address) {
      this.address = Address.fromHex(json.address)
    }
    if (typeof json.initialized !== undefined) {
      this.initialized = json.initialized
    }
    return this
  }

  toPublic () {
    let keyPairAddress = new KeyPairAddress().fromObject(this)
    if (this.keyPair && this.keyPair !== undefined) {
      keyPairAddress.keyPair = this.keyPair.toPublic()
    }
    return keyPairAddress
  }

}

module.exports = KeyPairAddress
