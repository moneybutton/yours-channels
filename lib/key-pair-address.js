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
    return {
//      privKey: this.privKey.toHex(),
      keyPair: this.keyPair.toHex(),
      address: this.address.toHex(),
      initialized: this.initialized
    }
  }

  fromJson (json) {
    this.fromObject({
//      privKey: PrivKey.fromHex(json.privKey),
      keyPair: KeyPair.fromHex(json.keyPair),
      address: Address.fromHex(json.address),
      initialized: json.initialized
    })
    return this
  }

  toPublic () {
    let keyPairAddress = new KeyPairAddress().fromObject(this)
    keyPairAddress.keyPair = this.keyPair.toPublic()
//    keyPairAddress.address = new Address().toPublic(this.address)
//    keyPairAddress.initialized = this.initialized
    return keyPairAddress
  }

}

module.exports = KeyPairAddress
