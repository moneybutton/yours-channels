/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let Wallet = require('../lib/wallet.js')
let CnlTxBuilder = require('../lib/cnl-tx-builder.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let BN = require('yours-bitcoin/lib/bn')

describe('Agent', function () {
  it('should exist', function () {
    should.exist(Agent)
    should.exist(new Agent())
  })

  describe('#asyncInitialize', function () {
    it('asyncInitialize should exist', function () {
      let agent = new Agent()
      should.exist(agent.asyncInitialize)
    })

    it('asyncInitialize should set a multisig script and address', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        Object.keys(alice).should.deepEqual([ 'name' ])
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

        should.exist(alice.funding.keyPair.privKey)
        should.exist(alice.funding.keyPair.pubKey)
        should.exist(alice.funding.address)
        should.exist(alice.funding.keyPair)

        should.exist(alice.multisig.privKey)
        should.exist(alice.multisig.pubKey)

        should.exist(alice.wallet)

        should.exist(alice.htlcSecret)
        should.exist(alice.htlcSecret.buf)
        should.exist(alice.htlcSecret.hash)

        alice.initialized.should.equal(true)
      }, this)
    })
  })

  it('asyncInitializeOther should set a multisig script and address', function () {
    return asink(function *() {
      let alice = new Agent('Alice')
      yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

      let bob = new Agent('Bob')
      yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
      yield bob.asyncInitializeRevocationSecret()

      yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.revocationSecret.hidden())

      alice.other.pubKey.toString('hex').should.equal(bob.spending.keyPair.pubKey.toString('hex'))

      should.exist(alice.other.revocationSecrets)
      should.exist(alice.other.pubKey)
      should.exist(alice.other.address)
      should.exist(alice.other.msPubKey)
      alice.other.initialized.should.equal(true)
    }, this)
  })

  describe('#asyncInitializeMultisig', function () {
    it('asyncInitializeMultisig should create a multisig address', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
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

  describe('#asyncInitializeRevocationSecret', function () {
    it('asyncInitializeRevocationSecret should create a htlc and revocation secret', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitializeRevocationSecret()

        should.exist(alice.revocationSecret)
        should.exist(alice.revocationSecret.buf)
        should.exist(alice.revocationSecret.hash)
      }, this)
    })
  })

  describe('#setOtherRevocationSecret', function () {
    it('setOtherRevocationSecret store the other users hidden htlc and revocation secret', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeOther(alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())

        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        should.exist(bob.other.revocationSecrets)
        should.exist(bob.other.revocationSecrets[0])
        should.exist(bob.other.revocationSecrets[0].hash)
        should.not.exist(bob.other.revocationSecrets[0].buf)
      }, this)
    })

    it('storeOtherSecrets should throw an error when called with a non-hidden secret', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeOther(alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())

        bob.setOtherRevocationSecret.bind(alice.revocationSecret).should.throw()
      }, this)
    })
  })

  describe('#setOtherRevocationSecretSolution', function () {
    it('setOtherRevocationSecret store the other users hidden htlc and revocation secret', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.funding.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeOther(alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())

        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())
        yield bob.setOtherRevocationSecretSolution(alice.revocationSecret)

        should.exist(bob.other.revocationSecrets)
        should.exist(bob.other.revocationSecrets[0])
        should.exist(bob.other.revocationSecrets[0].hash)
        should.exist(bob.other.revocationSecrets[0].buf)

        let bool = yield bob.other.revocationSecrets[0].asyncCheck()
        bool.should.equal(true)
      }, this)
    })
  })

  describe('#asyncSetFundingTx', function () {
    it('asyncSetFundingTx store the other users hidden htlc and revocation secret', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), alice.funding.txb.tx.hashbuf, alice.funding.txb.tx.txOuts)

        bob.funding.txb.tx.hashbuf.toString().should.equal(alice.funding.txb.tx.hash().toString())
        bob.funding.txb.tx.txOuts.toString('hex').should.deepEqual(alice.funding.txb.tx.txOuts.toString('hex'))
      }, this)
    })
  })

  describe('#asyncSetOtherCommitmentTxb', function () {
    it('asyncSetOtherCommitmentTxb should create a htlc tx, case where Alice funds and Bob accepts', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield alice.asyncInitializeRevocationSecret()
        alice.funder = true

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        yield bob.asyncInitializeRevocationSecret()

        yield alice.asyncInitializeOther(bob.spending.keyPair.pubKey, bob.multisig.pubKey, bob.htlcSecret.hidden())
        yield alice.asyncInitializeMultisig()

        yield bob.asyncInitializeOther(alice.spending.keyPair.pubKey, alice.multisig.pubKey, bob.htlcSecret.hidden())
        yield bob.asyncInitializeMultisig()

        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(BN(1e10), alice.funding.keyPair.pubKey)
        let tx = yield CnlTxBuilder.asyncBuildFundingTx(BN(1e8), alice.funding, alice.multisig, output.txhashbuf, output.txoutnum, output.txout, output.pubKey, output.inputTxout)
        yield alice.asyncSetFundingTx(tx, BN(1e8))
        bob.setFundingTxHash(BN(1e8), alice.funding.txb.tx.hashbuf, alice.funding.txb.tx.txOuts)

        alice.setOtherRevocationSecret(bob.revocationSecret.hidden())
        bob.setOtherRevocationSecret(alice.revocationSecret.hidden())

        alice.setCommitmentTxo(yield CnlTxBuilder.asyncBuildCommitmentTxo(BN(5e7), BN(5e7), alice.spending, alice.funding, alice.multisig, alice.other, alice.htlcSecret, alice.funder))
        yield bob.asyncSetOtherCommitmentTx(alice.commitmentTxb)

        let txVerifier = new TxVerifier(bob.commitmentTxb.tx, bob.commitmentTxb.uTxOutMap)
        let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        error.should.equal(false)

        should.exist(bob.commitmentTxb.tx.toJson())
        bob.commitmentTxb.tx.txIns.length.should.equal(1)
        bob.commitmentTxb.tx.txOuts.length.should.equal(2)
        ;(bob.commitmentTxb.tx.txOuts[0].valueBn.toString()).should.equal(BN(5e7).toString())
        ;(bob.commitmentTxb.tx.txOuts[1].valueBn.toString()).should.equal(BN(49990000).toString())
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

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        should.not.exist(alice.funding.txb)
        should.not.exist(bob.funding.txb)

        // Alice opens a channel to bob
        alice.funder = true
        yield bob.asyncOpenChannel(BN(1e6), alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())

        should.exist(alice.multisig)
        should.exist(alice.revocationSecret)
        should.exist(alice.revocationSecret.buf)
        should.exist(alice.revocationSecret.hash)
        should.exist(alice.funding.txb.tx)
        should.exist(alice.other)
        should.exist(alice.other.htlcSecret)
        should.exist(alice.other.htlcSecret.hash)
        should.not.exist(alice.other.htlcSecret.buf)

        should.exist(bob.multisig)
        should.exist(bob.other)
        should.exist(bob.other.htlcSecret)
        should.exist(bob.other.htlcSecret.hash)
        should.not.exist(bob.other.htlcSecret.buf)

        // check that both parties have the same multisig address
        ;(alice.multisig.address.toString()).should.equal(bob.multisig.address.toString())
        ;(alice.multisig.otherPubKey.toString()).should.equal(bob.multisig.pubKey.toString())
        ;(bob.multisig.otherPubKey.toString()).should.equal(alice.multisig.pubKey.toString())

        // check that both parties have the same funding transaction (hash)
        bob.funding.txb.tx.hashbuf.toString().should.equal(alice.funding.txb.tx.hash().toString())
        bob.funding.txb.tx.txOuts.toString('hex').should.deepEqual(alice.funding.txb.tx.txOuts.toString('hex'))
      }, this)
    })
  })

  describe('#asyncSend', function () {
    it('asyncSend should store the other agents addeses and build a multisig address', function () {
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

        should.not.exist(alice.funding.txb)
        should.not.exist(bob.funding.txb)

        // Alice opens a channel to bob
        alice.funder = true
        bob.funder = false
        yield bob.asyncOpenChannel(BN(1e6), alice.funding.keyPair.pubKey, alice.multisig.pubKey, alice.htlcSecret.hidden())

        // check that both parties have the same multisig address
        ;(alice.multisig.address.toString()).should.equal(bob.multisig.address.toString())
        ;(alice.multisig.otherPubKey.toString()).should.equal(bob.multisig.pubKey.toString())
        ;(bob.multisig.otherPubKey.toString()).should.equal(alice.multisig.pubKey.toString())

        // check that both parties have the same funding transaction (hash)
        bob.funding.txb.tx.hashbuf.toString().should.equal(alice.funding.txb.tx.hash().toString())
        bob.funding.txb.tx.txOuts.toString('hex').should.deepEqual(alice.funding.txb.tx.txOuts.toString('hex'))

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5), alice.revocationSecret.hidden())

        new TxVerifier(bob.commitmentTxb.tx, bob.commitmentTxb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid
        new TxVerifier(alice.commitmentTxb.tx, alice.commitmentTxb.uTxOutMap).verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

        // after the initialization phase of the protocol, both should have secrest
        should.exist(alice.other.revocationSecrets)
        should.exist(bob.other.revocationSecrets)
        should.exist(alice.other.htlcSecret)
        should.exist(bob.other.htlcSecret)

        should.exist(alice.commitmentTxb)
        should.exist(bob.commitmentTxb)

        alice.other.revocationSecrets.length.should.equal(2)
      }, this)
    })
  })
})
