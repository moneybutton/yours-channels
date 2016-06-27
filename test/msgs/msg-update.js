/* global describe,it */
'use strict'
let MsgUpdate = require('../../lib/msgs/msg-update')
let should = require('should')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let OutputDescription = require('../../lib/output-description')
let Bn = require('yours-bitcoin/lib/bn')

describe('MsgUpdate', function () {
  it('should exist', function () {
    should.exist(MsgUpdate)
    should.exist(new MsgUpdate())
  })

  describe('#constructor', function () {
    it('should make a new MsgUpdate', function () {
      let msg = new MsgUpdate()
      msg.cmd.should.equal('update')
    })
  })

  describe('#setOutputDescriptions', function () {
    it('should set this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgUpdate().setOutputDescriptions([outputDescription])
      msg.args.outputDescriptions.length.should.equal(1)
    })
  })

  describe('#getOutputDescriptions', function () {
    it('should get this output description list', function () {
      let outputDescription = new OutputDescription()
      let msg = new MsgUpdate().setOutputDescriptions([outputDescription])
      let outputDescriptions = msg.getOutputDescriptions()
      ;(outputDescriptions[0] instanceof OutputDescription).should.equal(true)
    })
  })

  describe('#setCommitmentTxBuilder', function () {
    it('should set a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgUpdate().setCommitmentTxBuilder(txb)
      should.exist(msg.args.commitmentTxBuilder)
    })
  })

  describe('#getCommitmentTxBuilder', function () {
    it('should get a TxBuilder', function () {
      let txb = new TxBuilder()
      let msg = new MsgUpdate().setCommitmentTxBuilder(txb)
      let txb2 = msg.getCommitmentTxBuilder()
      ;(txb2 instanceof TxBuilder).should.equal(true)
    })
  })

  describe('#setAmount', function () {
    it('should set a bn', function () {
      let msg = new MsgUpdate().setAmount(Bn(5000))
      should.exist(msg.args.amount)
    })
  })

  describe('#getCommitmentTxBuilder', function () {
    it('should get a TxBuilder', function () {
      let msg = new MsgUpdate().setAmount(Bn(5000))
      let amount = msg.getAmount()
      ;(amount instanceof Bn).should.equal(true)
      amount.eq(Bn(5000)).should.equal(true)
    })
  })
})
