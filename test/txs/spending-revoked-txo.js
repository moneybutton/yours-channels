/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Agent = require('../../lib/agent.js')
let Wallet = require('../../lib/wallet.js')
let DestinationRevokedTxo = require('../../lib/txs/spending-revoked-txo.js')

let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let BN = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let TxOutMap = require('yours-bitcoin/lib/tx-out-map')

describe('DestinationRevokedTxo', function () {
  it('should exist', function () {
    should.exist(DestinationRevokedTxo)
    should.exist(new DestinationRevokedTxo())
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
        yield bob.asyncSend(BN(3e5), BN(7e5))

        let txVerifier, error, commitmentTxo, txOutMap

        // once Bob's commitment tranaction is on the blockchain, he can spend his output like this:
        commitmentTxo = alice.commitmentTxos[0]
        let bobsSpendingTxo = new DestinationRevokedTxo()
        yield bobsSpendingTxo.asyncBuild(commitmentTxo, bob.destination)

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
        let alicesSpendingTxo = new DestinationRevokedTxo()
        yield alicesSpendingTxo.asyncBuild(commitmentTxo, alice.destination)

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
  })
})
