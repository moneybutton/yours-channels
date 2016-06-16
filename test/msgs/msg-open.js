/* global describe,it */
'use strict'
let Bn = require('yours-bitcoin/lib/bn')
let Bip32 = require('yours-bitcoin/lib/bip-32')
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

  describe('#asyncSetXPub', function () {
    it('should set the xPub', function () {
      return asink(function * () {
        let bip32 = Bip32.fromRandom()
        let msg = new MsgOpen()
        yield msg.asyncSetXPub(bip32)
        should.exist(msg.args.xPub)
      }, this)
    })
  })

  describe('#asyncGetXPub', function () {
    it('should get the xPub from this msg', function () {
      return asink(function * () {
        let bip32 = Bip32.fromRandom()
        let msg = new MsgOpen()
        yield msg.asyncSetXPub(bip32)
        let bip32b = yield msg.asyncGetXPub()
        bip32.toPublic().toString().should.equal(bip32b.toString())
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
