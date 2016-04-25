/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Multisig = require('../lib/multisig.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')

describe('Multisig', function () {
  let privkey0 = Privkey().fromRandom()
  let pubkey0 = Pubkey().fromPrivkey(privkey0)

  let privkey1 = Privkey().fromRandom()
  let pubkey1 = Pubkey().fromPrivkey(privkey1)

  it('should exist', function () {
    should.exist(Multisig)
    should.exist(new Multisig())
    should.exist(Multisig())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let multisig = Multisig()
      should.exist(multisig.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let multisig = Multisig()
        yield multisig.asyncInitialize(privkey0, pubkey0, pubkey1)
        should.exist(multisig.privkey)
        should.exist(multisig.pubkeys)
        should.exist(multisig.script)
        should.exist(multisig.address)
        should.exist(multisig.keypair)
        multisig.initialized.should.equal(true)
      }, this)
    })
  })
})
