/* global describe,it */
'use strict'
let should = require('should')
let Sender = require('../lib/sender.js')
let asink = require('asink')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let BN = require('fullnode/lib/bn')

describe('Sender', function () {
  // generate data to initialize an agent
  let privkey = Privkey().fromBN(BN(30))
//  let privkey = Privkey().fromRandom()
//  let pubkey = Pubkey().fromPrivkey(privkey)
//  let address = Address().fromPubkey(pubkey)
  let msPrivkey = Privkey().fromBN(BN(40))
//  let msPubkey = Pubkey().fromPrivkey(msPrivkey)

  // generate data to initialize another agent (first cnlbuilder will need some of this data too)
  let otherPrivkey = Privkey().fromBN(BN(60))
  let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)
  let otherAddress = Address().fromPubkey(otherPubkey)
  let otherMsPrivkey = Privkey().fromBN(BN(50))
  let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

  it('should exist', function () {
    should.exist(Sender)
    should.exist(new Sender())
    should.exist(Sender())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let sender = Sender()
      should.exist(sender.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let sender = Sender(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield sender.asyncInitialize()
        should.exist(sender.pubkey)
        should.exist(sender.address)
        should.exist(sender.keypair)
        should.exist(sender.msPubkey)
        should.exist(sender.msScript)
        should.exist(sender.msAddress)
        sender.initialized.should.equal(true)
      }, this)
    })
  })
})
