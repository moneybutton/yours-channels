/* global describe,it,beforeEach */
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
let KeyPair = require('yours-bitcoin/lib/key-pair')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Address = require('yours-bitcoin/lib/address')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let SpendingTxObj = require('../../lib/txs/spending-tx-obj')

let bob, carol
let htlcSecret, revocationSecret
let bips, bobBip32, carolBip32
let outputList, commitmentTxObj

describe('SpendingTxObj', function () {
  it('should exist', function () {
    should.exist(SpendingTxObj)
    should.exist(new SpendingTxObj())
  })

  beforeEach(function () {
    return asink(function * () {
      bob = new Agent('bob')
      yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
      bob.funder = true
      carol = new Agent('carol')
      yield carol.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

      bob.other = yield carol.asyncToPublic()
      carol.other = yield bob.asyncToPublic()

      yield bob.multisigAddress.asyncInitialize(bob.other.multisigAddress.pubKey)

      let inputAmountBn = Bn(1e10)
      let fundingAmount = Bn(1e8)
      let wallet = new Wallet()
      let output = wallet.getUnspentOutput(inputAmountBn, bob.sourceAddress.keyPair.pubKey)

      bob.fundingTxObj = new FundingTxObj()
      yield bob.fundingTxObj.asyncInitialize(
        fundingAmount,
        bob.sourceAddress,
        bob.multisigAddress,
        output.txhashbuf,
        output.txoutnum,
        output.txout,
        output.pubKey,
        output.inputTxout)

      htlcSecret = new HtlcSecret()
      yield htlcSecret.asyncInitialize()
      revocationSecret = new RevocationSecret()
      yield revocationSecret.asyncInitialize()

      bobBip32 = new Bip32().fromRandom()
      carolBip32 = new Bip32().fromRandom()
      bips = {
        bob: bobBip32.toPublic(),
        carol: carolBip32.toPublic()
      }

      outputList = [
        new OutputDescription(
          'htlc',
          'alice', 'bob', 'carol', 'dave',
          'm/1/2', 'm/4/5',
          htlcSecret, revocationSecret,
          Bn(1e7)),
        new OutputDescription(
          'htlc',
          'alice', 'bob', 'carol', 'dave',
          'm/1/2', 'm/4/5',
          htlcSecret, revocationSecret,
          Bn(1e7))
      ]

      commitmentTxObj = new CommitmentTxObj()
      commitmentTxObj.outputList = outputList
      yield commitmentTxObj.asyncBuild(
        bob.fundingTxObj.txb,
        bob.multisigAddress,
        carol.id,
        bips)
      yield commitmentTxObj.txb.asyncSign(0, bob.multisigAddress.keyPair, bob.fundingTxObj.txb.tx.txOuts[0])
    }, this)
  })

  describe('#asyncBuild', function () {
    it('build a spending transaction. Case htlc', function () {
      return asink(function * () {
        commitmentTxObj.outputList[0].spendingAction = 'spend'
        commitmentTxObj.outputList[1].spendingAction = 'spend'

        let txVerifier, error

        let bobSpendingTxObj = new SpendingTxObj()
        let address = new Address().fromPrivKey(new PrivKey().fromRandom())
        yield bobSpendingTxObj.asyncBuild(address, commitmentTxObj, carolBip32, carol.id)
        txVerifier = new TxVerifier(bobSpendingTxObj.txb.tx, bobSpendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it.skip('build a spending transaction that spends from htlc output', function () {
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

        let outputList = [
          new OutputDescription(bob.id, 'finalDestId1', new KeyPair().fromRandom(), 'pubKey', htlcSecret, revocationSecret, Bn(1e7))
        ]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId2', new KeyPair().fromRandom(), 'pubKey', htlcSecret, revocationSecret
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
        yield commitmentTxObj.txb.asyncSign(0, alice.multisigAddress.keyPair, alice.fundingTxObj.txb.tx.txOuts[0])

        commitmentTxObj.outputList[0].spendingAction = 'spend'

        let txVerifier, error
        let aliceSpendingTxObj = new SpendingTxObj()
        yield aliceSpendingTxObj.asyncBuild(alice.destinationAddress, commitmentTxObj)
        txVerifier = new TxVerifier(aliceSpendingTxObj.txb.tx, aliceSpendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)

        let bobSpendingTxObj = new SpendingTxObj()
        yield bobSpendingTxObj.asyncBuild(bob.destinationAddress, commitmentTxObj)
        txVerifier = new TxVerifier(bobSpendingTxObj.txb.tx, bobSpendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)
      }, this)
    })

    it.skip('build a spending transaction that spends from multiple htlc output', function () {
      return asink(function * () {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.funder = true
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.other = yield bob.asyncToPublic()
        bob.other = yield alice.asyncToPublic()

        yield alice.multisigAddress.asyncInitialize(alice.other.multisigAddress.pubKey)

        let inputAmountBn = Bn(1e12)
        let fundingAmount = Bn(1e11)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.sourceAddress.keyPair.pubKey)

        alice.fundingTxObj = new FundingTxObj()
        yield alice.fundingTxObj.asyncInitialize(fundingAmount, alice.sourceAddress, alice.multisigAddress, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let htlcSecret = new HtlcSecret()
        yield htlcSecret.asyncInitialize()
        let revocationSecret = new RevocationSecret()
        yield revocationSecret.asyncInitialize()

        let outputList = [
          new OutputDescription(alice.id, 'finalDestId1', new KeyPair().fromRandom(), 'htlc', htlcSecret, revocationSecret, Bn(1e7)),
          new OutputDescription(alice.id, 'finalDestId1', new KeyPair().fromRandom(), 'htlc', htlcSecret, revocationSecret, Bn(1e7)),
          new OutputDescription(bob.id, 'finalDestId1', new KeyPair().fromRandom(), 'pubKey', htlcSecret, revocationSecret, Bn(1e7))
        ]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId2', new KeyPair().fromRandom(), 'pubKey', htlcSecret, revocationSecret
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
        yield commitmentTxObj.txb.asyncSign(0, alice.multisigAddress.keyPair, alice.fundingTxObj.txb.tx.txOuts[0])

        commitmentTxObj.outputList[0].spendingAction = 'spend'
        commitmentTxObj.outputList[1].spendingAction = 'spend'
        commitmentTxObj.outputList[1].spendingAction = 'spend'

        let txVerifier, error
        let aliceSpendingTxObj = new SpendingTxObj()
        yield aliceSpendingTxObj.asyncBuild(alice.destinationAddress, commitmentTxObj)
        txVerifier = new TxVerifier(aliceSpendingTxObj.txb.tx, aliceSpendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)

        let bobSpendingTxObj = new SpendingTxObj()
        yield bobSpendingTxObj.asyncBuild(bob.destinationAddress, commitmentTxObj)
        txVerifier = new TxVerifier(bobSpendingTxObj.txb.tx, bobSpendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)
      }, this)
    })
  })
})
