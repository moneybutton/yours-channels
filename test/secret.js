/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Secret = require('../lib/secret.js')
// let Hash = require('fullnode/lib/hash')

describe('Secret', function () {
  it('should exist', function () {
    should.exist(Secret)
    should.exist(new Secret())
    should.exist(Secret())
  })

  describe('#generateBuf', function () {
    it('generateBuf should generate a buffer', function () {
      return asink(function *() {
        let secret = Secret()
        secret.generateBuf()
        should.exist(secret.buf)
      }, this)
    })
  })

  describe('#asyncGenerateHash', function () {
    it('asyncGenerateHash should generate a hash', function () {
      return asink(function *() {
        let secret = Secret()
        secret.generateBuf()
        should.exist(secret.buf)
        yield secret.asyncGenerateHash()
        should.exist(secret.hash)
      }, this)
    })
  })

  describe('#asyncCheck', function () {
    it('asyncCheck should check if buf hashes to hash', function () {
      return asink(function *() {
        let secret = Secret()
        secret.generateBuf()
        should.exist(secret.buf)
        yield secret.asyncGenerateHash()
        should.exist(secret.hash)
        let result = yield secret.asyncCheck()
        result.should.equal(true)
      }, this)
    })
  })

  describe('#hidden', function () {
    it('hidden should remove the buf from a secret', function () {
      return asink(function *() {
        let secret = Secret()
        secret.generateBuf()
        should.exist(secret.buf)
        yield secret.asyncGenerateHash()
        should.exist(secret.hash)
        let hiddenSecret = secret.hidden()

        // secret should not change
        should.exist(secret.buf)
        should.exist(secret.hash)

        // hiddenSecret should not have a buf
        should.not.exist(hiddenSecret.buf)
        should.exist(hiddenSecret.hash)
      }, this)
    })
  })
})
