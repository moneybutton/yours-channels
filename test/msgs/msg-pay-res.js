/* global describe,it */
'use strict'
let MsgPayRes = require('../../lib/msgs/msg-pay-res')
let should = require('should')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

describe('MsgPayRes', function () {
  it('should exist', function () {
    should.exist(MsgPayRes)
    should.exist(new MsgPayRes())
  })

  describe('#constructor', function () {
    it('should make a new MsgPayRes', function () {
      let msg = new MsgPayRes()
      msg.cmd.should.equal('pay-res')
    })
  })

  describe('#setCommitmentTxBuilder', function () {
    it('should set a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgPayRes().setCommitmentTxBuilder(txb)
      should.exist(msg.args.commitmentTxBuilder)
    })
  })

  describe('#getCommitmentTxBuilder', function () {
    it('should get a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgPayRes().setCommitmentTxBuilder(txb)
      let txb2 = msg.getCommitmentTxBuilder()
      ;(txb2 instanceof TxBuilder).should.equal(true)
    })
  })
})
