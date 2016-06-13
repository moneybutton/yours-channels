/* global describe,it */
'use strict'
let Bn = require('yours-bitcoin/lib/bn')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let MsgOpen = require('../../lib/msgs/msg-open')
let asink = require('asink')
let should = require('should')

describe('MsgOpen', function () {
  it('should exist', function () {
    should.exist(MsgOpen)
    should.exist(new MsgOpen())
  })

  describe('#constructor', function () {
    it('should set the default command name', function () {
      let msg = new MsgOpen()
      msg.cmd.should.equal('open')
    })
  })

  describe('#setPubKey', function () {
    it('should set the pubKey', function () {
      let pubKey = KeyPair.fromRandom().pubKey
      let msg = new MsgOpen()
      msg.setPubKey(pubKey)
      should.exist(msg.args.pubKey)
    })
  })

  describe('#asyncGetPubKey', function () {
    it('should get the pubKey from this msg', function () {
      return asink(function * () {
        let pubKey = KeyPair.fromRandom().pubKey
        let msg = new MsgOpen()
        msg.setPubKey(pubKey)
        let pubKey2 = yield msg.asyncGetPubKey()
        pubKey2.toString().should.equal(pubKey.toString())
      }, this)
    })
  })

  describe('#setAmount', function () {
    it('should set the amount', function () {
      let amount = Bn(1e8)
      let msg = new MsgOpen()
      msg.setAmount(amount)
      should.exist(msg.args.amount)
    })
  })

  describe('#getAmount', function () {
    it('should get the amount from this msg', function () {
      return asink(function * () {
        let amount = Bn(1e8)
        let msg = new MsgOpen()
        msg.setAmount(amount)
        let amount2 = msg.getAmount()
        amount2.eq(amount).should.equal(true)
      }, this)
    })
  })
})
