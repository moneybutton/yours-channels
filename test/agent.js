/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let asink = require('asink')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Script = require('fullnode/lib/script')
let Txout = require('fullnode/lib/txout')
let Address = require('fullnode/lib/address')
let BN = require('fullnode/lib/bn')

describe('Agent', function () {
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
  // let otherAddress = Address().fromPubkey(otherPubkey)
  let otherMsPrivkey = Privkey().fromBN(BN(50))
  let otherMsPubkey = Pubkey().fromPrivkey(otherMsPrivkey)

  let consts = {
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b483045022100c000cacbb96e644d8ecd80b7e729471ab64d7913a52ceb45b7c498394459fa6f0220338cad242d55e4379d95ebc839771930ea849a31243b8e4400013a2f90ea91400121036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00ffffffff02002d31010000000017a914825d8d4a359b1caee1ea5191d43deaff2a87691487f08cc404000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    otherFundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b4830450221009a8d35af1dcb1ed0fc0f21e07ebd0a2bce88f9bfc973b083326bef9d74e7354c022029d23c39c3cb18bc2567c9c54e215c2c13f68fbaf3c67e3f3f3fb8b234eb0d5701210301257e93a78a5b7d8fe0cf28ff1d8822350c778ac8a30e57d2acfc4d5fb8c192ffffffff02809698000000000017a914825d8d4a359b1caee1ea5191d43deaff2a8769148770235d05000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac00000000',
    partialRefundTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d0000000092000047304402200829feb0dc5d027afeaaca6b8133e1c59fd010746fafe1dfca7634c136f58621022070a2ed2be2fceec1376956efd0cfe6edb4b6e2599416bc9639eba2590baa7c57014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ace7382957',
    completeRefundTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da00483045022100fa63300d459ec162c7b60881ed000013f5379176c9774e5eedf6cfea24481a6602203c53cec3f43e8796b1311c33440346ec840dee22452c514ef66b02a5c876c7d90147304402200829feb0dc5d027afeaaca6b8133e1c59fd010746fafe1dfca7634c136f58621022070a2ed2be2fceec1376956efd0cfe6edb4b6e2599416bc9639eba2590baa7c57014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff01f0053101000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ace7382957',
    partialPaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000930000483045022100b4be610a2ee28691f684dd9937c56ceadd18dfcc7d5e8baa23672e3a7bfa70e102205587ba8c115803e31bef323d7a2f11427947c696b93bee323236f282d2586965014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff0340420f000000000017a914896007cb039c6648498ba434b2d0ed00837c1a3587404b4c000000000017a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb95877078d500000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    completePaymentTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d00000000da004830450221009b918e851bd12259d066f7962869c119950c8de411885b7f66ea92f3b54daa3102205f04775fcea9bd7f037b00209dabe05981fbdf26be65be12ac0ca09dd42071700147304402202641d88de6adc665c161899e862c0065352a216e3bf45c58a610c27df57fd09702206d7931e2f6c78692bae2d2e11d8c06d89f5c50d3b759f30d07ac8c028c7c8a4c014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff02404b4c000000000017a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9587b0bae400000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac67e72757',
    partialHtlcTx: '010000000149917883684f5cbd2105ed83e90f695b2a57aaace9466320b85e4f424bfbb91d000000009200004730440220761c62438bfc9bca63fc5069d22522c97e73fffe84be55050709695819788c2b02202edf17ee25840ef36db62def204b5b7d9ea00ff379e51aa2be4ce6465f6a3b30014752210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b52aeffffffff03404b4c00000000006463210301257e93a78a5b7d8fe0cf28ff1d8822350c778ac8a30e57d2acfc4d5fb8c192b2a9142598612ebe9e0dcbd7e98683e7570bab139b91b188670164b27521036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00b268404b4c0000000000a163210301257e93a78a5b7d8fe0cf28ff1d8822350c778ac8a30e57d2acfc4d5fb8c192b2a91472c34155a9a8a6d16ea749e23198e9c0d234786a886763210301257e93a78a5b7d8fe0cf28ff1d8822350c778ac8a30e57d2acfc4d5fb8c192b2a91472c34155a9a8a6d16ea749e23198e9c0d234786a88670164b27521036d2b085e9e382ed10b69fc311a03f8641ccfff21574de0927513a49d9a688a00b26868706f9800000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000'
  }

  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
    should.exist(Agent())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let agent = Agent()
      should.exist(agent.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        should.exist(agent.privkey)
        should.exist(agent.pubkey)
        should.exist(agent.address)
        should.exist(agent.keypair)

        agent.initialized.should.equal(true)
      }, this)
    })
  })

  it('asyncInitializeOther should set a multisig script and address', function () {
    return asink(function *() {
      let agent = Agent()
      yield agent.asyncInitialize(privkey, msPrivkey)
      yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
      should.exist(agent.other.address)
      agent.other.initialized.should.equal(true)
    }, this)
  })

  describe('#asyncBuildMultisig', function () {
    it('asyncBuildMultisig should create a multisig address', function () {
      return asink(function *() {
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
        yield agent.asyncBuildMultisig()

        should.exist(agent.multisig)
      }, this)
    })
  })

  /* funding the channel */

  describe('#asyncBuildFundingTxb', function () {
    it('asyncBuildFundingTxb should create a funding tx', function () {
      return asink(function *() {
        // asyncInitialize an agent
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
        yield agent.asyncBuildMultisig()

        // build output to be spent in funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)

        let tx = yield agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)

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

  describe('#asyncBuildRefundTxb', function () {
    it.skip('asyncBuildRefundTxb should exist', function () {
      return asink(function *() {
        let agent = Agent()
        yield agent.asyncInitialize(privkey, otherPubkey)
        should.exist(agent.asyncBuildRefundTxb)
      }, this)
    })
  })

  /* building a payment */

  describe('#asyncBuildCommitmentTxb', function () {
    it.skip('asyncBuildCommitmentTxb should create a partial payment tx', function () {
      return asink(function *() {
        // asyncInitialize agent
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
        yield agent.asyncBuildMultisig()
        // generate funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let fundingAmount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)
        yield agent.asyncBuildFundingTx(fundingAmount, txhashbuf, txoutnum, txout, pubkey)

        // asyncInitialize another agent
        let otherAgent = Agent()
        yield otherAgent.asyncInitialize(otherPrivkey, otherMsPrivkey)
        yield otherAgent.asyncInitializeOther(pubkey, msPubkey)

        let amount = BN(1e6)
        let script = Script().fromScripthash(agent.address.hashbuf)

        let amountToOther = BN(5e6)
        let scriptToOther = Script().fromScripthash(agent.other.address.hashbuf)

        let txb = yield agent.asyncBuildCommitmentTxb(amount, script, amountToOther, scriptToOther)
        let tx = txb.tx

        tx.toString().should.equal(consts.partialPaymentTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)
        ;(tx.toJSON().txouts[0].valuebn).should.equal(amount.toString())
        ;(tx.toJSON().txouts[1].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  describe('#asyncBuildHtlcTxb', function () {
    it.skip('asyncBuildHtlcTxb should create a partial htlc tx', function () {
      return asink(function *() {
        // asyncInitialize agent
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
        yield agent.asyncBuildMultisig()
        yield agent.asyncGenerateSecrets()
        // generate funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let fundingAmount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)
        yield agent.asyncBuildFundingTx(fundingAmount, txhashbuf, txoutnum, txout, pubkey)

        // asyncInitialize another agent
        let otherAgent = Agent()
        yield otherAgent.asyncInitialize(otherPrivkey, otherMsPrivkey)
        yield otherAgent.asyncInitializeOther(pubkey, msPubkey)
        yield otherAgent.asyncBuildMultisig()
        yield otherAgent.asyncGenerateSecrets()

        // exchange secrets
        agent.storeOtherSecrets(otherAgent.htlcSecret.hidden(), otherAgent.revocationSecret.hidden())
        otherAgent.storeOtherSecrets(agent.htlcSecret.hidden(), agent.revocationSecret.hidden())

        let amount = BN(5e6)
        let amountToOther = BN(5e6)
        let txb = yield agent.asyncBuildHtlcTxb(amount, amountToOther)
        let tx = txb.tx

        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)

        // tx.toJSON().txins.length.should.equal(1)
        // tx.toJSON().txouts.length.should.equal(2)
        // ;(tx.toJSON().txouts[0].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  describe('#asyncAcceptCommitmentTxb', function () {
    it.skip('asyncAcceptCommitmentTxb should create a htlc tx', function () {
      return asink(function *() {
        // asyncInitialize agent
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
        yield agent.asyncBuildMultisig()
        yield agent.asyncGenerateSecrets()
        // generate funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let fundingAmount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)
        yield agent.asyncBuildFundingTx(fundingAmount, txhashbuf, txoutnum, txout, pubkey)

        // asyncInitialize another agent
        let otherAgent = Agent()
        yield otherAgent.asyncInitialize(otherPrivkey, otherMsPrivkey)
        yield otherAgent.asyncInitializeOther(pubkey, msPubkey)
        yield otherAgent.asyncBuildMultisig()
        yield otherAgent.asyncGenerateSecrets()

        // exchange secrets
        agent.storeOtherSecrets(otherAgent.htlcSecret.hidden(), otherAgent.revocationSecret.hidden())
        otherAgent.storeOtherSecrets(agent.htlcSecret.hidden(), agent.revocationSecret.hidden())

        let amount = BN(5e6)
        let amountToOther = BN(5e6)
        let txb = yield agent.asyncBuildHtlcTxb(amount, amountToOther)
        let tx = yield otherAgent.asyncAcceptCommitmentTx(txb)

        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)
        // ;(tx.toJSON().txouts[0].valuebn).should.equal(amountToOther.toString())
      }, this)
    })
  })

  /*
   * This should be as similar as possible to the "Funding the channel"
   * protocoll described in the doc
   */
  describe('#Full setup example', function () {
    it.skip('should build a funding tx, a refund tx', function () {
      return asink(function *() {
        // initialize agent
        let agent = Agent()
        yield agent.asyncInitialize(privkey, msPrivkey)
        yield agent.asyncGenerateSecrets()

        // asyncInitialize another agent
        let otherAgent = Agent()
        yield otherAgent.asyncInitialize(otherPrivkey, otherMsPrivkey)
        yield otherAgent.asyncGenerateSecrets()

        // step 1: agent and other agent exchange public keys
        // and create a multisig address
        yield agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
        yield agent.asyncBuildMultisig()

        yield otherAgent.asyncInitializeOther(pubkey, msPubkey)
        yield otherAgent.asyncBuildMultisig()

        // step 2: agent builds a funding transaction
        // and sends the hash of the funding transaction to other agent
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)
        yield agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
        should.exist(agent.fundingTxhashbuf)
        should.exist(agent.fundingTxout)

        otherAgent.asyncStoreOtherFundingTxHash(agent.fundingTxhashbuf, agent.fundingTxout)

/* deprecated atm
        // step 3: other agent builds refund transaction, sends to agent
        // this executes the protocoll from the section "Creating a payment"
        // note that in this step agent takes the role of Bob and other agent of Alice

        // step 3.1 other agent generates a revocation secret and sends it to agent
        otherAgent.generateRevocationSecret()
        should.exist(otherAgent.revocationSecret.buf)
        yield otherAgent.revocationSecret.asyncGenerateHash()
        should.exist(otherAgent.revocationSecret.hash)

        agent.storeOtherRevocationSecret(otherAgent.revocationSecret.hidden())
        should.exist(agent.other.revocationSecret.hash)
        should.not.exist(agent.other.revocationSecret.buf)

        // step 3.2 other agent generates a revocation secret and sends it to agent
        agent.generateRevocationSecret()
        yield agent.revocationSecret.asyncGenerateHash()
        otherAgent.storeOtherRevocationSecret(agent.revocationSecret.hidden())

        // step 3.2.5 agent generates a HTLC secret
        agent.generateHtlcSecret()
        yield agent.htlcSecret.asyncGenerateHash()
        otherAgent.storeOtherHTLCSecret(agent.htlcSecret.hidden())
        should.not.exist(otherAgent.other.htlcSecret.buf)
        should.exist(otherAgent.other.htlcSecret.hash)

        // step 3 other agent builds a commitment tx that spends the funded amount back to agent
        let refundTxb = yield otherAgent.asyncBuildHtlcTxb(amount.sub(BN(100000)), BN(0))
        let refundTx = yield agent.asyncAcceptCommitmentTx(refundTxb)

        refundTx.toJSON().txouts[0].valuebn.should.equal('19900000')
*/
      }, this)
    })
  })

  describe('#asyncOpenChannel', function () {
    it('asyncOpenChannel should store the other agents addeses and build a multisig address', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())

        let bob = Agent('Bob')
        yield bob.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        yield bob.asyncOpenChannel(BN(1e6), alice.pubkey, alice.msPubkey)

        should.exist(alice.multisig)
        should.exist(alice.fundingTx)
        should.exist(bob.multisig)
      }, this)
    })
  })
})
