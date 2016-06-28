/* global describe,it */
'use strict'
let MsgUpdate = require('../../lib/msgs/msg-update')
let should = require('should')
let Commitment = require('../../lib/txs/commitment')
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

  describe('#setCommitment', function () {
    it('should set this commitment', function () {
      let commitment = new Commitment()
      let msg = new MsgUpdate().setCommitment(commitment)
      should.exist(msg.args.commitment)
    })
  })

  describe('#getCommitment', function () {
    it('should get the commitment', function () {
      let commitment = new Commitment()
      let msg = new MsgUpdate().setCommitment(commitment)
      commitment = msg.getCommitment()
      ;(commitment instanceof Commitment).should.equal(true)
    })
  })

  describe('#setFundingAmount', function () {
    it('should set a bn', function () {
      let msg = new MsgUpdate().setFundingAmount(Bn(5000))
      should.exist(msg.args.fundingAmount)
    })
  })

  describe('#getFundingAmount', function () {
    it('should get a bn', function () {
      let msg = new MsgUpdate().setFundingAmount(Bn(5000))
      let fundingAmount = msg.getFundingAmount()
      ;(fundingAmount instanceof Bn).should.equal(true)
      fundingAmount.eq(Bn(5000)).should.equal(true)
    })
  })
})
