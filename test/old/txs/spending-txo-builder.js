/* global describe,it */
'use strict'
let should = require('should')
let SpendingTxoBuilder = require('../../lib/txs/spending-txo-builder.js')

describe('SpendingTxoBuilder', function () {
  it('should exist', function () {
    should.exist(SpendingTxoBuilder)
    should.exist(new SpendingTxoBuilder())
  })
})
