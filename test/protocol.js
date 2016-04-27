/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Protocol = require('../lib/protocol.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')

let Agent = require('../lib/agent.js')

describe('Protocol', function () {
  let privkey = Privkey().fromRandom()
  let pubkey = Pubkey().fromPrivkey(privkey)
  let msPrivkey = Privkey().fromRandom()
  let msPubkey = Pubkey().fromPrivkey(msPrivkey)

  let otherPrivkey = Privkey().fromRandom()
  let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)
  let otherMsPrivkey = Privkey().fromRandom()
  let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

  it('should exist', function () {
    should.exist(Protocol)
    should.exist(new Protocol())
    should.exist(Protocol())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let agent = Agent()
      should.exist(agent.asyncInitialize)
    })

    it('asyncInitialize should initialize agent and genereate secrets', function () {
      return asink(function *() {
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        should.exist(agent.privkey)
        should.exist(agent.pubkey)
        should.exist(agent.address)
        should.exist(agent.keypair)

        agent.initialized.should.equal(true)
      }, this)
    })
  })
})
