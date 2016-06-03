/* global describe,it */
'use strict'
let should = require('should')
let HtlcSecret = require('../../lib/scrts/htlc-secret.js')

describe('HtlcSecret', function () {
  it('should exist', function () {
    should.exist(HtlcSecret)
    should.exist(new HtlcSecret())
  })
})
