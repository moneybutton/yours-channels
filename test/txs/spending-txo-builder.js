/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Agent = require('../../lib/agent.js')
let Wallet = require('../../lib/wallet.js')
let SpendingTxoBuilder = require('../../lib/txs/spending-txo-builder.js')

let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

describe('SpendingTxoBuilder', function () {
  it('should exist', function () {
    should.exist(SpendingTxoBuilder)
    should.exist(new SpendingTxoBuilder())
  })
})
