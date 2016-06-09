/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Agent = require('../../lib/agent')
let Wallet = require('../../lib/wallet')
let FundingTxObj = require('../../lib/txs/funding-tx-obj')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

describe('FundingTxObj', function () {
  it('should exist', function () {
    should.exist(FundingTxObj)
    should.exist(new FundingTxObj())
  })

  describe('#asyncInitialize', function () {
    it.skip('should create a funding tx', function () {
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

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let txVerifier = new TxVerifier(alice.fundingTxObj.txb.tx, alice.fundingTxObj.txb.uTxOutMap)
        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        error.should.equal(false)

        // first output should equal amount
        alice.fundingTxObj.txb.tx.txOuts[0].valueBn.eq(fundingAmount).should.equal(true)
        // there should be one output
        alice.fundingTxObj.txb.tx.toJSON().txIns.length.should.equal(1)
        // and two inputs
        alice.fundingTxObj.txb.tx.toJSON().txOuts.length.should.equal(2)
        ;(alice.fundingTxObj.txb.tx.toJSON().txOuts[0].valueBn).should.equal(fundingAmount.toString())
      }, this)
    })
  })

  describe('#toJSON', function () {
    it.skip('should convert into a json object', function () {
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

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let json = alice.fundingTxObj.toJSON()

        should.exist(json.txb)
        should.exist(json.amount)
      }, this)
    })
  })

  describe('#fromJSON', function () {
    it.skip('should convert into a json object', function () {
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

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let json = alice.fundingTxObj.toJSON()

        let fundingTxObj = new FundingTxObj().fromJSON(json)

        should.exist(fundingTxObj.txb)
        should.exist(fundingTxObj.amount)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it.skip('should convert into a json object', function () {
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

        bob.fundingTxObj = new FundingTxObj()
        yield bob.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let publicFundingTxObj = yield bob.fundingTxObj.asyncToPublic()

        should.exist(publicFundingTxObj.txb)
        should.exist(publicFundingTxObj.amount)

        JSON.stringify(Object.keys(publicFundingTxObj.txb.tx))
          .should.equal('["versionBytesNum","txInsVi","txIns","txOutsVi","txOuts","nLockTime","hash"]')
        publicFundingTxObj.txb.tx.versionBytesNum.should.equal(1)
        publicFundingTxObj.txb.tx.txInsVi.toString().should.equal('00')
        publicFundingTxObj.txb.tx.txIns.should.deepEqual([])
        publicFundingTxObj.txb.tx.txOutsVi.toString().should.equal('00')
        should.exist(publicFundingTxObj.txb.tx.txOuts)
        publicFundingTxObj.txb.tx.nLockTime.toString().should.equal('0')
      }, this)
    })
  })
})
