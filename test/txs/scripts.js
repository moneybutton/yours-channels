/* global describe,it */
'use strict'
let should = require('should')
// let asink = require('asink')
let Scripts = require('../../lib/txs/scripts.js')
// let Hash = require('fullnode/lib/hash')

describe('Scripts', function () {
  it('should exist', function () {
    should.exist(Scripts)
    should.exist(new Scripts())
  })
})
