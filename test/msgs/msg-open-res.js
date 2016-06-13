/* global describe,it */
'use strict'
let KeyPair = require('yours-bitcoin/lib/key-pair')
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

  describe('#setPubKey', function () {
    it('should set the pubKey', function () {
      let pubKey = KeyPair.fromRandom().pubKey
      let msg = new MsgOpenRes()
      msg.setPubKey(pubKey)
      should.exist(msg.args.pubKey)
    })
  })

  describe('#asyncGetPubKey', function () {
    it('should get the pubKey from this msg', function () {
      return asink(function * () {
        let pubKey = KeyPair.fromRandom().pubKey
        let msg = new MsgOpenRes()
        msg.setPubKey(pubKey)
        let pubKey2 = yield msg.asyncGetPubKey()
        pubKey2.toString().should.equal(pubKey.toString())
      }, this)
    })
  })
})
