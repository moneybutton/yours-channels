/* global describe,it */
'use strict'
let should = require('should')
let Protocol = require('../lib/protocol.js')

describe('Protocol', function () {
  it('should exist', function () {
    should.exist(Protocol)
    should.exist(new Protocol())
    should.exist(Protocol())
  })
})
