/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Agent = require('../../lib/agent.js')
let EnforceOtherHtlcTxo = require('../../lib/txs/enforce-other-htlc-txo.js')

let PrivKey = require('yours-bitcoin/lib/priv-key')
let BN = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

describe('EnforceOtherHtlcTxo', function () {
  it('should exist', function () {
    should.exist(EnforceOtherHtlcTxo)
    should.exist(new EnforceOtherHtlcTxo())
  })

  describe('#asyncBuild', function () {
    it('should create destination tx', function () {
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

        yield bob.asyncSend(BN(4e5), BN(6e5))

        let txVerifier, error, commitmentTxo

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        commitmentTxo = alice.commitmentTxos[0]
        let bobsSpendingTxo = new EnforceOtherHtlcTxo()
        yield bobsSpendingTxo.asyncBuild(commitmentTxo, bob.destination)

        should.exist(bobsSpendingTxo)
        txVerifier = new TxVerifier(bobsSpendingTxo.txb.tx, bobsSpendingTxo.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)

        // same test for alice
        commitmentTxo = bob.commitmentTxos[0]
        let alicesSpendingTxo = new EnforceOtherHtlcTxo()
        yield alicesSpendingTxo.asyncBuild(commitmentTxo, alice.destination)

        should.exist(alicesSpendingTxo)
        txVerifier = new TxVerifier(alicesSpendingTxo.txb.tx, alicesSpendingTxo.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.interp.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })
  })
})
