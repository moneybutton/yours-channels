/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent')
let HtlcSecret = require('../lib/scrts/htlc-secret')
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
    should.exist(alice.commitmentTxObjs[txNum])
    should.exist(alice.commitmentTxObjs[txNum].htlcSecret)
    should.exist(alice.commitmentTxObjs[txNum].revocationSecret)
    yield asyncTestSecretChecks(alice.commitmentTxObjs[txNum].htlcSecret)
    yield asyncTestSecretChecks(alice.commitmentTxObjs[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(alice.other.commitmentTxObjs[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(alice.other.commitmentTxObjs[txNum].htlcSecret)
    // check that alices stores the public version of bob's secrets
    testSecretsMatch(alice.commitmentTxObjs[txNum].htlcSecret, bob.other.commitmentTxObjs[txNum].htlcSecret)
    testSecretsMatch(alice.commitmentTxObjs[txNum].revocationSecret, bob.other.commitmentTxObjs[txNum].revocationSecret)
    testSecretsMatch(alice.commitmentTxObjs[txNum].otherHtlcSecret, bob.other.commitmentTxObjs[txNum].otherHtlcSecret)
    testSecretsMatch(alice.commitmentTxObjs[txNum].otherRevocationSecret, bob.other.commitmentTxObjs[txNum].otherRevocationSecret)

    // same tests for bob
    should.exist(bob.commitmentTxObjs[txNum])
    yield asyncTestSecretChecks(bob.commitmentTxObjs[txNum].revocationSecret)
    yield asyncTestSecretChecks(bob.commitmentTxObjs[txNum].htlcSecret)
    yield asyncTestSecretIsHidden(bob.other.commitmentTxObjs[txNum].revocationSecret)
    yield asyncTestSecretIsHidden(bob.other.commitmentTxObjs[txNum].htlcSecret)
    testSecretsMatch(bob.commitmentTxObjs[txNum].revocationSecret, alice.other.commitmentTxObjs[txNum].revocationSecret)
    testSecretsMatch(bob.commitmentTxObjs[txNum].htlcSecret, alice.other.commitmentTxObjs[txNum].htlcSecret)
    testSecretsMatch(bob.commitmentTxObjs[txNum].otherHtlcSecret, alice.other.commitmentTxObjs[txNum].otherHtlcSecret)
    testSecretsMatch(bob.commitmentTxObjs[txNum].otherRevocationSecret, alice.other.commitmentTxObjs[txNum].otherRevocationSecret)
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
        should.exist(alice.commitmentTxObjs)
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
        should.exist(alice.fundingTxObj)

        bob.multisigAddress.initialized.should.equal(true)
        should.exist(bob.other)
        should.exist(bob.fundingTxObj)

        alice.id.should.equal('Alice')
        alice.other.id.should.equal('Bob')
        bob.id.should.equal('Bob')
        bob.other.id.should.equal('Alice')
      }, this)
    })
  })

  describe('#sendOutputList', function () {
    it('should work', function () {
      return asink(function * () {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        alice.remoteAgent = bob
        bob.remoteAgent = alice
        let htlcSecret = new HtlcSecret()
        yield htlcSecret.asyncInitialize()

        let outputList = [{
          intermediateDestId: alice.id,
          finalDestId: 'not used yet',
          amount: Bn(1e7),
          htlcSecret: htlcSecret
        }]
        let changeOutput = {
          intermediateDestId: bob.id,
          finalDestId: 'not used yet',
          htlcSecret: htlcSecret
        }

        alice.funder = true
        yield alice.remoteAgent.asyncOpenChannel(Bn(1e8), yield alice.asyncToPublic())

        alice.sender = true
        yield alice.remoteAgent.asyncSendOutputList(outputList, changeOutput)

        alice.commitmentTxObjs.length.should.equal(1)
        alice.other.commitmentTxObjs.length.should.equal(1)
        should.exist(bob.other.commitmentTxObjs[0].txb)

        bob.commitmentTxObjs.length.should.equal(1)
        bob.other.commitmentTxObjs.length.should.equal(1)
        should.exist(bob.other.commitmentTxObjs[0].txb)

        yield bob.asyncSendOutputList(outputList, changeOutput)

        // check length of the commitmentTxObjs list
        alice.commitmentTxObjs.length.should.equal(2)
        alice.other.commitmentTxObjs.length.should.equal(2)
        should.exist(bob.other.commitmentTxObjs[1].txb)
        bob.commitmentTxObjs.length.should.equal(2)
        bob.other.commitmentTxObjs.length.should.equal(2)
        should.exist(bob.other.commitmentTxObjs[1].txb)

        // check that the revocationSecret has been added
        should.exist(bob.commitmentTxObjs[0].outputList[0].revocationSecret)

        let txVerifier, error
        // verify bob's commitmentTx
        txVerifier = new TxVerifier(bob.commitmentTxObjs[0].txb.tx, bob.commitmentTxObjs[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)

        // verify bob's commitmentTx
        txVerifier = new TxVerifier(alice.commitmentTxObjs[0].txb.tx, bob.commitmentTxObjs[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        // we expect an error here as the transaction is not fully signed
        error.should.equal(false)
      }, this)
    })
  })
})
