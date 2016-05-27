/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let KeyPairAddress = require('../lib/key-pair-address.js')
let PrivKey = require('yours-bitcoin/lib/priv-key')

describe('KeyPairAddress', function () {
  it('should exist', function () {
    should.exist(KeyPairAddress)
    should.exist(new KeyPairAddress())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let keyPairAddress = new KeyPairAddress()
      should.exist(keyPairAddress.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let keyPairAddress = new KeyPairAddress()
        yield keyPairAddress.asyncInitialize(PrivKey.fromRandom())
        should.exist(keyPairAddress.keyPair)
        should.exist(keyPairAddress.address)
      }, this)
    })
  })

  describe('#toJSON', function () {
    it.skip('toJSON should convert into a json object', function () {
      return asink(function *() {
        let keyPairAddress = new KeyPairAddress()
        yield keyPairAddress.asyncInitialize(PrivKey.fromRandom())
        let json = keyPairAddress.toJSON()

        should.exist(json.address)
        should.exist(json.keyPair)
        json.initialized.should.equal(true)

        let publicKeyPairAddress = keyPairAddress.toPublic()
        let publicJson = publicKeyPairAddress.toJSON()
        should.exist(publicJson.address)
        should.exist(publicJson.keyPair)
        should.exist(publicJson.keyPair.pubKey)
        should.not.exist(publicJson.keyPair.privKey)
        publicJson.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#fromJson', function () {
    it.skip('fromJson should convert from a json object', function () {
      return asink(function *() {
        let keyPairAddressObj = new KeyPairAddress()
        yield keyPairAddressObj.asyncInitialize(PrivKey.fromRandom())
        let json = keyPairAddressObj.toJSON()
        let keyPairAddress = new KeyPairAddress().fromJson(json)

        should.exist(keyPairAddress.address)
        should.exist(keyPairAddress.keyPair)
        keyPairAddress.initialized.should.equal(true)
      }, this)
    })
  })
})
