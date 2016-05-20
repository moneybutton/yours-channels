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

        let sue = new CommitmentTxo().fromJson(json)

        should.exist(sue)
        should.exist(sue.txb)
        should.exist(sue.htlcOutNum)
        should.exist(sue.rhtlcOutNum)
        should.exist(sue.htlcRedeemScript)
        should.exist(sue.rhtlcRedeemScript)
        should.exist(sue.htlcScriptPubkey)
        should.exist(sue.rhtlcScriptPubkey)
      }, this)
    })
  })
})
