/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Script = require('fullnode/lib/script')
let Txout = require('fullnode/lib/txout')
let Address = require('fullnode/lib/address')
let BN = require('fullnode/lib/bn')

let Agent = require('../lib/agent.js')
let Protocol = require('../lib/protocol.js')

describe('Protocol', function () {
  let privkey = Privkey().fromRandom()
  let pubkey = Pubkey().fromPrivkey(privkey)
  let address = Address().fromPubkey(pubkey)
  let msPrivkey = Privkey().fromRandom()
//  let msPubkey = Pubkey().fromPrivkey(msPrivkey)

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
    it('asyncInitialize should initialize agent and genereate secrets', function () {
      return asink(function *() {
        let agent = Agent()
        let protocol = Protocol(agent)
        yield protocol.asyncInitialize(privkey, msPrivkey)

        protocol.agent.initialized.should.equal(true)
        should.exist(protocol.agent.revocationSecret)
        should.exist(protocol.agent.htlcSecret)
      }, this)
    })
  })

  describe('#openChannel', function () {
    it('openChannel should store the other agents addeses and build a multisig address', function () {
      return asink(function *() {
        let agent = Agent()
        let protocol = Protocol(agent)
        yield protocol.asyncInitialize(privkey, msPrivkey)
        yield protocol.openChannel(otherPubkey, otherMsPubkey)

        should.exist(protocol.agent.multisig)
        should.exist(protocol.agent.revocationSecret)
        should.exist(protocol.agent.htlcSecret)
      }, this)
    })
  })

  describe('#createFundingTx', function () {
    it('createFundingTx should create a funding transaction', function () {
      return asink(function *() {
        let agent = Agent()
        let protocol = Protocol(agent)
        yield protocol.asyncInitialize(privkey, msPrivkey)
        yield protocol.openChannel(otherPubkey, otherMsPubkey)

        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)
        yield protocol.createFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)

        should.exist(protocol.agent.fundingTx)
        should.exist(protocol.agent.fundingTxhashbuf)
        should.exist(protocol.agent.fundingTxout)
      }, this)
    })
  })
})
