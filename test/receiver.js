/* global describe,it */
'use strict'
let should = require('should')
let Receiver = require('../lib/receiver.js')

describe('Receiver', function () {
  it('should exist', function () {
    should.exist(Receiver)
    should.exist(new Receiver())
    should.exist(Receiver())
  })
})
