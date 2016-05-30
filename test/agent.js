/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let BN = require('yours-bitcoin/lib/bn')

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
  secret1.hash.toString().should.equal(secret2.hash.toString())
}

describe('Agent', function () {
  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
  })

  describe('#asyncInitialize', function () {
    it('should exist', function () {
      let agent = new Agent()
      should.exist(agent.asyncInitialize)
    })

    it('should set a multisig script and address', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        Object.keys(alice).should.deepEqual([ 'name' ])
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        should.exist(alice.source.keyPair.privKey)
        should.exist(alice.source.keyPair.pubKey)
        should.exist(alice.source.address)
        should.exist(alice.source.keyPair)

        should.exist(alice.multisig.privKey)
        should.exist(alice.multisig.pubKey)

        should.exist(alice.destination.keyPair.privKey)
        should.exist(alice.destination.keyPair.pubKey)
        should.exist(alice.destination.address)
        should.exist(alice.destination.keyPair)

        should.exist(alice.wallet)

        should.exist(alice.commitmentTxos)
        alice.commitmentTxos.length.should.equal(1)

        alice.initialized.should.equal(true)
      }, this)
    })
  })

  describe('#initializeOther', function () {
    it('should work', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.sender = true

        let bob = new Agent('Bob')
        bob.funder = true
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        alice.initializeOther(yield bob.asyncToPublic())

        alice.other.name.should.equal(bob.name)
        alice.other.source.should.deepEqual(bob.source.toPublic())
        alice.other.multisig.should.deepEqual(bob.multisig.toPublic())
        alice.other.destination.should.deepEqual(bob.destination.toPublic())
        alice.other.funder.should.deepEqual(bob.funder)
        alice.other.wallet.should.deepEqual(bob.wallet.toPublic())
      }, this)
    })
  })

  describe('#asyncInitializeMultisig', function () {
    it('asyncInitializeMultisig should create a multisig address', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicAlice = yield alice.asyncToPublic()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.initializeOther(publicBob)
        yield alice.asyncInitializeMultisig()

        bob.initializeOther(publicAlice)
        yield bob.asyncInitializeMultisig()

        should.exist(alice.multisig)
        should.exist(bob.multisig)
        should.exist(alice.multisig.otherPubKey)
        should.exist(bob.multisig.otherPubKey)
        should.exist(alice.multisig.pubKey)
        should.exist(bob.multisig.pubKey)
        should.exist(alice.multisig.pubKeys)
        should.exist(bob.multisig.pubKeys)
        should.exist(alice.multisig.script)
        should.exist(bob.multisig.script)
        should.exist(alice.multisig.address)
        should.exist(bob.multisig.address)
        should.exist(alice.multisig.keyPair)
        should.exist(bob.multisig.keyPair)

        alice.multisig.initialized.should.equal(true)
        bob.multisig.initialized.should.equal(true)

        // check that both parties have the same multisig address
        ;(alice.multisig.address.toString()).should.equal(bob.multisig.address.toString())
        ;(alice.multisig.otherPubKey.toString()).should.equal(bob.multisig.pubKey.toString())
        ;(bob.multisig.otherPubKey.toString()).should.equal(alice.multisig.pubKey.toString())
      }, this)
    })
  })

  /* ---- protocol ---- */

  describe('#asyncOpenChannel', function () {
    it('asyncOpenChannel should store the other agents addeses and build a multisig address', function () {
      return asink(function *() {
        // each party initializes itself locally
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        should.not.exist(alice.fundingTxo)
        should.not.exist(bob.fundingTxo)

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        alice.commitmentTxos.length.should.equal(1)
        bob.commitmentTxos.length.should.equal(1)
        should.not.exist(alice.other)
        should.not.exist(bob.other)

        // Alice opens a channel to bob
        alice.funder = true
        yield bob.asyncOpenChannel(BN(1e6), yield alice.asyncToPublic())

        alice.commitmentTxos.length.should.equal(1)
        bob.commitmentTxos.length.should.equal(1)
        alice.other.commitmentTxos.length.should.equal(1)
        bob.other.commitmentTxos.length.should.equal(1)

        should.exist(alice.multisig)
        should.exist(alice.fundingTxo)
        should.exist(alice.fundingTxo.txb)
        should.exist(alice.fundingTxo.txb.tx)
        should.exist(alice.other)
        asyncTestSecretChecks(alice.commitmentTxos[0].revocationSecret)
        asyncTestSecretChecks(alice.commitmentTxos[0].htlcSecret)

        should.exist(bob.multisig)
        should.exist(bob.fundingTxo)
        should.exist(bob.fundingTxo.txb)
        should.exist(bob.fundingTxo.txb.tx)
        should.exist(bob.other)
        asyncTestSecretChecks(bob.commitmentTxos[0].revocationSecret)
        asyncTestSecretChecks(bob.commitmentTxos[0].htlcSecret)

        // check that both parties have the same multisig address
        ;(alice.multisig.address.toString()).should.equal(bob.multisig.address.toString())
        ;(alice.multisig.otherPubKey.toString()).should.equal(bob.multisig.pubKey.toString())
        ;(bob.multisig.otherPubKey.toString()).should.equal(alice.multisig.pubKey.toString())

        // check that both parties have the same funding transaction (hash)
        bob.fundingTxo.txb.tx.hash().toString().should.equal(alice.fundingTxo.txb.tx.hash().toString())
      }, this)
    })
  })

  describe('#asyncSend', function () {
    it('should send a new payment', function () {
      return asink(function *() {
        // each party initializes itself locally
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        let publicAlice = yield alice.asyncToPublic()
        yield bob.asyncOpenChannel(BN(1e6), publicAlice)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false

        alice.commitmentTxos.length.should.equal(1)
        bob.commitmentTxos.length.should.equal(1)
        alice.other.commitmentTxos.length.should.equal(1)
        bob.other.commitmentTxos.length.should.equal(1)

        yield bob.asyncSend(BN(4e5), BN(6e5))

        alice.commitmentTxos.length.should.equal(2)
        alice.other.commitmentTxos.length.should.equal(2)
        bob.commitmentTxos.length.should.equal(2)
        bob.other.commitmentTxos.length.should.equal(2)

        // check secrets
        yield asyncTestSecretChecks(alice.commitmentTxos[0].revocationSecret)
        yield asyncTestSecretChecks(alice.commitmentTxos[0].htlcSecret)
        yield asyncTestSecretChecks(bob.commitmentTxos[0].revocationSecret)
        yield asyncTestSecretChecks(bob.commitmentTxos[0].htlcSecret)

        yield asyncTestSecretIsHidden(alice.other.commitmentTxos[0].revocationSecret)
        yield asyncTestSecretIsHidden(alice.other.commitmentTxos[0].htlcSecret)
        yield asyncTestSecretIsHidden(bob.other.commitmentTxos[0].revocationSecret)
        yield asyncTestSecretIsHidden(bob.other.commitmentTxos[0].htlcSecret)

        testSecretsMatch(alice.commitmentTxos[0].revocationSecret, bob.other.commitmentTxos[0].revocationSecret)
        testSecretsMatch(alice.commitmentTxos[0].htlcSecret, bob.other.commitmentTxos[0].htlcSecret)
        testSecretsMatch(bob.commitmentTxos[0].revocationSecret, alice.other.commitmentTxos[0].revocationSecret)
        testSecretsMatch(bob.commitmentTxos[0].htlcSecret, alice.other.commitmentTxos[0].htlcSecret)

        // verify alice's commitmentTx
        let txVerifier, error
        txVerifier = new TxVerifier(alice.commitmentTxos[0].txb.tx, alice.commitmentTxos[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(error, txVerifier.getDebugString())
        }
        error.should.equal(false)

        should.exist(bob.commitmentTxos[0])
        should.exist(bob.commitmentTxos[0].txb)
        should.exist(bob.commitmentTxos[0].txb.tx)

        // verify bob's commitmentTx
        txVerifier = new TxVerifier(bob.commitmentTxos[0].txb.tx, bob.commitmentTxos[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(error, txVerifier.getDebugString())
        }
        error.should.equal(false)

        // check that only bob knows his own revocationSecret
        should.exist(bob.commitmentTxos[0].revocationSecret.buf)
        should.exist(bob.commitmentTxos[0].revocationSecret.hash)
        should.not.exist(bob.other.commitmentTxos[0].revocationSecret.buf)
        should.exist(bob.other.commitmentTxos[0].revocationSecret.hash)
        alice.other.commitmentTxos[0].revocationSecret.hash.toString('hex').should.equal(bob.commitmentTxos[0].revocationSecret.hash.toString('hex'))

        // check that only bob knows his own htlcSecret
        should.exist(bob.commitmentTxos[0].htlcSecret.buf)
        should.exist(bob.commitmentTxos[0].htlcSecret.hash)
        should.exist(bob.other.commitmentTxos[0].htlcSecret.hash)
        should.not.exist(bob.other.commitmentTxos[0].htlcSecret.buf)
        alice.other.commitmentTxos[0].htlcSecret.hash.toString('hex').should.equal(bob.commitmentTxos[0].htlcSecret.hash.toString('hex'))

        // check that only bob does not know the otherHtlcSecret
        should.not.exist(bob.commitmentTxos[0].otherHtlcSecret.buf)
        should.exist(bob.commitmentTxos[0].otherHtlcSecret.hash)
        should.exist(bob.other.commitmentTxos[0].otherHtlcSecret.hash)
        should.exist(bob.other.commitmentTxos[0].otherHtlcSecret.buf)
        alice.other.commitmentTxos[0].otherHtlcSecret.hash.toString('hex').should.equal(bob.commitmentTxos[0].otherHtlcSecret.hash.toString('hex'))

        // same tests for alice
        should.exist(alice.commitmentTxos[0].revocationSecret.buf)
        should.exist(alice.commitmentTxos[0].revocationSecret.hash)
        should.not.exist(alice.other.commitmentTxos[0].revocationSecret.buf)
        should.exist(alice.other.commitmentTxos[0].revocationSecret.hash)

        should.exist(alice.commitmentTxos[0].htlcSecret.buf)
        should.exist(alice.commitmentTxos[0].htlcSecret.hash)
        should.exist(alice.other.commitmentTxos[0].htlcSecret.hash)
        should.not.exist(alice.other.commitmentTxos[0].htlcSecret.buf)

        should.not.exist(alice.commitmentTxos[0].otherHtlcSecret.buf)
        should.exist(alice.commitmentTxos[0].otherHtlcSecret.hash)
        should.exist(alice.other.commitmentTxos[0].otherHtlcSecret.hash)
        should.exist(alice.other.commitmentTxos[0].otherHtlcSecret.buf)

        // check that we are not setting the same secret to both transactions
        alice.commitmentTxos[0].revocationSecret.hash.toString('hex').should.not.equal(bob.commitmentTxos[0].revocationSecret.hash.toString('hex'))
        alice.commitmentTxos[0].htlcSecret.hash.toString('hex').should.not.equal(bob.commitmentTxos[0].htlcSecret.hash.toString('hex'))
        alice.commitmentTxos[0].otherHtlcSecret.hash.toString('hex').should.not.equal(bob.commitmentTxos[0].otherHtlcSecret.hash.toString('hex'))

        // TODO check that alice stores bob's commitment tx correctly
        // alice.other.commitmentTxos[0].should.deepEqual(bob.commitmentTxos[0].toPublic())
        // bob.other.commitmentTxos[0].should.deepEqual(alice.commitmentTxos[0].toPublic())

        // send another payment (note that this is alice calling a function at bob)
        yield bob.asyncSend(BN(3e5), BN(7e5))

        should.exist(alice.commitmentTxos[1])
        should.exist(alice.commitmentTxos[1].txb)
        should.exist(alice.commitmentTxos[1].txb.tx)

        alice.commitmentTxos.length.should.equal(3)
        alice.other.commitmentTxos.length.should.equal(3)
        bob.commitmentTxos.length.should.equal(3)
        bob.other.commitmentTxos.length.should.equal(3)

        // TODO
        // alice.other.commitmentTxos[1].should.deepEqual(bob.commitmentTxos[1].toPublic())
        // bob.other.commitmentTxos[1].should.deepEqual(alice.commitmentTxos[1].toPublic())

        yield bob.asyncSend(BN(2e5), BN(8e5))
        // check that the agents don't know each othere's secrets
        //  console.log(alice.other.commitmentTxos[0].htlcSecret)

        // TODO: make sure that alice.other secret is hidden
        // console.log('make sure that alice.other secret is hidden');
        // console.log('alice.other', alice.other.commitmentTxos[0].htlcSecret);
        // console.log('bob', bob.commitmentTxos[0].htlcSecret);
      }, this)
    })
  })

  describe('#toJSON', function () {
    it('toJSON should convert into a json object', function () {
      return asink(function *() {
        // each party initializes itself locally
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        bob.funder = false
        let publicAlice = yield alice.asyncToPublic()
        yield bob.asyncOpenChannel(BN(1e6), publicAlice)

        should.exist(bob.name)
        should.exist(bob.source)
        should.exist(bob.multisig)
        should.exist(bob.destination)
        should.exist(bob.funder)
        should.exist(bob.fundingTxo)
        should.exist(bob.wallet)
        should.exist(bob.initialized)

        let json = bob.toJSON()

        should.exist(json.name)
        should.exist(json.source)
        should.exist(json.multisig)
        should.exist(json.destination)
        should.exist(json.commitmentTxos)
        should.exist(json.initialized)
        should.exist(json.funder)
        should.exist(json.fundingTxo)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5))

        json = bob.toJSON()

        should.exist(json.name)
        should.exist(json.source)
        should.exist(json.multisig)
        should.exist(json.destination)
        should.exist(json.commitmentTxos)
        should.exist(json.initialized)
        should.exist(json.funder)
        should.exist(json.fundingTxo)

      // just a comment to make jslint not complain
      }, this)
    })

    it('toJSON should convert into a json object after toPublic has been called', function () {
      return asink(function *() {
        // each party initializes itself locally
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        bob.funder = false

        let publicAlice = yield alice.asyncToPublic()
        let publicAliceJson = publicAlice.toJSON()

        should.exist(publicAliceJson)

        yield bob.asyncOpenChannel(BN(1e6), publicAlice)

        let json = bob.toJSON()

        should.exist(json.name)
        should.exist(json.source)
        should.exist(json.multisig)
        should.exist(json.destination)
        should.exist(json.commitmentTxos)
        should.exist(json.initialized)
        should.exist(json.funder)
        should.exist(json.fundingTxo)
        should.not.exist(json.other)
        should.not.exist(json.remoteAgent)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5))
        json = bob.toJSON()

        should.exist(json.name)
        should.exist(json.source)
        should.exist(json.multisig)
        should.exist(json.destination)
        should.exist(json.commitmentTxos)
        should.exist(json.initialized)
        should.exist(json.funder)
        should.exist(json.fundingTxo)
        should.not.exist(json.other)
        should.not.exist(json.remoteAgent)
      }, this)
    })
  })

  describe('#formJson', function () {
    it('fromJSON should convert from a json object', function () {
      return asink(function *() {
        // each party initializes itself locally
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        bob.funder = false
        yield bob.asyncOpenChannel(BN(1e6), yield alice.asyncToPublic())

        let json = bob.toJSON()
        let joe = new Agent().fromJSON(json)

        should.exist(joe)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5))

        json = bob.toJSON()
        let sue = new Agent().fromJSON(json)

        should.exist(sue.name)
        should.exist(sue.source)
        should.exist(sue.multisig)
        should.exist(sue.destination)
        should.exist(sue.commitmentTxos)
        should.exist(sue.initialized)
        should.exist(sue.funder)
        should.exist(sue.fundingTxo)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('toPublic should convert from a json object', function () {
      return asink(function *() {
        // each party initializes itself locally
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        bob.funder = true

        let publicBob = yield bob.asyncToPublic()

        should.exist(publicBob.name)
        should.exist(publicBob.source)
        should.exist(publicBob.multisig)
        should.exist(publicBob.destination)
        should.exist(publicBob.commitmentTxos)
        should.exist(publicBob.initialized)
        should.exist(publicBob.funder)

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        bob.funder = false
        let publicAlice = yield alice.asyncToPublic()
        yield bob.asyncOpenChannel(BN(1e6), publicAlice)

        publicBob = yield bob.asyncToPublic()

        should.exist(publicBob.name)
        should.exist(publicBob.source)
        should.exist(publicBob.multisig)
        should.exist(publicBob.destination)
        should.exist(publicBob.commitmentTxos)
        should.exist(publicBob.initialized)
        publicBob.funder.should.equal(false)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5))
        publicBob = yield bob.asyncToPublic()

        should.exist(publicBob.name)
        should.exist(publicBob.source)
        should.exist(publicBob.multisig)
        should.exist(publicBob.destination)
        should.exist(publicBob.commitmentTxos)
        should.exist(publicBob.initialized)
        should.exist(publicBob.funder)

        should.exist(publicBob.commitmentTxos[0])
        should.exist(publicBob.commitmentTxos[0].htlcSecret)
        yield asyncTestSecretIsHidden(publicBob.commitmentTxos[0].htlcSecret)

        should.exist(publicBob.commitmentTxos[0].revocationSecret)
        yield asyncTestSecretIsHidden(publicBob.commitmentTxos[0].revocationSecret)

        should.not.exist(publicBob.other)
        should.not.exist(publicBob.remoteAgent)
      }, this)
    })
  })
})
