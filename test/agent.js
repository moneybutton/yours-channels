/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let Wallet = require('../lib/wallet.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let BN = require('yours-bitcoin/lib/bn')

describe('Agent', function () {
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
        Object.keys(alice).should.deepEqual([ 'name' ])
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        should.exist(alice.funding.keyPair.privKey)
        should.exist(alice.funding.keyPair.pubKey)
        should.exist(alice.funding.address)
        should.exist(alice.funding.keyPair)

        should.exist(alice.multisig.privKey)
        should.exist(alice.multisig.pubKey)

        should.exist(alice.wallet)

        should.exist(alice.htlcSecret)
        should.exist(alice.htlcSecret.buf)
        should.exist(alice.htlcSecret.hash)

        alice.initialized.should.equal(true)
      }, this)
    })
  })

  it('asyncInitializeOther should set a multisig script and address', function () {
    return asink(function *() {
      let alice = Agent('Alice')
      yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

      let bob = Agent('Bob')
      yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
      yield bob.asyncGenerateRevocationSecret()

      yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())

      alice.other.pubKey.toString('hex').should.equal(bob.spending.keyPair.pubKey.toString('hex'))

      should.exist(alice.other.revocationSecrets)
      should.exist(alice.other.pubKey)
      should.exist(alice.other.address)
      should.exist(alice.other.msPubKey)
      alice.other.initialized.should.equal(true)
    }, this)
  })

  describe('#asyncBuildMultisig', function () {
    it('asyncBuildMultisig should create a multisig address', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield alice.asyncBuildMultisig()

        should.exist(alice.multisig)
      }, this)
    })
  })

  /* funding the channel */

  describe('#asyncBuildFundingTxb', function () {
    it('asyncBuildFundingTxb should create a funding tx', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield alice.asyncBuildMultisig()

        // build output to be spent in funding transaction
        let inputAmountBN = BN(1e10)
        let fundingAmount = BN(1e8)
        let wallet = Wallet()
        let output = wallet.getUnspentOutput(inputAmountBN, alice.funding.keyPair.pubKey)
        let txb = yield alice.asyncBuildFundingTx(fundingAmount, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        new TxVerifier(txb.tx, txb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

        let outValbn0 = txb.tx.txOuts[0].valueBn
        // let outValbn1 = txb.tx.txOuts[1].valueBn

        // first output should equal amount
        outValbn0.eq(fundingAmount).should.equal(true)
        // there should be one output
        txb.tx.toJson().txIns.length.should.equal(1)
        // and two inputs
        txb.tx.toJson().txOuts.length.should.equal(2)
        ;(txb.tx.toJson().txOuts[0].valueBn).should.equal(fundingAmount.toString())
        // agents balane should be updated
        alice.amountFunded.should.equal(fundingAmount)
      }, this)
    })
  })

  describe('#asyncGenerateRevocationSecret', function () {
    it('asyncGenerateRevocationSecret should create a htlc and revocation secret', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncGenerateRevocationSecret()

        should.exist(alice.revocationSecret)
        should.exist(alice.revocationSecret.buf)
        should.exist(alice.revocationSecret.hash)
      }, this)
    })
  })

  describe('#storeOtherRevocationSecret', function () {
    it('storeOtherRevocationSecret store the other users hidden htlc and revocation secret', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncGenerateRevocationSecret()

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield bob.asyncInitializeOther(alice.funding.keyPair.pubKey, alice.multisig.pubKey, bob.revocationSecret.hidden())

        bob.storeOtherRevocationSecret(alice.revocationSecret.hidden())

        should.exist(bob.other.revocationSecret)
        should.exist(bob.other.revocationSecret.hash)
        should.not.exist(bob.other.revocationSecret.buf)
      }, this)
    })

    it('storeOtherSecrets should throw an error when called with a non-hidden secret', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncGenerateRevocationSecret()

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield bob.asyncInitializeOther(alice.funding.keyPair.pubKey, alice.multisig.pubKey, bob.revocationSecret.hidden())

        bob.storeOtherRevocationSecret.bind(alice.revocationSecret).should.throw()
      }, this)
    })
  })

  /* building a payment */

  describe('#asyncBuildCommitmentTxb', function () {
    it('asyncBuildCommitmentTxb should create a partial payment tx', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncGenerateRevocationSecret()

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield alice.asyncBuildMultisig()

        yield bob.asyncInitializeOther(alice.funding.keyPair.pubKey, alice.multisig.pubKey, bob.revocationSecret.hidden())
        yield bob.asyncBuildMultisig()

        let wallet = Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        yield alice.asyncBuildFundingTx(BN(1e8), output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.storeOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.storeOtherRevocationSecret(alice.revocationSecret.hidden())

        let txb = yield alice.asyncBuildCommitmentTxb(BN(5e7), BN(5e7))
        let tx = txb.tx

        // new TxVerifier(txb.tx, txb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

        tx.toJson().txIns.length.should.equal(1)
        tx.toJson().txOuts.length.should.equal(2)
        ;(tx.toJson().txOuts[0].valueBn).should.equal(BN(5e7).toString())
        ;(tx.toJson().txOuts[1].valueBn).should.equal(BN(49990000).toString())
      }, this)
    })
  })

  describe('#asyncAcceptCommitmentTxb', function () {
    it('asyncAcceptCommitmentTxb should create a htlc tx', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncGenerateRevocationSecret()

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield alice.asyncBuildMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.revocationSecret.hidden())
        yield bob.asyncBuildMultisig()

        let wallet = Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        yield alice.asyncBuildFundingTx(BN(1e8), output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.storeOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.storeOtherRevocationSecret(alice.revocationSecret.hidden())

        let partialTxb = yield alice.asyncBuildCommitmentTxb(BN(5e7), BN(5e7))
        let txb = yield bob.asyncAcceptCommitmentTx(partialTxb)

        new TxVerifier(txb.tx, txb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

        txb.tx.txIns.length.should.equal(1)
        txb.tx.txOuts.length.should.equal(2)
        ;(txb.tx.txOuts[0].valueBn.toString()).should.equal(BN(5e7).toString())
        ;(txb.tx.txOuts[1].valueBn.toString()).should.equal(BN(49990000).toString())
      }, this)
    })
  })

  /* building a spending trasnaction */

  describe('#asyncBuildSpendingTxb', function () {
    it.only('asyncBuildSpendingTxb should create a spending tx', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncGenerateRevocationSecret()

        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncGenerateRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())
        yield alice.asyncBuildMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.revocationSecret.hidden())
        yield bob.asyncBuildMultisig()

console.log('alice.spending.pubkey', alice.spending.keyPair.pubKey.toString('hex'));
console.log('bob.spending.pubkey', bob.spending.keyPair.pubKey.toString('hex'));
console.log();

        let wallet = Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        yield alice.asyncBuildFundingTx(BN(1e8), output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.storeOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.storeOtherRevocationSecret(alice.revocationSecret.hidden())

        let partialCommitmentTxb = yield alice.asyncBuildCommitmentTxb(BN(5e7), BN(5e7))
        let commitmentTxb = yield bob.asyncAcceptCommitmentTx(partialCommitmentTxb)

        new TxVerifier(commitmentTxb.tx, commitmentTxb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

        let spendingTxb = yield bob.asyncBuildSpendingTxb(commitmentTxb.tx)

        let txVerifier = new TxVerifier(spendingTxb.tx, spendingTxb.uTxOutMap)

console.log('verifying the script');

        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY) // verifystr returns a string on error, or false if the tx is valid

        console.log(txVerifier.interp.getDebugString());

        error.should.equal(false)

        should.exist(spendingTxb)
      }, this)
    })
  })

  describe('#asyncOpenChannel', function () {
    it('asyncOpenChannel should store the other agents addeses and build a multisig address', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        should.not.exist(alice.fundingTx)
        should.not.exist(alice.fundingTxhashbuf)
        should.not.exist(bob.fundingTx)
        should.not.exist(bob.fundingTxhashbuf)

        // Alice opens a channel to bob
        alice.funder = true
        yield bob.asyncOpenChannel(BN(1e6), alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())

        should.exist(alice.multisig)
        should.exist(alice.fundingTx)
        should.exist(alice.other)
        should.exist(alice.other.htlcSecret)
        should.exist(alice.other.htlcSecret.hash)
        should.not.exist(alice.other.htlcSecret.buf)

        should.exist(bob.multisig)
        should.not.exist(bob.fundingTx)
        should.exist(bob.other)
        should.exist(bob.other.htlcSecret)
        should.exist(bob.other.htlcSecret.hash)
        should.not.exist(bob.other.htlcSecret.buf)
      }, this)
    })
  })

  describe('#asyncSend', function () {
    it('asyncSend should store the other agents addeses and build a multisig address', function () {
      return asink(function *() {
        let alice = Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        yield bob.asyncOpenChannel(BN(1e6), alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())
        // Alice and Bob generate new secrets for upcoming payment
        alice.sender = true
        yield alice.asyncGenerateRevocationSecret()
        yield bob.asyncGenerateRevocationSecret()

        // they also should not have a funding trasnaction
        should.exists(alice.fundingTx)
        should.exists(alice.fundingTxhashbuf)
        should.not.exists(bob.fundingTx)
        should.exists(bob.fundingTxhashbuf)

        yield bob.asyncSend(BN(4e5), BN(6e5), alice.revocationSecret.hidden())

        new TxVerifier(bob.commitmentTxb.tx, bob.commitmentTxb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid
        new TxVerifier(alice.commitmentTxb.tx, alice.commitmentTxb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

        // after the initialization phase of the protocol, both should have secrest
        should.exist(alice.other.revocationSecret)
        should.exist(bob.other.revocationSecret)
        should.exist(alice.other.htlcSecret)
        should.exist(bob.other.htlcSecret)

        should.exist(alice.commitmentTxb)
        should.exist(bob.commitmentTxb)

        alice.other.revocationSecrets.length.should.equal(1)
        // alice.revocationSecret.should
      }, this)
    })
  })
})
