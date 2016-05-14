/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let CnlTxBuilder = require('../lib/cnl-tx-builder.js')
let Wallet = require('../lib/wallet.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let BN = require('yours-bitcoin/lib/bn')

describe('CnlTxBuilder', function () {
  it('should exist', function () {
    should.exist(CnlTxBuilder)
    should.exist(new CnlTxBuilder())
  })

  describe('#asyncBuildFundingTxb', function () {
    it('asyncBuildFundingTxb should create a funding tx', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        // build output to be spent in funding transaction
        let inputAmountBN = BN(1e10)
        let fundingAmount = BN(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBN, alice.funding.keyPair.pubKey)

        let txb = yield CnlTxBuilder.asyncBuildFundingTx(fundingAmount, alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let txVerifier = new TxVerifier(txb.tx, txb.uTxOutMap)
        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        error.should.equal(false)

        should.exist(txb.tx.toJson())

        // first output should equal amount
        txb.tx.txOuts[0].valueBn.eq(fundingAmount).should.equal(true)
        // there should be one output
        txb.tx.toJson().txIns.length.should.equal(1)
        // and two inputs
        txb.tx.toJson().txOuts.length.should.equal(2)
        ;(txb.tx.toJson().txOuts[0].valueBn).should.equal(fundingAmount.toString())
      }, this)
    })
  })

  describe('#asyncBuildCommitmentTxb', function () {
    it('asyncBuildCommitmentTxb should create a partial payment tx', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()
        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        let {txb, htlcOutNum, rhtlcOutNum} = yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder)

        let txVerifier = new TxVerifier(txb.tx, txb.uTxOutMap)
        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)

        // we expect an error here as the transaction is not fully signed
        error.should.equal('input 0 failed script verify')
        should.exist(htlcOutNum)
        should.exist(rhtlcOutNum)
        txb.tx.txIns.length.should.equal(1)
        txb.tx.txOuts.length.should.equal(2)
        ;(txb.tx.txOuts[0].valueBn.toString()).should.equal(BN(5e7).toString())
        ;(txb.tx.txOuts[1].valueBn.toString()).should.equal(BN(49990000).toString())
      }, this)
    })
  })

  describe('#asyncBuildSpendingTx', function () {
    it('asyncBuildSpendingTx should create a htlc enforcing tx; case where Alice funds channel', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()
        // bob.funder = true

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)

        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        let commitmentObj = yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder)
        alice.setCommitmentTxb(commitmentObj)
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)

        let txVerifier, error

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        let bobsSpendingTxb = yield CnlTxBuilder.asyncBuildSpendingTx(bob.commitmentTxb.tx, bob.spending, bob.htlcSecret, bob.rhtlcOutNum)
        txVerifier = new TxVerifier(bobsSpendingTxb.tx, bobsSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(bobsSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })
  })

  describe('#asyncBuildOtherSpendingTx', function () {
    it('asyncBuildOtherSpendingTx should create a htlc enforcing tx; case where Alice funds channel', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        let txVerifier, error
        let alicesSpendingTxb = yield CnlTxBuilder.asyncBuildOtherSpendingTx(bob.commitmentTxb.tx, alice.spending, alice.htlcSecret, alice.htlcOutNum)
        txVerifier = new TxVerifier(alicesSpendingTxb.tx, alicesSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(alicesSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        let bobsSpendingTxb = yield CnlTxBuilder.asyncBuildOtherSpendingTx(bob.commitmentTxb.tx, bob.spending, bob.htlcSecret, bob.htlcOutNum)
        txVerifier = new TxVerifier(bobsSpendingTxb.tx, bobsSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(bobsSpendingTxb)
        error.should.equal('input 0 failed script verify')
      }, this)
    })
  })

  describe('#asyncBuildHtlcEnforcementTx', function () {
    it('asyncBuildHtlcEnforcementTx should create a htlc enforcing tx; case where Alice funds channel', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()
        // bob.funder = true

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        let txVerifier, error
        let bobsSpendingTxb = yield CnlTxBuilder.asyncBuildHtlcEnforcementTx(bob.commitmentTxb.tx, bob.spending, bob.htlcOutNum)
        txVerifier = new TxVerifier(bobsSpendingTxb.tx, bobsSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(bobsSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('asyncBuildHtlcEnforcementTx should create a htlc enforcing tx; case where Bob funds channel', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()
        bob.funder = true

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        let txVerifier, error
        let bobsSpendingTxb = yield CnlTxBuilder.asyncBuildHtlcEnforcementTx(bob.commitmentTxb.tx, bob.spending, bob.htlcOutNum)

        txVerifier = new TxVerifier(bobsSpendingTxb.tx, bobsSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(bobsSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })
  })

  describe('#asyncBuildOtherHtlcEnforcementTx', function () {
    it('asyncBuildOtherHtlcEnforcementTx should create a htlc enforcing tx; case where Alice funds channel', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()
        // bob.funder = true

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)

        // Alice cannot spend using asyncBuildHtlcEnforcementTx, she must use asyncBuildOtherHtlcEnforcementTx
        let txVerifier, error
        let alicesSpendingTxb = yield CnlTxBuilder.asyncBuildHtlcEnforcementTx(bob.commitmentTxb.tx, alice.spending, alice.htlcOutNum)

        txVerifier = new TxVerifier(alicesSpendingTxb.tx, alicesSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(alicesSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('asyncBuildOtherHtlcEnforcementTx should create a htlc enforcing tx; case where Bob funds channel', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()
        bob.funder = true

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)
        let txVerifier, error

        // Alice cannot spend using asyncBuildHtlcEnforcementTx, she must use asyncBuildOtherHtlcEnforcementTx
        let alicesSpendingTxb = yield CnlTxBuilder.asyncBuildHtlcEnforcementTx(bob.commitmentTxb.tx, alice.spending, alice.htlcOutNum)

        txVerifier = new TxVerifier(alicesSpendingTxb.tx, alicesSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(alicesSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })
  })

  describe('#asyncSpendRevokedCommitmentTx', function () {
    it('asyncSpendRevokedCommitmentTx should revoke a old commitment trasnaction made by the other party', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()
        // bob.funder = true

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), output.txhashbuf, output.txout)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxb(yield CnlTxBuilder.asyncBuildCommitmentTxb(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)
        let txVerifier, error

        let bool = yield alice.setOtherRevocationSecretSolution(bob.revocationSecret)
        bool.should.equal(true)

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        let bobsSpendingTxb = yield CnlTxBuilder.asyncSpendRevokedCommitmentTx(bob.commitmentTxb.tx, alice.other, alice.spending, alice.revocationSecret, alice.rhtlcOutNum)
        txVerifier = new TxVerifier(bobsSpendingTxb.tx, bobsSpendingTxb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        should.exist(bobsSpendingTxb)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })
  })
})
