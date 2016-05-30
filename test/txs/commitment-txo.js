/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let CommitmentTxo = require('../../lib/txs/commitment-txo.js')
let FundingTxo = require('../../lib/txs/funding-txo.js')
let Agent = require('../../lib/agent.js')
let Wallet = require('../../lib/wallet.js')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

describe('CommitmentTxo', function () {
  it('should exist', function () {
    should.exist(CommitmentTxo)
    should.exist(new CommitmentTxo())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should create a partial payment tx', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.funder = true
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        bob.initializeOther(yield alice.asyncToPublic())

        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.source.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.source, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTx = new CommitmentTxo()
        alice.commitmentTx.initializeOtherSecrets(bob.getCommitmentTxo().htlcSecret, bob.getCommitmentTxo().revocationSecret)
        alice.commitmentTx.initializeSecrets(alice.getCommitmentTxo().htlcSecret, alice.getCommitmentTxo().revocationSecret)
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxo,
          alice.multisig, alice.destination, alice.other.destination, alice.funder)

        let txVerifier = new TxVerifier(alice.commitmentTx.txb.tx, alice.commitmentTx.txb.uTxOutMap)
        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)

        // we expect an error here as the transaction is not fully signed
        error.should.equal('input 0 failed script verify')
        should.exist(alice.commitmentTx.htlcOutNum)
        should.exist(alice.commitmentTx.rhtlcOutNum)
        alice.commitmentTx.txb.tx.txIns.length.should.equal(1)
        alice.commitmentTx.txb.tx.txOuts.length.should.equal(2)
        ;(alice.commitmentTx.txb.tx.txOuts[0].valueBn.toString()).should.equal(Bn(5e7).toString())
        ;(alice.commitmentTx.txb.tx.txOuts[1].valueBn.toString()).should.equal(Bn(49990000).toString())
      }, this)
    })
  })

  describe('#toJSON', function () {
    it('toJSON should create a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.funder = true
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        bob.initializeOther(yield alice.asyncToPublic())

        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.source.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.source, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTx = new CommitmentTxo()
        alice.commitmentTx.initializeOtherSecrets(bob.getCommitmentTxo().htlcSecret, bob.getCommitmentTxo().revocationSecret)
        alice.commitmentTx.initializeSecrets(alice.getCommitmentTxo().htlcSecret, alice.getCommitmentTxo().revocationSecret)
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxo,
          alice.multisig, alice.destination, alice.other.destination, alice.funder)

        let json = alice.commitmentTx.toJSON()

        should.exist(json)
        should.exist(json.txb)
        should.exist(json.htlcOutNum)
        should.exist(json.rhtlcOutNum)
        should.exist(json.htlcRedeemScript)
        should.exist(json.rhtlcRedeemScript)
        should.exist(json.htlcScriptPubkey)
        should.exist(json.rhtlcScriptPubkey)
      }, this)
    })
  })

  describe('#fromJSON', function () {
    it('fromJSON should create CommitmentTxo from a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.funder = true
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        bob.initializeOther(yield alice.asyncToPublic())

        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.source.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.source, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTx = new CommitmentTxo()
        alice.commitmentTx.initializeOtherSecrets(bob.getCommitmentTxo().htlcSecret, bob.getCommitmentTxo().revocationSecret)
        alice.commitmentTx.initializeSecrets(alice.getCommitmentTxo().htlcSecret, alice.getCommitmentTxo().revocationSecret)
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxo,
          alice.multisig, alice.destination, alice.other.destination, alice.funder)

        let json = alice.commitmentTx.toJSON()
        let txo = new CommitmentTxo().fromJSON(json)

        should.exist(txo)
        should.exist(txo.txb)
        txo.htlcOutNum.should.equal(1)
        txo.rhtlcOutNum.should.equal(0)
        should.exist(txo.htlcRedeemScript)
        should.exist(txo.rhtlcRedeemScript)
        should.exist(txo.htlcScriptPubkey)
        should.exist(txo.rhtlcScriptPubkey)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('toPublic should create a public CommitmentTxo object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.funder = true
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        bob.initializeOther(yield alice.asyncToPublic())

        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.source.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.source, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTxo = new CommitmentTxo()
        alice.commitmentTxo.initializeOtherSecrets(bob.getCommitmentTxo().htlcSecret, bob.getCommitmentTxo().revocationSecret)
        alice.commitmentTxo.initializeSecrets(alice.getCommitmentTxo().htlcSecret, alice.getCommitmentTxo().revocationSecret)
        yield alice.commitmentTxo.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxo,
          alice.multisig, alice.destination, alice.other.destination, alice.funder)

        let txo = alice.commitmentTxo.toPublic()

        should.exist(txo)
        should.exist(txo.txb)
        should.exist(txo.htlcOutNum)
        should.exist(txo.rhtlcOutNum)
        should.exist(txo.htlcRedeemScript)
        should.exist(txo.rhtlcRedeemScript)
        should.exist(txo.htlcScriptPubkey)
        should.exist(txo.rhtlcScriptPubkey)

        // check that secrets are hidden after toPublic
        should.exist(txo.htlcSecret)
        should.exist(txo.htlcSecret.hash)
        should.not.exist(txo.htlcSecret.buf)
        should.exist(txo.otherHtlcSecret)
        should.exist(txo.otherHtlcSecret.hash)
        should.not.exist(txo.otherHtlcSecret.buf)
        should.exist(txo.revocationSecret)
        should.exist(txo.revocationSecret.hash)
        should.not.exist(txo.revocationSecret.buf)
      }, this)
    })
  })
})
