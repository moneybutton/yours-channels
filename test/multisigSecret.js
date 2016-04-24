/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let MultisigSecret = require('../lib/multisigSecret.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')

describe('MultisigSecret', function () {
  let privkey0 = Privkey().fromRandom()
  let pubkey0 = Pubkey().fromPrivkey(privkey0)

  let privkey1 = Privkey().fromRandom()
  let pubkey1 = Pubkey().fromPrivkey(privkey1)

  it('should exist', function () {
    should.exist(MultisigSecret)
    should.exist(new MultisigSecret())
    should.exist(MultisigSecret())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let multisigSecret = MultisigSecret()
      should.exist(multisigSecret.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let multisigSecret = MultisigSecret()
        yield multisigSecret.asyncInitialize(privkey0, pubkey0, pubkey1)
        should.exist(multisigSecret.privkey)
        should.exist(multisigSecret.pubkeys)
        should.exist(multisigSecret.script)
        should.exist(multisigSecret.address)
        should.exist(multisigSecret.keypair)
        multisigSecret.initialized.should.equal(true)
      }, this)
    })
  })
})
