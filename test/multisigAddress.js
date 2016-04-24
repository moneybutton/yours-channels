/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let MultisigAddress = require('../lib/multisigAddress.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')

describe('MultisigAddress', function () {

  let privkey0 = Privkey().fromRandom()
  let pubkey0 = Pubkey().fromPrivkey(privkey0)

  let privkey1 = Privkey().fromRandom()
  let pubkey1 = Pubkey().fromPrivkey(privkey1)

  it('should exist', function () {
    should.exist(MultisigAddress)
    should.exist(new MultisigAddress())
    should.exist(MultisigAddress())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let multisigAddress = MultisigAddress()
      should.exist(multisigAddress.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let multisigAddress = MultisigAddress()
        yield multisigAddress.asyncInitialize(privkey0, pubkey0, pubkey1)
        should.exist(multisigAddress.privkey)
        should.exist(multisigAddress.pubkeys)
        should.exist(multisigAddress.script)
        should.exist(multisigAddress.address)
        should.exist(multisigAddress.keypair)
        multisigAddress.initialized.should.equal(true)
      }, this)
    })
  })
})
