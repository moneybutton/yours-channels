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

describe('Sender', function () {
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
    multiSigScript: 'OP_2 33 0x0391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b 33 0x0229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a OP_2 OP_CHECKMULTISIG',
    multiSigAddress: '3NSKWKu7RzEUqR1J2HUWoNDumorEUPPnAZ',
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b483045022100a80e35e6eb08a021ea10093b4585487106587cea4cd9cd37a1fa18609574d7fb022013deacd6d03b293f156f944ea4ae68139da854137ebc54021af26b3eb06165a00121036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00ffffffff02002d31010000000017a914e3931442220bb453a95150725a4e45c456b2c61987f08cc404000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    otherFundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b4830450221009a8d35af1dcb1ed0fc0f21e07ebd0a2bce88f9bfc973b083326bef9d74e7354c022029d23c39c3cb18bc2567c9c54e215c2c13f68fbaf3c67e3f3f3fb8b234eb0d570121036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00ffffffff02809698000000000017a914825d8d4a359b1caee1ea5191d43deaff2a8769148770235d05000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac00000000',
    partialRefundTx: '0100000001737b59058d5cfe7d83db9aadbbd2913003a18d27c9abfb4163e37cfe47844ff3000000009300483045022100cc3c432764d6bb0013e9246e8704771b3a8c20ba1685d1a5d491852026dd384c02205af0caf05aa2c36d9fd131c8bacfa4542a4651faf1caaddd516941528a7a016801004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    completeRefundTx: '0100000001737b59058d5cfe7d83db9aadbbd2913003a18d27c9abfb4163e37cfe47844ff300000000da00483045022100cc3c432764d6bb0013e9246e8704771b3a8c20ba1685d1a5d491852026dd384c02205af0caf05aa2c36d9fd131c8bacfa4542a4651faf1caaddd516941528a7a01680147304402203fc4e90e0a34bed0aaf67984543c49ac3f734a4e53bbbb508be8cdf057af2ae902205a816fe5a33b8883bbd8720a82edeb8f92196d274612876f02e7d570116a9f3f014752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    partialPaymentTx: '0100000001737b59058d5cfe7d83db9aadbbd2913003a18d27c9abfb4163e37cfe47844ff3000000009300483045022100f8a7156ff9e52b4d9411fdf887490802161c6d1253f631bf675cb34ae5a9d798022070be6afa86781d5d56dc5a2bb49536c0b3fee359d8218c0fc36131252d9d232901004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff032c010000000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588acc8000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588acfc033101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    completePaymentTx: '0100000001737b59058d5cfe7d83db9aadbbd2913003a18d27c9abfb4163e37cfe47844ff3000000009300483045022100f8a7156ff9e52b4d9411fdf887490802161c6d1253f631bf675cb34ae5a9d798022070be6afa86781d5d56dc5a2bb49536c0b3fee359d8218c0fc36131252d9d23290100473044022034126ba5e1d6a4fac4783d25b1289c67209906d79116bdeffd189db3eb50dabe022014498a1c9178fa1e9bfc2de2d249eea91314f8c06fcec6635b48c969b36b337901ffffffff032c010000000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588acc8000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588acfc033101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000'
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
        should.exist(agent.msPubkey)
        should.exist(agent.msScript)
        should.exist(agent.msAddress)
        // TODO add other properties here
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
        let receiverScriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txout = Txout(BN(1e8), receiverScriptout)

        let txb = yield agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
        let tx = txb.tx

        tx.toString().should.equal(consts.fundingTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(2)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amount.toString())
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

  describe('#asyncBuildPartialPaymentTx', function () {
    it('asyncBuildPartialPaymentTx should create a partial payment tx', function () {
      return asink(function *() {
        // initialize sender
        let agent = Agent(privkey, msPrivkey, otherMsPubkey, otherAddress)
        yield agent.initialize()
        agent.fundingTx = Tx().fromString(consts.fundingTx)

        // initialize another agent
        let otherAgent = Agent(otherPrivkey, otherMsPrivkey, msPubkey, address)
        yield otherAgent.initialize()

        // build funding transaction for other agent
        let receiverScriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + otherAddress.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(1e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txout = Txout(BN(1e8), receiverScriptout)

        let otherFundingTxb = yield otherAgent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
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
})
