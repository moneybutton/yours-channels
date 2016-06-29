/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent')
let HtlcSecret = require('../lib/scrts/htlc-secret')
let RevocationSecret = require('../lib/scrts/revocation-secret')
let OutputDescription = require('../lib/output-description')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
/*
let asyncTestSecretChecks = function (secret) {
  return asink(function * () {
    should.exist(secret)
    should.exist(secret.buf)
    should.exist(secret.hash)
    let check = yield secret.asyncCheck()
    check.should.equal(true)
  }, this)
}

let asyncTestSecretIsHidden = function (secret) {
  return asink(function * () {
    should.exist(secret)
    should.not.exist(secret.buf)
    should.exist(secret.hash)
  }, this)
}

let testSecretsMatch = function (secret1, secret2) {
  secret1.hash.toString('hex').should.equal(secret2.hash.toString('hex'))
}

let asyncTestSecrets = function (txNum, alice, bob) {
  return asink(function * () {
    should.exist(alice.commitments[txNum])
    should.exist(alice.commitments[txNum].htlcSecret)
    should.exist(alice.commitments[txNum].revocationSecret)
    yield asyncTestSecretChecks(alice.commitments[txNum].htlcSecret)
    yield asyncTestSecretChecks(alice.commitments[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(alice.other.commitments[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(alice.other.commitments[txNum].htlcSecret)
    // check that alices stores the public version of bob's secrets
    testSecretsMatch(alice.commitments[txNum].htlcSecret, bob.other.commitments[txNum].htlcSecret)
    testSecretsMatch(alice.commitments[txNum].revocationSecret, bob.other.commitments[txNum].revocationSecret)
    testSecretsMatch(alice.commitments[txNum].otherHtlcSecret, bob.other.commitments[txNum].otherHtlcSecret)
    testSecretsMatch(alice.commitments[txNum].otherRevocationSecret, bob.other.commitments[txNum].otherRevocationSecret)

    // same tests for bob
    should.exist(bob.commitments[txNum])
    yield asyncTestSecretChecks(bob.commitments[txNum].revocationSecret)
    yield asyncTestSecretChecks(bob.commitments[txNum].htlcSecret)
    yield asyncTestSecretIsHidden(bob.other.commitments[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(bob.other.commitments[txNum].htlcSecret)
    testSecretsMatch(bob.commitments[txNum].revocationSecret, alice.other.commitments[txNum].revocationSecret)
    testSecretsMatch(bob.commitments[txNum].htlcSecret, alice.other.commitments[txNum].htlcSecret)
    testSecretsMatch(bob.commitments[txNum].otherHtlcSecret, alice.other.commitments[txNum].otherHtlcSecret)
    testSecretsMatch(bob.commitments[txNum].otherRevocationSecret, alice.other.commitments[txNum].otherRevocationSecret)
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
      return asink(function * () {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        should.exist(alice.id)
        should.exist(alice.sourceAddress)
        should.exist(alice.multisigAddress)
        should.exist(alice.destinationAddress)
        should.exist(alice.commitments)
        should.exist(alice.wallet)
        alice.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#asyncOpenChannel', function () {
    it('should initialize the public projection of the other agent and the multisig address', function () {
      return asink(function * () {
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
        should.exist(alice.funding)

        bob.multisigAddress.initialized.should.equal(true)
        should.exist(bob.other)
        should.exist(bob.funding)

        alice.id.should.equal('Alice')
        alice.other.id.should.equal('Bob')
        bob.id.should.equal('Bob')
        bob.other.id.should.equal('Alice')
      }, this)
    })
  })

  describe('#sendOutputDescriptions', function () {
    it.skip('should work', function () {
      return asink(function * () {
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

        let outputDescriptions = [
          new OutputDescription(alice.id, 'finalDestId1', 'htlc', htlcSecret, revocationSecret, Bn(1e7)),
          new OutputDescription(alice.id, 'finalDestId1', 'htlc', htlcSecret, revocationSecret, Bn(1e7)),
          new OutputDescription(bob.id, 'finalDestId1', 'pubKey', htlcSecret, revocationSecret, Bn(1e7))
        ]
        let changeOutput = new OutputDescription(
          bob.id, 'finalDestId2', 'pubKey', htlcSecret, revocationSecret
        )

        alice.funder = true
        yield alice.remoteAgent.asyncOpenChannel(Bn(1e8), yield alice.asyncToPublic())

        alice.sender = true
        yield alice.remoteAgent.asyncSendOutputDescriptions(outputDescriptions, changeOutput)

        alice.commitments.length.should.equal(1)
        alice.other.commitments.length.should.equal(1)
        should.exist(bob.other.commitments[0].txb)

        bob.commitments.length.should.equal(1)
        bob.other.commitments.length.should.equal(1)
        should.exist(bob.other.commitments[0].txb)

        yield bob.asyncSendOutputDescriptions(outputDescriptions, changeOutput)

        // check length of the commitments list
        alice.commitments.length.should.equal(2)
        alice.other.commitments.length.should.equal(2)
        should.exist(bob.other.commitments[1].txb)
        bob.commitments.length.should.equal(2)
        bob.other.commitments.length.should.equal(2)
        should.exist(bob.other.commitments[1].txb)

        // check that the revocationSecret has been added
        should.exist(bob.commitments[0].outputDescriptions[0].revocationSecret)

        let txVerifier, error
        // verify bob's commitmentTx
        txVerifier = new TxVerifier(bob.commitments[0].txb.tx, bob.commitments[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)

        // verify bob's commitmentTx
        txVerifier = new TxVerifier(alice.commitments[0].txb.tx, bob.commitments[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)
      }, this)
    })
  })
})
