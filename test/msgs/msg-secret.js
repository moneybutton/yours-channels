/* global describe,it */
'use strict'
let Hash = require('yours-bitcoin/lib/hash')
let MsgSecret = require('../../lib/msgs/msg-secret')
let Address = require('yours-bitcoin/lib/address')
let Script = require('yours-bitcoin/lib/script')
let Random = require('yours-bitcoin/lib/random')
let asink = require('asink')
let should = require('should')

describe('MsgSecret', function () {
  it('should exist', function () {
    should.exist(MsgSecret)
    should.exist(new MsgSecret())
  })

  describe('#constructor', function () {
    it('should create a new secret message', function () {
      let msg = new MsgSecret()
      msg.cmd.should.equal('secret')
    })
  })

  describe('#setSecret', function () {
    it('should set this secret', function () {
      let secretBuf = Random.getRandomBuffer(32)
      let hashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret(secretBuf, hashBuf)
      should.exist(msg.args.secret)
      should.exist(msg.args.hash)
    })
  })

  describe('#getSecret', function () {
    it('should return a secret', function () {
      let secretBuf = Random.getRandomBuffer(32)
      let hashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret(secretBuf, hashBuf)
      let secretBuf2 = msg.getSecret()
      Buffer.compare(secretBuf, secretBuf2).should.equal(0)
    })
  })

  describe('#getSecretHash', function () {
    it('should return a secret', function () {
      let secretBuf = Random.getRandomBuffer(32)
      let hashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret(secretBuf, hashBuf)
      let hashBuf2 = msg.getSecretHash()
      Buffer.compare(hashBuf, hashBuf2).should.equal(0)
    })
  })

  describe('#asyncIsValid', function () {
    it('should know this is a valid secret msg', function () {
      return asink(function * () {
        let secretBuf = Random.getRandomBuffer(32)
        let hashBuf = Hash.sha256Ripemd160(secretBuf)
        let msg = new MsgSecret()
        let chanId = Address.fromRedeemScript(Script.fromString('OP_RETURN')).toString()
        msg.setChanId(chanId)
        msg.setSecret(secretBuf, hashBuf)
        let isValid = yield msg.asyncIsValid()
        isValid.should.equal(true)
      }, this)
    })
  })
})
