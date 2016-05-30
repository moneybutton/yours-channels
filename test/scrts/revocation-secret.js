/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let RevocationSecret = require('../../lib/scrts/revocation-secret.js')

describe('RevocationSecret', function () {
  it('should exist', function () {
    should.exist(RevocationSecret)
    should.exist(new RevocationSecret())
  })
})
