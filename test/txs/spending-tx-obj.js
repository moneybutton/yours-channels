/* global describe,it */
'use strict'
let should = require('should')
// let asink = require('asink')
// let CommitmentTxObj = require('../../lib/txs/commitment-tx-obj')
// let FundingTxObj = require('../../lib/txs/funding-tx-obj')
let SpendingTxObj = require('../../lib/txs/spending-tx-obj')

describe('SpendingTxObj', function () {
  it('should exist', function () {
    should.exist(SpendingTxObj)
    should.exist(new SpendingTxObj())
  })
})
