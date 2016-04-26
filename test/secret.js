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

  describe('#asyncCheck', function () {
    it('asyncCheck should check if buf hashes to hash', function () {
      return asink(function *() {
        let secret = Secret()
        let buf = new Buffer('abc')
        let hashedBuf = yield Hash.asyncSha256ripemd160(buf)

        secret.buf = buf
        secret.hash = hashedBuf
        let result = yield secret.asyncCheck()
        result.should.equal(true)
      }, this)
    })
  })
})
