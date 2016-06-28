/* global describe,it */
'use strict'
let MsgSecrets = require('../../lib/msgs/msg-secrets')
let Secret = require('../../lib/scrts/secret')
let asink = require('asink')
let should = require('should')

describe('MsgSecrets', function () {
  it('should exist', function () {
    should.exist(MsgSecrets)
    should.exist(new MsgSecrets())
  })

  describe('#constructor', function () {
    it('should create a new secret message', function () {
      let msg = new MsgSecrets()
      msg.cmd.should.equal('secret')
    })
  })

  describe('#setSecrets', function () {
    it('should set this secret', function () {
      return asink(function * () {
        let secret = yield new Secret().asyncInitialize()
        let msg = new MsgSecrets()
        msg.setSecrets([secret])
        should.exist(msg.args.secrets)
      }, this)
    })
  })

  describe('#getSecrets', function () {
    it('should return a secret', function () {
      return asink(function * () {
        let secret = yield new Secret().asyncInitialize()
        let msg = new MsgSecrets()
        msg.setSecrets([secret])
        let secrets = msg.getSecrets()
        secrets.length.should.equal(1)
        secrets[0].toJSON().buf.should.equal(secret.toJSON().buf)
      }, this)
    })
  })
})
