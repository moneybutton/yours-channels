/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let OutputDescription = require('../../lib/output-description')
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
let SecretHelper = require('../test-helpers/secret-helper')

describe('CommitmentTxObj', function () {
  it('should exist', function () {
    should.exist(CommitmentTxObj)
    should.exist(new CommitmentTxObj())
  })

  describe('#asyncBuild', function () {
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

        let outputList = [new OutputDescription(
          alice.id, 'finalDestId', htlcSecret, revocationSecret, Bn(1e7)
        )]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId', htlcSecret, revocationSecret
        )
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
        yield commitmentTxObj.asyncBuild()

        let txVerifier, error
        txVerifier = new TxVerifier(commitmentTxObj.txb.tx, commitmentTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal('input 0 failed script verify')

        should.exist(commitmentTxObj)
        should.exist(commitmentTxObj.multisigAddress)
        should.exist(commitmentTxObj.ownerDesitinationAddress)
        should.exist(commitmentTxObj.builderDestinationAddress)
        should.exist(commitmentTxObj.outputList)
        should.exist(commitmentTxObj.changeOutput)
        should.exist(commitmentTxObj.ownerId)
        should.exist(commitmentTxObj.builderId)
        should.exist(commitmentTxObj.txb)

        should.exist(commitmentTxObj.outputList[0])
        should.exist(commitmentTxObj.outputList[0].redeemScript)
        should.exist(commitmentTxObj.outputList[0].scriptPubkey)

        SecretHelper.checkSecretNotHidden(commitmentTxObj.outputList[0].htlcSecret)
        SecretHelper.checkSecretNotHidden(commitmentTxObj.outputList[0].revocationSecret)
        SecretHelper.checkSecretNotHidden(commitmentTxObj.changeOutput.htlcSecret)
        SecretHelper.checkSecretNotHidden(commitmentTxObj.changeOutput.revocationSecret)
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

        let outputList = [new OutputDescription(
          alice.id, 'finalDestId', htlcSecret, revocationSecret, Bn(1e7)
        )]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId', htlcSecret, revocationSecret
        )
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
        yield commitmentTxObj.asyncBuild()
        let json = commitmentTxObj.toJSON()

        should.exist(json)
        should.exist(json.multisigAddress)
        should.exist(json.ownerDesitinationAddress)
        should.exist(json.builderDestinationAddress)
        should.exist(json.outputList)
        should.exist(json.changeOutput)
        should.exist(json.ownerId)
        should.exist(json.builderId)
        should.exist(json.txb)

        SecretHelper.checkSecretNotHidden(json.outputList[0].htlcSecret)
        SecretHelper.checkSecretNotHidden(json.outputList[0].revocationSecret)
        SecretHelper.checkSecretNotHidden(json.changeOutput.htlcSecret)
        SecretHelper.checkSecretNotHidden(json.changeOutput.revocationSecret)
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

        let outputList = [new OutputDescription(
          alice.id, 'finalDestId', htlcSecret, revocationSecret, Bn(1e7)
        )]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId', htlcSecret, revocationSecret
        )
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
        yield commitmentTxObj.asyncBuild()

        let json = commitmentTxObj.toJSON()
        let txo = new CommitmentTxObj().fromJSON(json)

        should.exist(txo)
        should.exist(txo.multisigAddress)
        should.exist(txo.ownerDesitinationAddress)
        should.exist(txo.builderDestinationAddress)
        should.exist(txo.outputList)
        should.exist(txo.changeOutput)
        should.exist(txo.ownerId)
        should.exist(txo.builderId)
        should.exist(txo.txb)

        SecretHelper.checkSecretNotHidden(txo.outputList[0].htlcSecret)
        SecretHelper.checkSecretNotHidden(txo.outputList[0].revocationSecret)
        SecretHelper.checkSecretNotHidden(txo.changeOutput.htlcSecret)
        SecretHelper.checkSecretNotHidden(txo.changeOutput.revocationSecret)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('should create a public CommitmentTxObj object', function () {
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

        let outputList = [new OutputDescription(
          alice.id, 'finalDestId', htlcSecret, revocationSecret, Bn(1e7)
        )]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId', htlcSecret, revocationSecret
        )
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
        yield commitmentTxObj.asyncBuild()
        let txo = commitmentTxObj.toPublic()

        should.exist(txo)
        should.exist(txo.multisigAddress)
        should.exist(txo.ownerDesitinationAddress)
        should.exist(txo.builderDestinationAddress)
        should.exist(txo.outputList)
        should.exist(txo.changeOutput)
        should.exist(txo.ownerId)
        should.exist(txo.builderId)
        should.exist(txo.txb)

        SecretHelper.checkSecretHidden(txo.outputList[0].htlcSecret)
        SecretHelper.checkSecretHidden(txo.outputList[0].revocationSecret)
        SecretHelper.checkSecretHidden(txo.changeOutput.htlcSecret)
        SecretHelper.checkSecretHidden(txo.changeOutput.revocationSecret)
      }, this)
    })
  })
})
