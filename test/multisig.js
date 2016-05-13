/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Multisig = require('../lib/multisig.js')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')

describe('Multisig', function () {
  let privKey = PrivKey.fromRandom()
  let pubKey = PubKey.fromPrivKey(privKey)

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
        let multisig = new Multisig(privKey)
        yield multisig.asyncInitialize(pubKey)
        should.exist(multisig.privKey)
        should.exist(multisig.pubKeys)
        should.exist(multisig.script)
        should.exist(multisig.address)
        should.exist(multisig.keyPair)
        multisig.initialized.should.equal(true)
      }, this)
    })
  })
})
