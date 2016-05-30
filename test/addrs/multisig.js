/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Multisig = require('../../lib/addrs/multisig.js')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')

describe('Multisig', function () {
  it('should exist', function () {
    should.exist(Multisig)
    should.exist(new Multisig())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let multisig = new Multisig()
      should.exist(multisig.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())
        yield multisig.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))
        should.exist(multisig.privKey)
        should.exist(multisig.pubKeys)
        should.exist(multisig.script)
        should.exist(multisig.address)
        should.exist(multisig.keyPair)
        multisig.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#toJSON', function () {
    it('toJSON should convert into a json object after creation', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())
        yield multisig.initializePrivKey(PrivKey.fromRandom())
        let unInitializedJson = multisig.toJSON()
        should.exist(unInitializedJson.privKey)
        should.exist(unInitializedJson.pubKey)
      }, this)
    })

    it('toJSON should convert into a json object after initializePrivKey', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())
        yield multisig.initializePrivKey(PrivKey.fromRandom())
        let unInitializedJson = multisig.toJSON()
        should.exist(unInitializedJson.privKey)
        should.exist(unInitializedJson.pubKey)
      }, this)
    })

    it('toJSON should convert into a json object after asyncInitialize', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())

        yield multisig.initializePrivKey(PrivKey.fromRandom())
        yield multisig.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))
        let initializedJson = multisig.toJSON()
        initializedJson.initialized.should.equal(true)
        should.exist(initializedJson.privKey)
        should.exist(initializedJson.pubKeys)
        should.exist(initializedJson.script)
        should.exist(initializedJson.address)
        should.exist(initializedJson.keyPair)
      }, this)
    })

    it('toJSON should convert into a json object after toPublic', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())

        yield multisig.initializePrivKey(PrivKey.fromRandom())
        yield multisig.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))

        let publicMultisig = multisig.toPublic()
        let publicMultisigJson = publicMultisig.toJSON()

        publicMultisigJson.initialized.should.equal(true)
        should.not.exist(publicMultisigJson.privKey)
        should.exist(publicMultisigJson.pubKeys)
        should.exist(publicMultisigJson.pubKeys[0])
        should.exist(publicMultisigJson.pubKeys[1])
        should.exist(publicMultisigJson.script)
        should.exist(publicMultisigJson.address)
        should.exist(publicMultisigJson.keyPair)
      }, this)
    })
  })

  describe('#fromJSON', function () {
    it('fromJSON should convert from a json object', function () {
      return asink(function *() {
        let multisigObj = new Multisig(PrivKey.fromRandom())
        yield multisigObj.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))
        let json = multisigObj.toJSON()
        let multisig = new Multisig().fromJSON(json)
        // TODO this should pass in the future
        // JSON.stringify(multisig).should.equal(JSON.stringify(multisigObj))
        should.exist(multisig.privKey)
        should.exist(multisig.pubKeys)
        should.exist(multisig.script)
        should.exist(multisig.address)
        should.exist(multisig.keyPair)
        multisig.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('should convert to a public object', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())
        yield multisig.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))

        let publicMultisig = multisig.toPublic()

        should.not.exist(publicMultisig.privKey)
        should.exist(publicMultisig.otherPubKey)
        should.exist(publicMultisig.pubKey)
        should.exist(publicMultisig.pubKeys)
        should.exist(publicMultisig.script)
        should.exist(publicMultisig.address)
        should.exist(publicMultisig.keyPair)
        should.not.exist(publicMultisig.keyPair.privKey)
      }, this)
    })
  })
})
