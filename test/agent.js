/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
let Txout = require('fullnode/lib/txout')
let Tx = require('fullnode/lib/tx')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

describe('Agent', function () {
  // generate privkey, msPrivkey, otherMsPubkey, otherAddress

  // generate data to initialize an agent
  let privkey = Privkey().fromBN(BN(30))
  let pubkey = Pubkey().fromPrivkey(privkey)
  let address = Address().fromPubkey(pubkey)
  let msPrivkey = Privkey().fromBN(BN(40))
  let msPubkey = Pubkey().fromPrivkey(msPrivkey)

  // generate data to initialize another agent (first agent will need some of this data too)
  let otherPrivkey = Privkey().fromBN(BN(60))
  let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)
  let otherAddress = Address().fromPubkey(otherPubkey)
  let otherMsPrivkey = Privkey().fromBN(BN(50))
  let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

  let consts = {
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b483045022100c000cacbb96e644d8ecd80b7e729471ab64d7913a52ceb45b7c498394459fa6f0220338cad242d55e4379d95ebc839771930ea849a31243b8e4400013a2f90ea91400121036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00ffffffff02002d31010000000017a914825d8d4a359b1caee1ea5191d43deaff2a87691487f08cc404000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    otherFundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b4830450221009a8d35af1dcb1ed0fc0f21e07ebd0a2bce88f9bfc973b083326bef9d74e7354c022029d23c39c3cb18bc2567c9c54e215c2c13f68fbaf3c67e3f3f3fb8b234eb0d5701210301257e93a78a5b7d8fe0cf28ff1d8822350c778ac8a30e57d2acfc4d5fb8c192ffffffff02809698000000000017a914825d8d4a359b1caee1ea5191d43deaff2a8769148770235d05000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac00000000',
    partialRefundTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000930000483045022100a635fe0009ce07ae2eb590efdc377909beb5c7e9503ab3cb1649cfad8b18109002206f75c5632b967c21e49ba03bc9f0592f2e74b565e24ba9de142253a5c2e684ff014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    completeRefundTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da0047304402206af4fead9a814564a569ad5938c0a9d0f6ac89a66db055b42c8cd8d2296fe2a202205bdba2bbb734f3232c2246bcd5f513278b8675ae97b6d7f51796bbefd4484d8701483045022100a635fe0009ce07ae2eb590efdc377909beb5c7e9503ab3cb1649cfad8b18109002206f75c5632b967c21e49ba03bc9f0592f2e74b565e24ba9de142253a5c2e684ff014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    partialPaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d0000000092000047304402201d0602fdc4f93eac4e11c1b93de32454a1a33b0f25d05a0605ac7708c1033b9102205790fea5a84717af75b1dce4e285daa9f89e1d90910bc026d24301ca54588662014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff032c010000000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588acc8000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588acfc033101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    completePaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da004830450221009a4c4e390005b0c2d2979fa7af615c956ea0ceb96a2bb46f56091fcd0d9b143c022071f77ebf3cd5922f822d36cd0d7ede4bc3688f72504661d8f762513b95ce06f90147304402201d0602fdc4f93eac4e11c1b93de32454a1a33b0f25d05a0605ac7708c1033b9102205790fea5a84717af75b1dce4e285daa9f89e1d90910bc026d24301ca54588662014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff032c010000000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588acc8000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588acfc033101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000'
  }

  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
    should.exist(Agent())
  })

  describe('#initialize', function () {
    it('initialize should exist', function () {
      let agent = Agent()
      should.exist(agent.initialize)
    })

    it('initialize should set a multisig script and address', function () {
      return asink(function *() {
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        should.exist(agent.pubkey)
        should.exist(agent.address)
        should.exist(agent.keypair)
        should.exist(agent.msPubkey)
        should.exist(agent.msScript)
        should.exist(agent.msAddress)
        agent.initialized.should.equal(true)
      }, this)
    })
  })

  /* funding transaction */

  describe('#asyncBuildFundingTx', function () {
    it('asyncBuildFundingTx should create a funding tx', function () {
      return asink(function *() {
        // initialize an agent
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()

        // build output to be spent in funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txout = Txout(BN(1e8), scriptout)

        let txb = yield agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
        let tx = txb.tx

        tx.toString().should.equal(consts.fundingTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(2)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amount.toString())

        agent.balance.should.equal(amount)
      }, this)
    })
  })

  describe('#storeOtherFundingTx', function () {
    it('storeOtherFundingTx should store and check the other agents funding tx', function () {
      return asink(function *() {
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        let otherFundingTx = Tx().fromString(consts.otherFundingTx)

        agent.storeOtherFundingTx(otherFundingTx)
        agent.otherBalance.toString().should.equal('10000000')
      }, this)
    })
  })

  /* refund transaction */

  describe('#asyncBuildPartialRefundTx', function () {
    it('asyncBuildPartialRefundTx should create a partial refund tx', function () {
      return asink(function *() {
        // initialize sender
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        let txb = yield agent.asyncBuildPartialRefundTx()
        let tx = txb.tx

        tx.toString().should.equal(consts.partialRefundTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(1)
        ;(tx.toJSON().txouts[0].valuebn).should.equal('19990000')
      }, this)
    })
  })

  describe('#asyncBuildRefundTx', function () {
    it('asyncBuildRefundTx should create a complete refund tx', function () {
      return asink(function *() {
        // initialize an agent
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        // initialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.initialize()

        let txb = yield agent.asyncBuildPartialRefundTx()
        let tx = yield otherAgent.asyncBuildRefundTx(txb)

        tx.toString().should.equal(consts.completeRefundTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(1)
        ;(tx.toJSON().txouts[0].valuebn).should.equal('19990000')
      }, this)
    })
  })

  /* payment transaction */

  describe('#asyncBuildParitalPaymentTx', function () {
    it('asyncBuildParitalPaymentTx should create a partial payment tx', function () {
      return asink(function *() {
        // initialize sender
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        // initialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.initialize()

        // build funding transaction for other agent
        let otherScriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + otherAddress.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let otherAmount = BN(1e7)
        let otherTxhashbuf = new Buffer(32).fill(0)
        let otherTxoutnum = 0
        let otherTxout = Txout(BN(1e8), otherScriptout)

        let otherFundingTxb = yield otherAgent.asyncBuildFundingTx(otherAmount, otherTxhashbuf, otherTxoutnum, otherTxout, otherPubkey)
        let otherFundingTx = otherFundingTxb.tx
        otherFundingTx.toString().should.equal(consts.otherFundingTx)

        // store otherFundingTx in agent
        agent.storeOtherFundingTx(otherFundingTx)

        let amountToMe = BN(300)
        let amountToOther = BN(200)
        let txb = yield agent.asyncBuildParitalPaymentTx(amountToMe, amountToOther)
        let tx = txb.tx

        tx.toString().should.equal(consts.partialPaymentTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amountToMe.toString())
        ;(tx.toJSON().txouts[1].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  describe('#asyncBuildPaymentTx', function () {
    it('asyncBuildPaymentTx should create a complete payment tx', function () {
      return asink(function *() {
        // initialize an agent
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)
        agent.otherFundingTx = Tx().fromString(consts.otherFundingTx)
        agent.funded = true

        // initialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.initialize()

        let amountToMe = BN(300)
        let amountToOther = BN(200)
        let txb = yield agent.asyncBuildParitalPaymentTx(amountToMe, amountToOther)
        let tx = yield otherAgent.asyncBuildPaymentTx(txb)

        tx.toString().should.equal(consts.completePaymentTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amountToMe.toString())
        ;(tx.toJSON().txouts[1].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  describe('#storePaymentTx', function () {
    it('storePaymentTx should store a payment tx', function () {
      return asink(function *() {
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        let completePaymentTx = Tx().fromString(consts.completePaymentTx)

        agent.storePaymentTx(completePaymentTx)
        agent.balance.toString().should.equal('19989800')
        agent.otherBalance.toString().should.equal('200')
      }, this)
    })
  })

  it('putting it all together', function () {
    return asink(function *() {
      // CREATE FUNDING TRANSACTIONS
      // each agent can do that independantly form the other

      // initialize an agent
      let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
      yield agent.initialize()

      // build output to be spent by agent in funding transaction
      let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
      let amount = BN(2e7)
      let txhashbuf = new Buffer(32).fill(0)
      let txoutnum = 0
      let txout = Txout(BN(1e8), scriptout)

      yield agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
      agent.fundingTx.toString().should.equal(consts.fundingTx)

      // initialize another agent
      let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
      yield otherAgent.initialize()

      // build funding transaction for other agent
      let otherScriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + otherAddress.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
      let otherAmount = BN(1e7)
      let otherTxhashbuf = new Buffer(32).fill(0)
      let otherTxoutnum = 0
      let otherTxout = Txout(BN(1e8), otherScriptout)

      yield otherAgent.asyncBuildFundingTx(otherAmount, otherTxhashbuf, otherTxoutnum, otherTxout, otherPubkey)
      otherAgent.fundingTx.toString().should.equal(consts.otherFundingTx)

      // CREATE REFUND TRANSACTIONS
      // each agent can create a partial one, but they need to communicate
      // to get the otheres signature (they are spending from the multisig after all)

      // agent creates his refund transactio first
      let refundTxb = yield agent.asyncBuildPartialRefundTx()
      // he then sends it to other agent
      let refundTx = yield otherAgent.asyncBuildRefundTx(refundTxb)
      // the other agent then sends the completely signed refund transaction to agent
      agent.storeRefundTx(refundTx)
      // TODO check that agent cannot exploit information asymmetry at this point
      // note thoght that the funding transactions have not been exchanged yet
      // and that the multisig address is not funded yet
      agent.refundTx.toString().should.equal(consts.completeRefundTx)

      // now otherAgent does the symmetric thing
      let otherRefundTxb = yield agent.asyncBuildPartialRefundTx()
      let otherRefundTx = yield otherAgent.asyncBuildRefundTx(otherRefundTxb)
      otherAgent.storeRefundTx(otherRefundTx)
      should.exist(otherAgent.refundTx)

      // at this point both agents have completely signed refund transactions
      // thus they can safely broadcast their funding transactions to the bitcoin network
      // and exchange them
      agent.storeOtherFundingTx(otherAgent.fundingTx)
      otherAgent.storeOtherFundingTx(agent.fundingTx)

      // CREATE PAYMENT TRANSACTION
      let amountToMe = BN(300)
      let amountToOther = BN(200)
      let txb = yield agent.asyncBuildParitalPaymentTx(amountToMe, amountToOther)
      txb.tx.toString().should.equal(consts.partialPaymentTx)

      // let other agent sign payment transaction
      let tx = yield otherAgent.asyncBuildPaymentTx(txb)
      tx.toString().should.equal(consts.completePaymentTx)

      // now other agent sends back the completely signed transaction to agent
      agent.storePaymentTx(tx)
      should.exist(agent.paymentTx)
    }, this)
  })
})
