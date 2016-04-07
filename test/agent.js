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
//  let privkey = Privkey().fromRandom()
  let pubkey = Pubkey().fromPrivkey(privkey)
  let address = Address().fromPubkey(pubkey)
  let msPrivkey = Privkey().fromBN(BN(40))
  let msPubkey = Pubkey().fromPrivkey(msPrivkey)

  // generate data to initialize another agent (first cnlbuilder will need some of this data too)
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
    partialPaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d0000000092000047304402202641d88de6adc665c161899e862c0065352a216e3bf45c58a610c27df57fd09702206d7931e2f6c78692bae2d2e11d8c06d89f5c50d3b759f30d07ac8c028c7c8a4c014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff02404b4c000000000017a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9587b0bae400000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac67e72757',
    completePaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da004830450221009b918e851bd12259d066f7962869c119950c8de411885b7f66ea92f3b54daa3102205f04775fcea9bd7f037b00209dabe05981fbdf26be65be12ac0ca09dd42071700147304402202641d88de6adc665c161899e862c0065352a216e3bf45c58a610c27df57fd09702206d7931e2f6c78692bae2d2e11d8c06d89f5c50d3b759f30d07ac8c028c7c8a4c014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff02404b4c000000000017a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9587b0bae400000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac67e72757'
  }

  let now = 1459727335
  let inDays = function (n) {
    return now + (60 * 60 * 24 * n)
  }

  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
    should.exist(Agent())
  })

  // this test case shows how a payment channel is set up and how one payment is sent
  // it's a good starting point if you are interested in how this works :)
  it('complete randomized example', function () {
    return asink(function *() {
      // randomly generate data to initialize agent
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let address = Address().fromPubkey(pubkey)
      let msPrivkey = Privkey().fromBN(BN(40))
      let msPubkey = Pubkey().fromPrivkey(msPrivkey)

      // randomly generate data to initialize another agent
      let otherPrivkey = Privkey().fromRandom()
      let otherPubkey = Pubkey().fromPrivkey(otherPrivkey)
      let otherAddress = Address().fromPubkey(otherPubkey)
      let otherMsPrivkey = Privkey().fromBN(BN(50))
      let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

      let conservativeFee = BN(10)

      // CREATE FUNDING TRANSACTIONS
      // the agents can do that independantly form one another. this where we differ
      // from the payment channels described in the litrature a bit. the advantage
      // is that both parties can fund the channel.

      // asyncInitialize an agent
      let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
      yield agent.asyncInitialize()

      // build output to be spent by agent in funding transaction
      let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
      let txhashbuf = new Buffer(32).fill(0)
      let txoutnum = 0
      let unspentAmount = BN(1e8)
      let txout = Txout(unspentAmount, scriptout)
      let fundingAmount = BN(2e7)

      let fundingTxb = yield agent.asyncBuildFundingTx(fundingAmount, txhashbuf, txoutnum, txout, pubkey)

      let outFundValbn0 = fundingTxb.tx.txouts[0].valuebn
      let outFundValbn1 = fundingTxb.tx.txouts[1].valuebn
      let outFundValTotal = outFundValbn0.add(outFundValbn1)

      // first output should equal amount
      outFundValbn0.eq(fundingAmount).should.equal(true)
      // sum of outputs should be smaller than inputs
      outFundValTotal.lt(unspentAmount).should.equal(true)
      // but not too small
      unspentAmount.add(conservativeFee.mul(BN(0))).lt(outFundValTotal)
      // there should be one output
      fundingTxb.tx.toJSON().txins.length.should.equal(1)
      // and two inputs
      fundingTxb.tx.toJSON().txouts.length.should.equal(2)
      ;(fundingTxb.tx.toJSON().txouts[0].valuebn).should.equal(fundingAmount.toString())
      // agents balane should be updated
      agent.balance.should.equal(fundingAmount)

      // asyncInitialize another agent
      let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
      yield otherAgent.asyncInitialize()

      // build funding transaction for other agent
      let otherScriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + otherAddress.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
      let otherAmount = BN(1e7)
      let otherTxhashbuf = new Buffer(32).fill(0)
      let otherTxoutnum = 0
      let otherFundingAmount = BN(1e8)
      let otherTxout = Txout(otherFundingAmount, otherScriptout)

      yield otherAgent.asyncBuildFundingTx(otherAmount, otherTxhashbuf, otherTxoutnum, otherTxout, otherPubkey)
      should.exist(otherAgent.fundingTx)

      // CREATE REFUND TRANSACTIONS
      // each agent can create a partial one, but they need to communicate
      // to get the otheres signature (they are spending from the multisig after all)

      // agent creates his refund transactio first
      let refundTxb = yield agent.asyncBuildPartialRefundTx(inDays(30))
      // he then sends it to other agent
      let refundTx = yield otherAgent.asyncBuildRefundTx(refundTxb)
      // the other agent then sends the completely signed refund transaction to agent
      agent.storeRefundTx(refundTx)
      // TODO check that agent cannot exploit information asymmetry at this point
      // note thoght that the funding transactions have not been exchanged yet
      // and that the multisig address is not funded yet

      let refundAmount = agent.refundTx.txouts[0].valuebn

      // refund transaction has only one input
      agent.refundTx.txouts.length.should.equal(1)
      // that input is almost the funding amount
      fundingAmount.add(conservativeFee.mul(BN(2))).gt(refundAmount).should.equal(true)
      agent.refundTx.txouts[0].valuebn.lt(unspentAmount).should.equal(true)

      // agent.refundTx.toString().should.equal(consts.completeRefundTx)

      // now otherAgent does the symmetric thing
      let otherRefundTxb = yield agent.asyncBuildPartialRefundTx(inDays(30))
      let otherRefundTx = yield otherAgent.asyncBuildRefundTx(otherRefundTxb)
      otherAgent.storeRefundTx(otherRefundTx)
      should.exist(otherAgent.refundTx)

      // at this point both agents have completely signed refund transactions
      // thus they can safely broadcast their funding transactions to the bitcoin network
      // and exchange them
      agent.storeOtherFundingTx(otherAgent.fundingTx)
      should.exist(agent.otherFundingTx)

      otherAgent.storeOtherFundingTx(agent.fundingTx)
      should.exist(otherAgent.fundingTx)

      // CREATE PAYMENT TRANSACTION
      let amountToOther = BN(5e6)
      let script = Script().fromScripthash(agent.otherAddress.hashbuf)
      let txb = yield agent.asyncBuildParitalPaymentTx(amountToOther, script, inDays(29))

      txb.tx.txouts.length.should.equal(2)
      txb.tx.txouts[0].valuebn.eq(amountToOther).should.equal(true)

      // let other agent sign payment transaction
      let tx = yield otherAgent.asyncBuildPaymentTx(txb)
      tx.txouts[0].valuebn.eq(amountToOther).should.equal(true)

      // now other agent sends back the completely signed transaction to agent
      agent.storePaymentTx(tx)
      should.exist(agent.paymentTx)
    }, this)
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let agent = Agent()
      should.exist(agent.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
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
        // asyncInitialize an agent
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()

        // build output to be spent in funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)

        let txb = yield agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
        let tx = txb.tx

        tx.toString().should.equal(consts.fundingTx)

        let outValbn0 = tx.txouts[0].valuebn
        let outValbn1 = tx.txouts[1].valuebn

        // first output should equal amount
        outValbn0.eq(amount).should.equal(true)
        // sum of outputs should be smaller than inputs
        outValbn0.add(outValbn1).lt(txoutamount).should.equal(true)
        // there should be one output
        tx.toJSON().txins.length.should.equal(1)
        // and two inputs
        tx.toJSON().txouts.length.should.equal(2)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amount.toString())
        // agents balane should be updated
        agent.balance.should.equal(amount)
      }, this)
    })
  })

  describe('#storeOtherFundingTx', function () {
    it('storeOtherFundingTx should store and check the other agents funding tx', function () {
      return asink(function *() {
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
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
        // asyncInitialize sender
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        let txb = yield agent.asyncBuildPartialRefundTx(inDays(30))
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
        // asyncInitialize an agent
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        // asyncInitialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.asyncInitialize()

        let txb = yield agent.asyncBuildPartialRefundTx(inDays(30))
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
        // asyncInitialize sender
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        // asyncInitialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.asyncInitialize()

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
//        agent.otherBalance.should.equal('') TODO

        let amountToOther = BN(5e6)
        let script = Script().fromScripthash(agent.otherAddress.hashbuf)
        let txb = yield agent.asyncBuildParitalPaymentTx(amountToOther, script, inDays(29))
        let tx = txb.tx

        tx.toString().should.equal(consts.partialPaymentTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(2)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  describe('#asyncBuildPaymentTx', function () {
    it('asyncBuildPaymentTx should create a complete payment tx', function () {
      return asink(function *() {
        // asyncInitialize an agent
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)
        agent.otherFundingTx = Tx().fromString(consts.otherFundingTx)
        agent.funded = true

        // asyncInitialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.asyncInitialize()

        let amountToOther = BN(5e6)
        let script = Script().fromScripthash(agent.otherAddress.hashbuf)
        let txb = yield agent.asyncBuildParitalPaymentTx(amountToOther, script, inDays(29))
        let tx = yield otherAgent.asyncBuildPaymentTx(txb)

        tx.toString().should.equal(consts.completePaymentTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(2)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  describe('#storePaymentTx', function () {
    it('storePaymentTx should store a payment tx', function () {
      return asink(function *() {
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.asyncInitialize()
        let completePaymentTx = Tx().fromString(consts.completePaymentTx)

        agent.storePaymentTx(completePaymentTx)
        agent.balance.toString().should.equal('14990000')
        agent.otherBalance.toString().should.equal('5000000')
      }, this)
    })
  })
})
