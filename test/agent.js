/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let Scripts = require('../lib/scripts.js')
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
        let alice = Agent('Alice')
        yield alice.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
        should.exist(alice.privkey)
        should.exist(alice.pubkey)
        should.exist(alice.address)
        should.exist(alice.keypair)
        should.exist(alice.msPrivkey)
        should.exist(alice.msPubkey)
        should.exist(alice.wallet)

        alice.initialized.should.equal(true)
      }, this)
    })
  })

  it('asyncInitializeOther should set a multisig script and address', function () {
    return asink(function *() {
      let alice = Agent('Alice')
      yield alice.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
      yield alice.asyncInitializeOther(Privkey().fromRandom(), Privkey().fromRandom())

      should.exist(alice.other.address)
      alice.other.initialized.should.equal(true)
    }, this)
  })

  describe('#asyncBuildMultisig', function () {
    it('asyncBuildMultisig should create a multisig address', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
        yield alice.asyncInitializeOther(Privkey().fromRandom(), Privkey().fromRandom())
        yield alice.asyncBuildMultisig()

        should.exist(alice.multisig)
      }, this)
    })
  })

  /* funding the channel */

  describe('#asyncBuildFundingTxb', function () {
    it('asyncBuildFundingTxb should create a funding tx', function () {
      return asink(function *() {
        // asyncInitialize an agent
        let alice = Agent('Alice')
        yield alice.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
        yield alice.asyncInitializeOther(Privkey().fromRandom(), Privkey().fromRandom())
        yield alice.asyncBuildMultisig()

        // build output to be spent in funding transaction
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let amount = BN(2e7)
        let txhashbuf = new Buffer(32).fill(0)
        let txoutnum = 0
        let txoutamount = BN(1e8)
        let txout = Txout(txoutamount, scriptout)

        let tx = yield alice.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)

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
        alice.balance.should.equal(amount)
      }, this)
    })
  })

  describe('#asyncGenerateSecrets', function () {
    it('asyncGenerateSecrets should create a htlc and revocation secret', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncGenerateSecrets()

        should.exist(alice.revocationSecret)
        should.exist(alice.revocationSecret.buf)
        should.exist(alice.revocationSecret.hash)
        should.exist(alice.htlcSecret)
        should.exist(alice.htlcSecret.buf)
        should.exist(alice.htlcSecret.hash)
      }, this)
    })
  })

  describe('#storeOtherSecrets', function () {
    it('storeOtherSecrets should create a htlc and revocation secret', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncGenerateSecrets()

        let bob = Agent('Bob')
        yield bob.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
        yield bob.asyncInitializeOther(Privkey().fromRandom(), Privkey().fromRandom())
        bob.storeOtherSecrets(alice.revocationSecret, alice.revocationSecret)

        should.exist(bob.other.revocationSecret)
        should.exist(bob.other.htlcSecret)
      }, this)
    })
  })

  /* building a payment */

  describe('#asyncBuildCommitmentTxb', function () {
    it.skip('asyncBuildCommitmentTxb should create a partial payment tx', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
        yield alice.asyncInitializeOther(Privkey().fromRandom(), Privkey().fromRandom())
        yield alice.asyncBuildMultisig()

        let unspentAmount = BN(1e6)
        let output = alice.wallet.getUnspentOutput(unspentAmount, alice.address)
        yield alice.asyncBuildFundingTx(unspentAmount, output.txhashbuf, output.txoutnum, output.txout, output.pubkey)

        let bob = Agent('Bob')
        yield bob.asyncInitialize(Privkey().fromRandom(), Privkey().fromRandom())
        yield bob.asyncInitializeOther(Privkey().fromRandom(), Privkey().fromRandom())
        yield bob.asyncBuildMultisig()
        yield bob.asyncGenerateSecrets()

        alice.storeOtherSecrets(bob.revocationSecret, bob.revocationSecret)

        let scriptToAlice = Scripts.htlc(alice)
        let scriptToBob = Scripts.rhtlc(alice)
        let txb = yield alice.asyncBuildCommitmentTxb(BN(5e6), scriptToAlice, BN(5e6), scriptToBob)
        let tx = txb.tx

        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)
        // ;(tx.toJSON().txouts[0].valuebn).should.equal(amount.toString())
        // ;(tx.toJSON().txouts[1].valuebn).should.equal(amountToOther.toString())
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
    it('asyncAcceptCommitmentTxb should create a htlc tx', function () {
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

  describe('#asyncInitPayment', function () {
    it('asyncInitPayment should store the other agents addeses and build a multisig address', function () {
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
        // Alice and Bob generate new secrets for upcoming payment
        alice.sender = true
        yield alice.asyncGenerateSecrets()
        yield bob.asyncGenerateSecrets()

        should.not.exist(alice.other.revocationSecret)
        should.not.exist(bob.other.revocationSecret)
        should.not.exist(alice.other.htlcSecret)
        should.not.exist(bob.other.htlcSecret)
        yield bob.asyncInitPayment(alice.revocationSecret.hidden(), alice.htlcSecret.hidden(), BN(1e5), BN(1e5))
        should.exist(alice.other.revocationSecret)
        should.exist(bob.other.revocationSecret)
        should.exist(alice.other.htlcSecret)
        should.exist(bob.other.htlcSecret)
      }, this)
    })
  })
})
