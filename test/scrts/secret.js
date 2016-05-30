/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Secret = require('../../lib/scrts/secret.js')

describe('Secret', function () {
  it('should exist', function () {
    should.exist(Secret)
    should.exist(new Secret())
  })

  describe('#generateBuf', function () {
    it('should generate a buffer', function () {
      return asink(function *() {
        let secret = new Secret()
        secret.generateBuf()
        should.exist(secret.buf)
      }, this)
    })
  })

  describe('#asyncGenerateHash', function () {
    it('should generate a hash', function () {
      return asink(function *() {
        let secret = new Secret()
        secret.generateBuf()
        should.exist(secret.buf)
        yield secret.asyncGenerateHash()
        should.exist(secret.hash)
      }, this)
    })
  })

  describe('#asyncSuperCheck', function () {
    it('should check if buf hashes to hash', function () {
      return asink(function *() {
        let secret = new Secret()
        secret.generateBuf()
        should.exist(secret.buf)
        yield secret.asyncGenerateHash()
        should.exist(secret.hash)
        let result = yield secret.asyncSuperCheck()
        result.should.equal(true)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('should remove the buf from a secret', function () {
      return asink(function *() {
        let secret = new Secret()
        secret.generateBuf()
        yield secret.asyncGenerateHash()

        // secret should not change
        should.exist(secret.buf)
        should.exist(secret.hash)

        let toPublicSecret = secret.toPublic()

        // toPublicSecret should not have a buf
        should.not.exist(toPublicSecret.buf)
        should.exist(toPublicSecret.hash)
      }, this)
    })
  })

  describe('#toJSON', function () {
    it('should return a Json file', function () {
      return asink(function *() {
        let secret = new Secret()
        secret.generateBuf()
        yield secret.asyncGenerateHash()
        let json = secret.toJSON()
        should.exist(json.buf)
        should.exist(json.hash)
      }, this)
    })
  })

  describe('#fromJSON', function () {
    it('sshould return a Json file', function () {
      return asink(function *() {
        let secret = new Secret()
        yield secret.asyncInitialize()

        let json = secret.toJSON()
        let otherSecret = new Secret().fromJSON(json)
        should.exist(otherSecret.buf)
        should.exist(otherSecret.hash)
      }, this)
    })
  })
})
