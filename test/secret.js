/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Secret = require('../lib/secret.js')
let Hash = require('fullnode/lib/hash')

describe('Secret', function () {
  it('should exist', function () {
    should.exist(Secret)
    should.exist(new Secret())
    should.exist(Secret())
  })

  describe('#setBuffer', function () {
    it('setBuffer should set a secret', function () {
      return asink(function *() {
        let secret = Secret()
        secret.setBuffer(new Buffer('abc'))
        should.exist(secret.buf)
      }, this)
    })
  })

  describe('#setHash', function () {
    it('setHash should set a secret', function () {
      return asink(function *() {
        let secret = Secret()
        secret.setHash(new Buffer('hash'))
        should.exist(secret.hash)
      }, this)
    })
  })

  describe('#asyncCheck', function () {
    it('asyncCheck should check if buf hashes to hash', function () {
      return asink(function *() {
        let secret = Secret()
        let buf = new Buffer('abc')
        let hashedBuf = yield Hash.asyncSha256ripemd160(buf)

        secret.setBuffer(buf)
        secret.setHash(hashedBuf)
        let result = yield secret.asyncCheck()
        result.should.equal(true)
      }, this)
    })
  })
})
