/* global describe,it */
'use strict'
let MsgPayRes = require('../../lib/msgs/msg-pay-res')
let should = require('should')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let OutputDescription = require('../../lib/output-description')

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

  describe('#setOutputDescriptions', function () {
    it('should set this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgPayRes().setOutputDescriptions([outputDescription])
      msg.args.outputDescriptions.length.should.equal(1)
    })
  })

  describe('#getOutputDescriptions', function () {
    it('should get this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgPayRes().setOutputDescriptions([outputDescription])
      let outputDescriptions = msg.getOutputDescriptions()
      ;(outputDescriptions[0] instanceof OutputDescription).should.equal(true)
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
