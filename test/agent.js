/* global describe,it */
'use strict'
let should = require('should')
let Agent = require('../lib/agent.js')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let BN = require('yours-bitcoin/lib/bn')
let CommitmentTxo = require('../lib/txs/commitment-txo.js')

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

  it('initializing the other should work', function () {
    return asink(function *() {
      let alice = new Agent('Alice')
      yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
      alice.sender = true

      let bob = new Agent('Bob')
      bob.funder = true
      yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
      let publicBob = yield bob.asyncToPublic()

      alice.other = publicBob

      alice.other.name.should.equal(bob.name)
      alice.other.funding.should.deepEqual(bob.funding.toPublic())
      alice.other.multisig.should.deepEqual(bob.multisig.toPublic())
      alice.other.spending.should.deepEqual(bob.spending.toPublic())
      alice.other.spending.should.deepEqual(bob.spending.toPublic())
      alice.other.funder.should.deepEqual(bob.funder)
      alice.other.wallet.should.deepEqual(bob.wallet.toPublic())
    }, this)
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

        alice.other = publicBob
        yield alice.asyncInitializeMultisig()

        bob.other = publicAlice
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

  describe('#checkRevocationSecret', function () {
    it('checkRevocationSecret stores the other users toPublic htlc and revocation secret', function () {
      return asink(function *() {
        let alice = new Agent('Alice')
        yield alice.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicAlice = yield alice.asyncToPublic()

        let bob = new Agent('Bob')
        yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
        let publicBob = yield bob.asyncToPublic()

        alice.other = publicBob
        bob.other = publicAlice
        bob.checkRevocationSecret(alice.nextRevocationSecret.toPublic())

        should.exist(bob.other.nextRevocationSecret)
        should.not.exist(bob.other.nextRevocationSecret.buf)
      }, this)
    })
  })

  describe('#asyncCheckCommitmentTxo', function () {
    it.skip('asyncCheckCommitmentTxo should create a htlc tx, case where Alice funds and Bob accepts', function () {
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
        yield alice.asyncOpenChannel(BN(1e6), publicAlice)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false

        let otherCommitmentTxo = new CommitmentTxo()
        yield otherCommitmentTxo.asyncInitialize(BN(5e5), BN(5e5),
          alice.fundingTxo, alice.multisig,
          alice.spending, alice.other.spending,
          alice.htlcSecret.toPublic(), alice.other.htlcSecret.toPublic(),
          bob.nextRevocationSecret, alice.funder)

        let bool = yield bob.asyncCheckCommitmentTxo(otherCommitmentTxo)
        bool.should.equal(true)
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

        should.not.exist(alice.fundingTxo)
        should.not.exist(bob.fundingTxo)

        // Alice opens a channel to bob
        alice.funder = true
        let publicAlice = yield alice.asyncToPublic()
        yield bob.asyncOpenChannel(BN(1e6), publicAlice)

        should.exist(alice.multisig)
        should.exist(alice.fundingTxo)
        should.exist(alice.fundingTxo.txb)
        should.exist(alice.fundingTxo.txb.tx)
        should.exist(alice.other)
        should.exist(alice.nextRevocationSecret)
        should.exist(alice.nextRevocationSecret.buf)
        should.exist(alice.nextRevocationSecret.hash)
        should.exist(alice.htlcSecret)
        should.exist(alice.htlcSecret.buf)
        should.exist(alice.htlcSecret.hash)

        should.exist(alice.other.nextRevocationSecret)
        should.exist(alice.other.nextRevocationSecret.hash)
        should.not.exist(alice.other.nextRevocationSecret.buf)
        should.exist(alice.other.htlcSecret)
        should.exist(alice.other.htlcSecret.hash)
        should.not.exist(alice.other.htlcSecret.buf)

        should.exist(bob.multisig)
        should.exist(bob.fundingTxo)
        should.exist(bob.fundingTxo.txb)
        should.exist(bob.fundingTxo.txb.tx)
        should.exist(bob.other)
        should.exist(bob.nextRevocationSecret)
        should.exist(bob.nextRevocationSecret.buf)
        should.exist(bob.nextRevocationSecret.hash)
        should.exist(bob.htlcSecret)
        should.exist(bob.htlcSecret.buf)
        should.exist(bob.htlcSecret.hash)

        should.exist(bob.other.nextRevocationSecret)
        should.exist(bob.other.nextRevocationSecret.hash)
        should.not.exist(bob.other.nextRevocationSecret.buf)
        should.exist(bob.other.htlcSecret)
        should.exist(bob.other.htlcSecret.hash)
        should.not.exist(bob.other.htlcSecret.buf)

        // check that both parties have the same multisig address
        ;(alice.multisig.address.toString()).should.equal(bob.multisig.address.toString())
        ;(alice.multisig.otherPubKey.toString()).should.equal(bob.multisig.pubKey.toString())
        ;(bob.multisig.otherPubKey.toString()).should.equal(alice.multisig.pubKey.toString())

        // check that both parties have the same funding transaction (hash)
        bob.fundingTxo.txb.tx.hash().toString().should.equal(alice.fundingTxo.txb.tx.hash().toString())

        // check that the two have matching htlc secrets
        alice.htlcSecret.hash.toString().should.equal(bob.other.htlcSecret.hash.toString())
        bob.htlcSecret.hash.toString().should.equal(alice.other.htlcSecret.hash.toString())

        // check that the two have matching revocation secrets
        alice.nextRevocationSecret.hash.toString().should.equal(bob.other.nextRevocationSecret.hash.toString())
        bob.nextRevocationSecret.hash.toString().should.equal(alice.other.nextRevocationSecret.hash.toString())
      }, this)
    })
  })

  describe('#asyncSend', function () {
    it.skip('asyncSend should store the other agents addeses and build a multisig address', function () {
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
        yield bob.asyncSend(BN(4e5), BN(6e5), alice.nextRevocationSecret.toPublic())

        // verify alice's commitmentTx
        let txVerifier, error
        txVerifier = new TxVerifier(alice.commitmentTxos[0].txb.tx, alice.commitmentTxos[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(error, txVerifier.getDebugString())
        }
        error.should.equal(false)

        // verify bob's commitmentTx
        txVerifier = new TxVerifier(bob.commitmentTxos[0].txb.tx, bob.commitmentTxos[0].txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(error, txVerifier.getDebugString())
        }
        error.should.equal(false)

        alice.commitmentTxos.length.should.equal(1)
        alice.other.commitmentTxos.length.should.equal(1)
        bob.commitmentTxos.length.should.equal(1)
        bob.other.commitmentTxos.length.should.equal(1)
/*
        // check that alice stores bob's commitment tx correctly
        alice.other.commitmentTxos[0].should.deepEqual(bob.commitmentTxos[0].toPublic())
        bob.other.commitmentTxos[0].should.deepEqual(alice.commitmentTxos[0].toPublic())
       // send another payment (note that this is alice calling a function at bob)
        yield bob.asyncSend(BN(3e5), BN(7e5), alice.nextRevocationSecret.toPublic())

        alice.commitmentTxos.length.should.equal(2)
        alice.other.commitmentTxos.length.should.equal(2)
        bob.commitmentTxos.length.should.equal(2)
        bob.other.commitmentTxos.length.should.equal(2)

        alice.other.commitmentTxos[1].should.deepEqual(bob.commitmentTxos[1].toPublic())
        bob.other.commitmentTxos[1].should.deepEqual(alice.commitmentTxos[1].toPublic())

        yield bob.asyncSend(BN(2e5), BN(8e5), alice.nextRevocationSecret.toPublic())
*/
        // check that the agents don't know each othere's secrets
        //  console.log(alice.other.commitmentTxos[0].htlcSecret)

        // TODO: make sure that alice.other secret is hidden
        // console.log('make sure that alice.other secret is hidden');
        // console.log('alice.other', alice.other.commitmentTxos[0].htlcSecret);
        // console.log('bob', bob.commitmentTxos[0].htlcSecret);
      }, this)
    })
  })

  describe('#toJson', function () {
    it('toJson should convert into a json object', function () {
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

        let json = bob.toJson()

        should.exist(json.name)
        should.exist(json.funding)
        should.exist(json.multisig)
        should.exist(json.spending)
        should.exist(json.htlcSecret)
        should.exist(json.nextRevocationSecret)
        should.exist(json.funder)
        should.exist(json.fundingTxo)
        should.exist(json.wallet)
        should.exist(json.initialized)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5), alice.nextRevocationSecret.toPublic())

        json = bob.toJson()

        should.exist(json.name)
        should.exist(json.funding)
        should.exist(json.multisig)
        should.exist(json.spending)
        should.exist(json.htlcSecret)
        should.exist(json.nextRevocationSecret)
        should.exist(json.funder)
        should.exist(json.fundingTxo)
        should.exist(json.commitmentTxos)
        should.exist(json.wallet)
        should.exist(json.initialized)
        should.exist(json.sender)
      }, this)
    })
  })

  describe('#formJson', function () {
    it('fromJson should convert from a json object', function () {
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

        let json = bob.toJson()
        let joe = new Agent().fromJson(json)

        should.exist(joe)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5), alice.nextRevocationSecret.toPublic())

        json = bob.toJson()
        let sue = new Agent().fromJson(json)

        should.exist(sue.name)
        should.exist(sue.funding)
        should.exist(sue.multisig)
        should.exist(sue.spending)
        should.exist(sue.htlcSecret)
        should.exist(sue.nextRevocationSecret)
        should.exist(sue.funder)
        should.exist(sue.fundingTxo)
        should.exist(sue.commitmentTxos)
        should.exist(sue.wallet)
        should.exist(sue.initialized)
        should.exist(sue.sender)
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

        let berta = yield bob.asyncToPublic()

        should.exist(berta)
        should.exist(berta.name)
        should.exist(berta.funding)
        should.exist(berta.spending)
        should.exist(berta.htlcSecret)
        should.exist(berta.wallet)

        // right now Alice and Bob communicate by storing a reference to one another
        // eventually this will be replaced by some form of remote proceedure calls
        alice.remoteAgent = bob
        bob.remoteAgent = alice

        // Alice opens a channel to bob
        alice.funder = true
        bob.funder = false
        let publicAlice = yield alice.asyncToPublic()
        yield bob.asyncOpenChannel(BN(1e6), publicAlice)

        let sue = yield bob.asyncToPublic()

        should.exist(sue)
        should.exist(sue.name)
        should.exist(sue.funding)
        should.exist(sue.multisig)
        should.exist(sue.spending)
        should.exist(sue.htlcSecret)
        should.exist(sue.nextRevocationSecret)
        should.exist(sue.funder)
        should.exist(sue.wallet)
        should.exist(sue.fundingTxo)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(BN(4e5), BN(6e5), alice.nextRevocationSecret.toPublic())

        let julie = yield bob.asyncToPublic()

        should.exist(julie)
        should.exist(julie.name)
        should.exist(julie.funding)
        should.exist(julie.multisig)
        should.exist(julie.spending)
        should.exist(julie.htlcSecret)
        should.exist(julie.nextRevocationSecret)
        should.exist(julie.funder)
        should.exist(julie.wallet)
        should.exist(julie.sender)
        should.exist(julie.fundingTxo)
        should.exist(julie.commitmentTxos)
      }, this)
    })
  })
})
