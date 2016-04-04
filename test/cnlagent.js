/* global describe,it */
'use strict'
let should = require('should')
let CnlAgent = require('../lib/cnlagent.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Tx = require('fullnode/lib/tx')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

describe('CnlAgent', function () {
  // generate privkey, msPrivkey, otherMsPubkey, otherAddress

  // generate data to initialize an cnlAgent
  let privkey = Privkey().fromBN(BN(30))
  let pubkey = Pubkey().fromPrivkey(privkey)
  let address = Address().fromPubkey(pubkey)
  let msPrivkey = Privkey().fromBN(BN(40))
  let msPubkey = Pubkey().fromPrivkey(msPrivkey)

  // generate data to initialize another cnlAgent (first cnlAgent will need some of this data too)
  let otherPrivkey = Privkey().fromBN(BN(60))
  let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)
  let otherAddress = Address().fromPubkey(otherPubkey)
  let otherMsPrivkey = Privkey().fromBN(BN(50))
  let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

  let consts = {
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b483045022100c000cacbb96e644d8ecd80b7e729471ab64d7913a52ceb45b7c498394459fa6f0220338cad242d55e4379d95ebc839771930ea849a31243b8e4400013a2f90ea91400121036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00ffffffff02002d31010000000017a914825d8d4a359b1caee1ea5191d43deaff2a87691487f08cc404000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    otherFundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b4830450221009a8d35af1dcb1ed0fc0f21e07ebd0a2bce88f9bfc973b083326bef9d74e7354c022029d23c39c3cb18bc2567c9c54e215c2c13f68fbaf3c67e3f3f3fb8b234eb0d5701210301257e93a78a5b7d8fe0cf28ff1d8822350c778ac8a30e57d2acfc4d5fb8c192ffffffff02809698000000000017a914825d8d4a359b1caee1ea5191d43deaff2a8769148770235d05000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac00000000',
    partialRefundTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d0000000092000047304402200829feb0dc5d027afeaaca6b8133e1c59fd010746fafe1dfca7634c136f58621022070a2ed2be2fceec1376956efd0cfe6edb4b6e2599416bc9639eba2590baa7c57014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ace7382957',
    completeRefundTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da00483045022100fa63300d459ec162c7b60881ed000013f5379176c9774e5eedf6cfea24481a6602203c53cec3f43e8796b1311c33440346ec840dee22452c514ef66b02a5c876c7d90147304402200829feb0dc5d027afeaaca6b8133e1c59fd010746fafe1dfca7634c136f58621022070a2ed2be2fceec1376956efd0cfe6edb4b6e2599416bc9639eba2590baa7c57014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ace7382957',
    partialPaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000930000483045022100afe984a869344e375192edc310d6b52a170662af7ec26e7461d1f5bee496c735022066d0e3626cf0b6a32378f08f1cdb363b40bfac1f2515559bc0ef78bbf8897bc5014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff02404b4c00000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588acb0bae400000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac67e72757',
    completePaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da0047304402200bd0bdedb370f11fec3cbd20ce09e7a043f5568119e6117ef2f1a128df21b08002205e0bf6d0c215dd5613d0063a19dbeadf31e22a22297a78b0e7d111d5ffe0dfed01483045022100afe984a869344e375192edc310d6b52a170662af7ec26e7461d1f5bee496c735022066d0e3626cf0b6a32378f08f1cdb363b40bfac1f2515559bc0ef78bbf8897bc5014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff02404b4c00000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588acb0bae400000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac67e72757'
  }

  let now = 1459727335
  let inDays = function (n) {
    return now + (60 * 60 * 24 * n)
  }

  it('should exist', function () {
    should.exist(CnlAgent)
    should.exist(new CnlAgent())
    should.exist(CnlAgent())
  })

  /* conveniance methods */

  describe('#asyncSendPayment', function () {
    it('asyncSendPayment should store a payment tx', function () {
      return asink(function *() {
        // asyncInitialize sender
        let cnlAgent = CnlAgent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield cnlAgent.asyncInitialize()
        cnlAgent.fundingTx = Tx().fromString(consts.fundingTx)
        cnlAgent.otherFundingTx = Tx().fromString(consts.otherFundingTx)
        cnlAgent.balance = BN(2e7)
        cnlAgent.otherBalance = BN(1e7)
        cnlAgent.funded = true
        cnlAgent.initialized = true
        cnlAgent.nlocktime = inDays(29)
        cnlAgent.towardsMe = true

        // asyncInitialize another cnlAgent
        let otherCnlAgent = CnlAgent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherCnlAgent.asyncInitialize()

        let balanceBefore = cnlAgent.balance
        let otherBalanceBefore = cnlAgent.otherBalance
        let nlocktimeBefore = cnlAgent.nlocktime

        yield cnlAgent.asyncSendPayment(BN(200))

        cnlAgent.balance.eq(balanceBefore.sub(BN(200))).should.equal(true)
        cnlAgent.otherBalance.eq(otherBalanceBefore.add(BN(200))).should.equal(true)
        ;(cnlAgent.nlocktime < nlocktimeBefore).should.equal(true)
        cnlAgent.towardsMe.should.equal(false)
      }, this)
    })
  })

  describe('#asyncAcceptPayment', function () {
    it('asyncAcceptPayment should accept a payment tx', function () {
      // TODO
    })
  })
})
