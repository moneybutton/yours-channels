/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')

let Agent = require('../lib/agent.js')
let Protocol = require('../lib/protocol.js')

describe('Protocol', function () {
  let privkey = Privkey().fromRandom()
  // let pubkey = Pubkey().fromPrivkey(privkey)
  // let address = Address().fromPubkey(pubkey)
  let msPrivkey = Privkey().fromRandom()
  // let msPubkey = Pubkey().fromPrivkey(msPrivkey)

  let otherPrivkey = Privkey().fromRandom()
  let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)
  let otherMsPrivkey = Privkey().fromRandom()
  let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

  it('should exist', function () {
    should.exist(Protocol)
    should.exist(new Protocol())
    should.exist(Protocol())
  })

  describe('#asyncOpenChannel', function () {
    it('asyncOpenChannel should store the other agents addeses and build a multisig address', function () {
      return asink(function *() {
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        let protocol = Protocol(agent)
        yield protocol.asyncOpenChannel(otherPubkey, otherMsPubkey)
        should.exist(protocol.agent.other)
        should.exist(protocol.agent.multisig)
      }, this)
    })
  })
})
