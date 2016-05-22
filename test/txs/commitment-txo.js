/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let CommitmentTxo = require('../../lib/txs/commitment-txo.js')
let FundingTxo = require('../../lib/txs/funding-txo.js')
let Agent = require('../../lib/agent.js')
let Secret = require('../../lib/secret.js')
let Wallet = require('../../lib/wallet.js')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
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
        let publicAlice = yield alice.asyncToPublic()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.other = publicBob
        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.funding.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let alicesHtlcSecret = new Secret()
        yield alicesHtlcSecret.asyncInitialize()
        let bobsHtlcSecret = new Secret()
        yield bobsHtlcSecret.asyncInitialize()
        let bobsRevocationSecret = new Secret()
        yield bobsRevocationSecret.asyncInitialize()

        alice.commitmentTx = new CommitmentTxo
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7),
          alice.fundingTxo, alice.multisig,
          alice.spending, alice.other.spending,
          alicesHtlcSecret.toPublic(), bobsHtlcSecret.toPublic(),
          bobsRevocationSecret.toPublic(), alice.funder)

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

  describe('#toJson', function () {
    it('toJson should create a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicAlice = yield alice.asyncToPublic()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.other = publicBob
        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.funding.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let alicesHtlcSecret = new Secret()
        yield alicesHtlcSecret.asyncInitialize()
        let bobsHtlcSecret = new Secret()
        yield bobsHtlcSecret.asyncInitialize()
        let bobsRevocationSecret = new Secret()
        yield bobsRevocationSecret.asyncInitialize()

        alice.commitmentTx = new CommitmentTxo
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7),
          alice.fundingTxo, alice.multisig,
          alice.spending, alice.other.spending,
          alicesHtlcSecret.toPublic(), bobsHtlcSecret.toPublic(),
          bobsRevocationSecret.toPublic(), alice.funder)

        let json = alice.commitmentTx.toJson()

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

  describe('#fromJson', function () {
    it('fromJson should create CommitmentTxo from a json object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicAlice = yield alice.asyncToPublic()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.other = publicBob
        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.funding.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let alicesHtlcSecret = new Secret()
        yield alicesHtlcSecret.asyncInitialize()
        let bobsHtlcSecret = new Secret()
        yield bobsHtlcSecret.asyncInitialize()
        let bobsRevocationSecret = new Secret()
        yield bobsRevocationSecret.asyncInitialize()

        alice.commitmentTx = new CommitmentTxo
        yield alice.commitmentTx.asyncInitialize(Bn(5e7), Bn(5e7),
          alice.fundingTxo, alice.multisig,
          alice.spending, alice.other.spending,
          alicesHtlcSecret.toPublic(), bobsHtlcSecret.toPublic(),
          bobsRevocationSecret.toPublic(), alice.funder)

        let json = alice.commitmentTx.toJson()

        let tx = new CommitmentTxo().fromJson(json)

        should.exist(tx)
        should.exist(tx.txb)
        should.exist(tx.htlcOutNum)
        should.exist(tx.rhtlcOutNum)
        should.exist(tx.htlcRedeemScript)
        should.exist(tx.rhtlcRedeemScript)
        should.exist(tx.htlcScriptPubkey)
        should.exist(tx.rhtlcScriptPubkey)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('toPublic should create a public CommitmentTxo object', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicAlice = yield alice.asyncToPublic()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.other = publicBob
        yield alice.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmount = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.funding.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmount, alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let alicesHtlcSecret = new Secret()
        yield alicesHtlcSecret.asyncInitialize()
        let bobsHtlcSecret = new Secret()
        yield bobsHtlcSecret.asyncInitialize()
        let bobsRevocationSecret = new Secret()
        yield bobsRevocationSecret.asyncInitialize()

        alice.commitmentTxo = new CommitmentTxo
        yield alice.commitmentTxo.asyncInitialize(Bn(5e7), Bn(5e7),
          alice.fundingTxo, alice.multisig,
          alice.spending, alice.other.spending,
          alicesHtlcSecret.toPublic(), bobsHtlcSecret.toPublic(),
          bobsRevocationSecret.toPublic(), alice.funder)

        // set the secrets
        alice.commitmentTxo.htlcSecret.buf = alicesHtlcSecret.buf
        alice.commitmentTxo.otherHtlcSecret.buf = bobsHtlcSecret.buf
        alice.commitmentTxo.revocationSecret.buf = bobsRevocationSecret.buf
        should.exist(alice.commitmentTxo.htlcSecret.buf)
        should.exist(alice.commitmentTxo.otherHtlcSecret.buf)
        should.exist(alice.commitmentTxo.revocationSecret.buf)

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
