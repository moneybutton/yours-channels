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
// let SecretHelper = require('../test-helpers/secret-helper')
let SpendingTxObj = require('../../lib/txs/spending-tx-obj')

describe('SpendingTxObj', function () {
  it('should exist', function () {
    should.exist(SpendingTxObj)
    should.exist(new SpendingTxObj())
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
        commitmentTxObj.ownerDestinationAddress = bob.destinationAddress
        commitmentTxObj.builderDestinationAddress = alice.destinationAddress
        commitmentTxObj.ownerId = bob.id
        commitmentTxObj.builderId = alice.id
        yield commitmentTxObj.asyncBuild()

        let txVerifier, error
        txVerifier = new TxVerifier(commitmentTxObj.txb.tx, commitmentTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal('input 0 failed script verify')

        commitmentTxObj.outputList[0].spendingAction = 'spend'

        let spendingTxObj = new SpendingTxObj()
        yield spendingTxObj.asyncBuild(alice.destinationAddress, commitmentTxObj)
      }, this)
    })
  })
})
