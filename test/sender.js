/* global describe,it */
'use strict'
let should = require('should')
let Sender = require('../lib/sender.js')

describe('Sender', function () {
  it.only('should exist', function () {
    should.exist(Sender)
    should.exist(new Sender())
    should.exist(Sender())
  })
})
