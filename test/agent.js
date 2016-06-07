/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let HtlcSecret = require('../lib/scrts/htlc-secret.js')
let RevocationSecret = require('../lib/scrts/revocation-secret.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Bn = require('yours-bitcoin/lib/bn')

/*
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
*/

describe('Agent', function () {
  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
  })

  describe('#asyncInitialize', function () {
    it('should initialize an agent', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        should.exist(alice.id)
        should.exist(alice.sourceAddress)
        should.exist(alice.multisigAddress)
        should.exist(alice.destinationAddress)
        should.exist(alice.commitmentTxos)
        should.exist(alice.wallet)
        alice.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#asyncOpenChannel', function () {
    it('should initialize the public projection of the other agent and the multisig address', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.remoteAgent = bob
        bob.remoteAgent = alice

        alice.funder = true
        yield bob.asyncOpenChannel(Bn(1e8), yield alice.asyncToPublic())

        alice.multisigAddress.initialized.should.equal(true)
        should.exist(alice.other)
        should.exist(alice.fundingTxo)

        bob.multisigAddress.initialized.should.equal(true)
        should.exist(bob.other)
        should.exist(bob.fundingTxo)

        alice.id.should.equal('Alice')
        alice.other.id.should.equal('Bob')
        bob.id.should.equal('Bob')
        bob.other.id.should.equal('Alice')
      }, this)
    })
  })

  describe('#sendOutputList', function () {
    it('should work', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.remoteAgent = bob
        bob.remoteAgent = alice
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

        alice.funder = true
        yield alice.remoteAgent.asyncOpenChannel(Bn(1e8), yield alice.asyncToPublic())

        alice.sender = true
        yield alice.remoteAgent.asyncSendOutputList(outputList, changeOutput)

        alice.commitmentTxos.length.should.equal(1)
        alice.other.commitmentTxos.length.should.equal(1)
        should.exist(bob.other.commitmentTxos[0].txb)

        bob.commitmentTxos.length.should.equal(1)
        bob.other.commitmentTxos.length.should.equal(1)
        should.exist(bob.other.commitmentTxos[0].txb)

        yield bob.asyncSendOutputList(outputList, changeOutput)

        alice.commitmentTxos.length.should.equal(2)
        alice.other.commitmentTxos.length.should.equal(2)
        should.exist(bob.other.commitmentTxos[1].txb)

        bob.commitmentTxos.length.should.equal(2)
        bob.other.commitmentTxos.length.should.equal(2)
        should.exist(bob.other.commitmentTxos[1].txb)
      }, this)
    })
  })
})
