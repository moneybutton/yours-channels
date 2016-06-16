/* global describe,it */
'use strict'
let Bip32 = require('yours-bitcoin/lib/bip-32')
let MsgOpenRes = require('../../lib/msgs/msg-open-res')
let asink = require('asink')
let should = require('should')

describe('MsgOpenRes', function () {
  it('should exist', function () {
    should.exist(MsgOpenRes)
    should.exist(new MsgOpenRes())
  })

  describe('#constructor', function () {
    it('should set the default command name', function () {
      let msg = new MsgOpenRes()
      msg.cmd.should.equal('open-res')
    })
  })

  describe('#asyncSetXPub', function () {
    it('should set the xPub', function () {
      return asink(function * () {
        let bip32 = Bip32.fromRandom()
        let msg = new MsgOpenRes()
        yield msg.asyncSetXPub(bip32)
        should.exist(msg.args.xPub)
      }, this)
    })
  })

  describe('#asyncGetXPub', function () {
    it('should get the xPub from this msg', function () {
      return asink(function * () {
        let bip32 = Bip32.fromRandom()
        let msg = new MsgOpenRes()
        yield msg.asyncSetXPub(bip32)
        let bip32b = yield msg.asyncGetXPub()
        bip32.toPublic().toString().should.equal(bip32b.toString())
      }, this)
    })
  })
})
