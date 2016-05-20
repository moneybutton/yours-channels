/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Multisig = require('../lib/multisig.js')
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

  describe('#toJson', function () {
    it('toJson should convert into a json object', function () {
      return asink(function *() {
        let multisig = new Multisig(PrivKey.fromRandom())
        yield multisig.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))
        let json = multisig.toJson()
        should.exist(json.privKey)
        should.exist(json.pubKeys)
        should.exist(json.script)
        should.exist(json.address)
        should.exist(json.keyPair)
        json.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#fromJson', function () {
    it('fromJson should convert from a json object', function () {
      return asink(function *() {
        let multisigObj = new Multisig(PrivKey.fromRandom())
        yield multisigObj.asyncInitialize(PubKey.fromPrivKey(PrivKey.fromRandom()))
        let json = multisigObj.toJson()
        let multisig = new Multisig().fromJson(json)

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
