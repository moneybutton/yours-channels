/* global describe,it */
'use strict'
let MsgUpdateRes = require('../../lib/msgs/msg-update-res')
let should = require('should')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let OutputDescription = require('../../lib/output-description')

describe('MsgUpdateRes', function () {
  it('should exist', function () {
    should.exist(MsgUpdateRes)
    should.exist(new MsgUpdateRes())
  })

  describe('#constructor', function () {
    it('should make a new MsgUpdateRes', function () {
      let msg = new MsgUpdateRes()
      msg.cmd.should.equal('update-res')
    })
  })

  describe('#setOutputDescriptions', function () {
    it('should set this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgUpdateRes().setOutputDescriptions([outputDescription])
      msg.args.outputDescriptions.length.should.equal(1)
    })
  })

  describe('#getOutputDescriptions', function () {
    it('should get this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgUpdateRes().setOutputDescriptions([outputDescription])
      let outputDescriptions = msg.getOutputDescriptions()
      ;(outputDescriptions[0] instanceof OutputDescription).should.equal(true)
    })
  })

  describe('#setCommitmentTxBuilder', function () {
    it('should set a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgUpdateRes().setCommitmentTxBuilder(txb)
      should.exist(msg.args.commitmentTxBuilder)
    })
  })

  describe('#getCommitmentTxBuilder', function () {
    it('should get a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgUpdateRes().setCommitmentTxBuilder(txb)
      let txb2 = msg.getCommitmentTxBuilder()
      ;(txb2 instanceof TxBuilder).should.equal(true)
    })
  })
})
