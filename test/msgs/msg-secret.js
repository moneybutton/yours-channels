/* global describe,it */
'use strict'
let MsgSecret = require('../../lib/msgs/msg-secret')
let Hash = require('yours-bitcoin/lib/hash')
let Random = require('yours-bitcoin/lib/random')
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
      let secretHashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret('HTLC', secretBuf, secretHashBuf)
      should.exist(msg.args.type)
      should.exist(msg.args.secret)
      should.exist(msg.args.secretHash)
    })
  })

  describe('#getSecret', function () {
    it('should return a secret', function () {
      let secretBuf = Random.getRandomBuffer(32)
      let secretHashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret('HTLC', secretBuf, secretHashBuf)
      let secretBuf2 = msg.getSecret()
      Buffer.compare(secretBuf, secretBuf2).should.equal(0)
    })
  })

  describe('#getSecretHash', function () {
    it('should return a secret', function () {
      let secretBuf = Random.getRandomBuffer(32)
      let secretHashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret('HTLC', secretBuf, secretHashBuf)
      let secretHashBuf2 = msg.getSecretHash()
      Buffer.compare(secretHashBuf, secretHashBuf2).should.equal(0)
    })
  })

  describe('#getType', function () {
    it('should return a secret', function () {
      let secretBuf = Random.getRandomBuffer(32)
      let secretHashBuf = Hash.sha256Ripemd160(secretBuf)
      let msg = new MsgSecret()
      msg.setSecret('HTLC', secretBuf, secretHashBuf)
      let type = msg.getType()
      type.should.equal('HTLC')
    })
  })
})
