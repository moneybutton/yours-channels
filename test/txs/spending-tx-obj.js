/* global describe,it */
'use strict'
let should = require('should')
// let asink = require('asink')
// let CommitmentTxObj = require('../../lib/txs/commitment-tx-obj.js')
// let FundingTxObj = require('../../lib/txs/funding-tx-obj.js')
let SpendingTxObj = require('../../lib/txs/spending-tx-obj.js')

describe('SpendingTxObj', function () {
  it('should exist', function () {
    should.exist(SpendingTxObj)
    should.exist(new SpendingTxObj())
  })
})
