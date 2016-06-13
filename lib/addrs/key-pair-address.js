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
    return asink(function * () {
      if (!privKey || privKey.constructor.name !== 'PrivKey') {
        throw new Error('this.privKey must be set before multisigAddress can be initialized')
      }
      this.keyPair = yield KeyPair.asyncFromPrivKey(privKey)
      this.address = yield Address.asyncFromPubKey(this.keyPair.pubKey)

      this.initialized = true
    }, this)
  }

  fromJSON (json) {
    this.keyPair = json.keyPair ? KeyPair.fromJSON(json.keyPair) : undefined
    this.address = json.address ? Address.fromJSON(json.address) : undefined
    this.initialized = json.initialized
    return this
  }

  toPublic () {
    let keyPairAddress = new KeyPairAddress()
    keyPairAddress.keyPair = this.keyPair ? this.keyPair.toPublic() : undefined
    keyPairAddress.address = this.address
    keyPairAddress.initialized = this.initialized
    return keyPairAddress
  }

}

module.exports = KeyPairAddress
