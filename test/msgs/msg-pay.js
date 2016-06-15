/* global describe,it */
'use strict'
let MsgPay = require('../../lib/msgs/msg-pay')
let should = require('should')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let OutputDescription = require('../../lib/output-description')

describe('MsgPay', function () {
  it('should exist', function () {
    should.exist(MsgPay)
    should.exist(new MsgPay())
  })

  describe('#constructor', function () {
    it('should make a new MsgPay', function () {
      let msg = new MsgPay()
      msg.cmd.should.equal('pay')
    })
  })

  describe('#setOutputDescriptions', function () {
    it('should set this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgPay().setOutputDescriptions([outputDescription])
      msg.args.outputDescriptions.length.should.equal(1)
    })
  })

  describe('#getOutputDescriptions', function () {
    it('should get this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgPay().setOutputDescriptions([outputDescription])
      let outputDescriptions = msg.getOutputDescriptions()
      ;(outputDescriptions[0] instanceof OutputDescription).should.equal(true)
    })
  })

  describe('#setCommitmentTxBuilder', function () {
    it('should set a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgPay().setCommitmentTxBuilder(txb)
      should.exist(msg.args.commitmentTxBuilder)
    })
  })

  describe('#getCommitmentTxBuilder', function () {
    it('should get a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgPay().setCommitmentTxBuilder(txb)
      let txb2 = msg.getCommitmentTxBuilder()
      ;(txb2 instanceof TxBuilder).should.equal(true)
    })
  })
})
