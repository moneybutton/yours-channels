/* global describe,it */
'use strict'
let should = require('should')
let RevocationSecret = require('../../lib/scrts/rev-secret')

describe('RevocationSecret', function () {
  it('should exist', function () {
    should.exist(RevocationSecret)
    should.exist(new RevocationSecret())
  })
})
