/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let CommitmentTxObj = require('../../lib/txs/commitment-tx-obj')
let FundingTxObj = require('../../lib/txs/funding-tx-obj')
let HtlcSecret = require('../../lib/scrts/htlc-secret')
let RevocationSecret = require('../../lib/scrts/revocation-secret')
let Agent = require('../../lib/agent')
let Wallet = require('../../lib/wallet')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

describe('CommitmentTxObj', function () {
  it('should exist', function () {
    should.exist(CommitmentTxObj)
    should.exist(new CommitmentTxObj())
  })

  describe('#asyncInitialize', function () {
    it('should create a partial payment tx', function () {
      return asink(function * () {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.funder = true
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.other = yield bob.asyncToPublic()
        bob.other = yield alice.asyncToPublic()

        yield alice.multisigAddress.asyncInitialize(alice.other.multisigAddress.pubKey)

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let htlcSecret = new HtlcSecret()
        yield htlcSecret.asyncInitialize()
        let revocationSecret = new RevocationSecret()
        yield revocationSecret.asyncInitialize()

        let outputList = [{
          intermediateDestId: alice.id,
          finalDestId: 'not used yet',
          amount: Bn(1e7),
          htlcSecret: htlcSecret,
          revocationSecret: revocationSecret
        }]
        let changeOutput = {
          intermediateDestId: bob.id,
          finalDestId: 'not used yet',
          htlcSecret: htlcSecret,
          revocationSecret: revocationSecret
        }
        let destinationAddresses = {}
        destinationAddresses[alice.id] = alice.destinationAddress
        destinationAddresses[bob.id] = bob.destinationAddress
        let commitmentTxObj = new CommitmentTxObj()
        commitmentTxObj.multisigAddress = alice.multisigAddress
        commitmentTxObj.fundingTxObj = alice.fundingTxObj
        commitmentTxObj.outputList = outputList
        commitmentTxObj.changeOutput = changeOutput
        commitmentTxObj.ownerDesitinationAddress = bob.destinationAddress
        commitmentTxObj.builderDestinationAddress = alice.destinationAddress
        commitmentTxObj.ownerId = bob.id
        commitmentTxObj.builderId = alice.id

        yield commitmentTxObj.asyncBuild(
          outputList,
          changeOutput,
          bob.id,
          alice.id
        )

        let txVerifier, error
        txVerifier = new TxVerifier(commitmentTxObj.txb.tx, commitmentTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal('input 0 failed script verify')
      }, this)
    })
  })

  describe('#toJSON', function () {
    it.skip('should create a json object', function () {
      return asink(function * () {
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
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTx = new CommitmentTxObj()
        alice.commitmentTx.initializeOtherSecrets(bob.getCommitmentTxObj(1).htlcSecret, bob.getCommitmentTxObj(1).revocationSecret)
        alice.commitmentTx.initializeSecrets(alice.getCommitmentTxObj(1).htlcSecret, alice.getCommitmentTxObj(1).revocationSecret)
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxObj,
          alice.multisigAddress, alice.destinationAddress, alice.other.destinationAddress, alice.funder)

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
    it.skip('should create CommitmentTxObj from a json object', function () {
      return asink(function * () {
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
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTx = new CommitmentTxObj()
        alice.commitmentTx.initializeOtherSecrets(bob.getCommitmentTxObj(1).htlcSecret, bob.getCommitmentTxObj(1).revocationSecret)
        alice.commitmentTx.initializeSecrets(alice.getCommitmentTxObj(1).htlcSecret, alice.getCommitmentTxObj(1).revocationSecret)
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxObj,
          alice.multisigAddress, alice.destinationAddress, alice.other.destinationAddress, alice.funder)

        let json = alice.commitmentTx.toJSON()
        let txo = new CommitmentTxObj().fromJSON(json)

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
    it.skip('should create a public CommitmentTxObj object', function () {
      return asink(function * () {
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
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        alice.commitmentTxObj = new CommitmentTxObj()
        alice.commitmentTxObj.initializeOtherSecrets(bob.getCommitmentTxObj(1).htlcSecret, bob.getCommitmentTxObj(1).revocationSecret)
        alice.commitmentTxObj.initializeSecrets(alice.getCommitmentTxObj(1).htlcSecret, alice.getCommitmentTxObj(1).revocationSecret)
        yield alice.commitmentTxObj.asyncInitialize(Bn(5e7), Bn(5e7), alice.fundingTxObj,
          alice.multisigAddress, alice.destinationAddress, alice.other.destinationAddress, alice.funder)

        let txo = alice.commitmentTxObj.toPublic()

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
