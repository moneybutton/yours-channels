/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Agent = require('../../lib/agent.js')
let Wallet = require('../../lib/wallet.js')
let FundingTxo = require('../../lib/txs/funding-txo.js')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

describe('FundingTxo', function () {
  it('should exist', function () {
    should.exist(FundingTxo)
    should.exist(new FundingTxo())
  })

  describe('#asyncInitialize', function () {
    it('should create a funding tx', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        yield alice.asyncInitializeMultisig()

        bob.initializeOther(yield alice.asyncToPublic())
        yield bob.asyncInitializeMultisig()

        // build output to be spent in funding transaction
        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let txVerifier = new TxVerifier(alice.fundingTxo.txb.tx, alice.fundingTxo.txb.uTxOutMap)
        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        error.should.equal(false)

        // first output should equal amount
        alice.fundingTxo.txb.tx.txOuts[0].valueBn.eq(fundingAmount).should.equal(true)
        // there should be one output
        alice.fundingTxo.txb.tx.toJSON().txIns.length.should.equal(1)
        // and two inputs
        alice.fundingTxo.txb.tx.toJSON().txOuts.length.should.equal(2)
        ;(alice.fundingTxo.txb.tx.toJSON().txOuts[0].valueBn).should.equal(fundingAmount.toString())
      }, this)
    })
  })

  describe('#toJSON', function () {
    it('should convert into a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        yield alice.asyncInitializeMultisig()

        bob.initializeOther(yield alice.asyncToPublic())
        yield bob.asyncInitializeMultisig()

        // build output to be spent in funding transaction
        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let json = alice.fundingTxo.toJSON()

        should.exist(json.txb)
        should.exist(json.amount)
      }, this)
    })
  })

  describe('#fromJSON', function () {
    it('should convert into a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        yield alice.asyncInitializeMultisig()

        bob.initializeOther(yield alice.asyncToPublic())
        yield bob.asyncInitializeMultisig()

        // build output to be spent in funding transaction
        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let json = alice.fundingTxo.toJSON()

        let fundingTxo = new FundingTxo().fromJSON(json)

        should.exist(fundingTxo.txb)
        should.exist(fundingTxo.amount)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('should convert into a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicAlice = yield alice.asyncToPublic()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.other = publicBob
        yield alice.asyncInitializeMultisig()

        bob.other = publicAlice
        yield bob.asyncInitializeMultisig()

        // build output to be spent in funding transaction
        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        bob.fundingTxo = new FundingTxo()
        yield bob.fundingTxo.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let publicFundingTxo = yield bob.fundingTxo.asyncToPublic()

        should.exist(publicFundingTxo.txb)
        should.exist(publicFundingTxo.amount)

        JSON.stringify(Object.keys(publicFundingTxo.txb.tx))
          .should.equal('["versionBytesNum","txInsVi","txIns","txOutsVi","txOuts","nLockTime","hash"]')
        publicFundingTxo.txb.tx.versionBytesNum.should.equal(1)
        publicFundingTxo.txb.tx.txInsVi.toString().should.equal('00')
        publicFundingTxo.txb.tx.txIns.should.deepEqual([])
        publicFundingTxo.txb.tx.txOutsVi.toString().should.equal('00')
        should.exist(publicFundingTxo.txb.tx.txOuts)
        publicFundingTxo.txb.tx.nLockTime.toString().should.equal('0')
      }, this)
    })
  })
})
