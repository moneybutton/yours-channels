/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Agent = require('../../lib/agent.js')
let Wallet = require('../../lib/wallet.js')
let SpendingOwnTxo = require('../../lib/txs/spending-own-txo.js')

let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let TxOutMap = require('yours-bitcoin/lib/tx-out-map')
let Interp = require('yours-bitcoin/lib/interp')

describe('SpendingOwnTxo', function () {
  it('should exist', function () {
    should.exist(SpendingOwnTxo)
    should.exist(new SpendingOwnTxo())
  })

  describe('#asyncBuild', function () {
    it('should create spending tx', function () {
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
        yield bob.asyncOpenChannel(Bn(1e6), publicAlice)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(Bn(4e5), Bn(6e5), alice.nextRevocationSecret.toPublic())

        let txVerifier, error, commitmentTxo, txOutMap

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        commitmentTxo = bob.commitmentTxos[0]
        let bobsSpendingTxo = new SpendingOwnTxo()
        yield bobsSpendingTxo.asyncBuild(commitmentTxo, bob.spending)

        should.exist(bobsSpendingTxo)

        txOutMap = new TxOutMap()
        txOutMap.addTx(commitmentTxo.txb.tx)
        txVerifier = new TxVerifier(bobsSpendingTxo.txb.tx, txOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)

        // same test for alice
        commitmentTxo = alice.commitmentTxos[0]
        let alicesSpendingTxo = new SpendingOwnTxo()
        yield alicesSpendingTxo.asyncBuild(commitmentTxo, alice.spending)

        should.exist(alicesSpendingTxo)
        txOutMap = new TxOutMap()
        txOutMap.addTx(commitmentTxo.txb.tx)
        txVerifier = new TxVerifier(alicesSpendingTxo.txb.tx, txOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('should not be able to create spending tx from other tx', function () {
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
        yield bob.asyncOpenChannel(Bn(1e6), publicAlice)

        // alice sends some funds to bob
        alice.sender = true
        bob.sender = false
        yield bob.asyncSend(Bn(4e5), Bn(6e5), alice.nextRevocationSecret.toPublic())

        let txVerifier, error, commitmentTxo, txOutMap

        // it is important that bob cannot spend the transactions in the other.commitmentTxos array
        try {
          commitmentTxo = bob.other.commitmentTxos[0]
          let bobsSpendingTxo = new SpendingOwnTxo()
          yield bobsSpendingTxo.asyncBuild(commitmentTxo, bob.spending)

          // this is to simulate that the above should throw an error
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal("Cannot read property 'length' of undefined")
        }
      }, this)
    })
  })
})
