/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let CommitmentTxo = require('../lib/txs/commitment-txo.js')
let FundingTxo = require('../lib/txs/funding-txo.js')
let HtlcSecret = require('../lib/scrts/htlc-secret.js')
let RevocationSecret = require('../lib/scrts/revocation-secret.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let Bn = require('yours-bitcoin/lib/bn')
let Wallet = require('../lib/wallet.js')


let asyncTestSecretChecks = function (secret) {
  return asink(function *() {
    should.exist(secret)
    should.exist(secret.buf)
    should.exist(secret.hash)
    let check = yield secret.asyncCheck()
    check.should.equal(true)
  }, this)
}

let asyncTestSecretIsHidden = function (secret) {
  return asink(function *() {
    should.exist(secret)
    should.not.exist(secret.buf)
    should.exist(secret.hash)
  }, this)
}

let testSecretsMatch = function (secret1, secret2) {
  secret1.hash.toString('hex').should.equal(secret2.hash.toString('hex'))
}

let asyncTestSecrets = function (txNum, alice, bob) {
  return asink(function *() {
    should.exist(alice.commitmentTxos[txNum])
    should.exist(alice.commitmentTxos[txNum].htlcSecret)
    should.exist(alice.commitmentTxos[txNum].revocationSecret)
    yield asyncTestSecretChecks(alice.commitmentTxos[txNum].htlcSecret)
    yield asyncTestSecretChecks(alice.commitmentTxos[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(alice.other.commitmentTxos[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(alice.other.commitmentTxos[txNum].htlcSecret)
    // check that alices stores the public version of bob's secrets
    testSecretsMatch(alice.commitmentTxos[txNum].htlcSecret, bob.other.commitmentTxos[txNum].htlcSecret)
    testSecretsMatch(alice.commitmentTxos[txNum].revocationSecret, bob.other.commitmentTxos[txNum].revocationSecret)
    testSecretsMatch(alice.commitmentTxos[txNum].otherHtlcSecret, bob.other.commitmentTxos[txNum].otherHtlcSecret)
    testSecretsMatch(alice.commitmentTxos[txNum].otherRevocationSecret, bob.other.commitmentTxos[txNum].otherRevocationSecret)

    // same tests for bob
    should.exist(bob.commitmentTxos[txNum])
    yield asyncTestSecretChecks(bob.commitmentTxos[txNum].revocationSecret)
    yield asyncTestSecretChecks(bob.commitmentTxos[txNum].htlcSecret)
    yield asyncTestSecretIsHidden(bob.other.commitmentTxos[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(bob.other.commitmentTxos[txNum].htlcSecret)
    testSecretsMatch(bob.commitmentTxos[txNum].revocationSecret, alice.other.commitmentTxos[txNum].revocationSecret)
    testSecretsMatch(bob.commitmentTxos[txNum].htlcSecret, alice.other.commitmentTxos[txNum].htlcSecret)
    testSecretsMatch(bob.commitmentTxos[txNum].otherHtlcSecret, alice.other.commitmentTxos[txNum].otherHtlcSecret)
    testSecretsMatch(bob.commitmentTxos[txNum].otherRevocationSecret, alice.other.commitmentTxos[txNum].otherRevocationSecret)
  }, this)
}

describe('Agent', function () {
  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
  })

  describe('#sendOutputList', function () {
    it('should work', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.sender = true

        let bob = new Agent('Bob')
        bob.funder = true
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.initializeOther(yield bob.asyncToPublic())
        alice.remoteAgent = bob
        bob.initializeOther(yield alice.asyncToPublic())
        bob.remoteAgent = alice

        yield alice.asyncInitializeMultisig()
        yield bob.asyncInitializeMultisig()

        let inputAmountBn = Bn(1e10)
        let fundingAmountBn = Bn(1e8)
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(inputAmountBn, alice.source.keyPair.pubKey)

        alice.fundingTxo = new FundingTxo()
        yield alice.fundingTxo.asyncInitialize(fundingAmountBn, alice.source, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)

        let htlcSecret = new HtlcSecret()
        yield htlcSecret.asyncInitialize()
        let revocationSecret = new RevocationSecret()
        yield revocationSecret.asyncInitialize()

        let outputList = [{
          to: bob.id,
          amount: Bn(1e7),
          htlcSecret: htlcSecret,
          revocationSecret: revocationSecret
        }]
        let changeOutput = {
          to: alice.id,
          htlcSecret: htlcSecret,
          revocationSecret: revocationSecret
        }

        yield alice.sendOutputList(outputList, changeOutput)

        alice.commitmentTxos.length.should.equal(1)
        alice.other.commitmentTxos.length.should.equal(1)
        bob.commitmentTxos.length.should.equal(1)
        bob.other.commitmentTxos.length.should.equal(1)

      }, this)
    })
  })
})
