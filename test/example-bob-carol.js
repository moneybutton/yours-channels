/* global describe,it */
'use strict'
let Agent = require('../lib/agent')
let PrivKey = require('yours-bitcoin/lib/priv-key')
// let PubKey = require('yours-bitcoin/lib/pub-key')
// let Address = require('yours-bitcoin/lib/address')
let Bn = require('yours-bitcoin/lib/bn')
let asink = require('asink')
let should = require('should')

describe('Example: Bob opens a channel with Carol', function () {
  let bobInit = {
    sourcePrivKey: PrivKey.fromRandom(),
    multisigPrivKey: PrivKey.fromRandom(),
    destinationPrivKey: PrivKey.fromRandom()
  }

  let carolInit = {
    sourcePrivKey: PrivKey.fromRandom(),
    multisigPrivKey: PrivKey.fromRandom(),
    destinationPrivKey: PrivKey.fromRandom()
  }

  it('Bob establishes payment channel with Carol funded with 1 bitcoin and micropays her 1000 satoshis', function () {
    return asink(function * () {
      let bob = new Agent()
      yield bob.asyncInitialize(bobInit.sourcePrivKey, bobInit.multisigPrivKey, bobInit.destinationPrivKey)

      let carol = new Agent()
      yield carol.asyncInitialize(carolInit.sourcePrivKey, carolInit.multisigPrivKey, carolInit.destinationPrivKey)

      // TODO: This should not be necessary. Instead of setting the remote
      // agent, each agent should generate messages which can be sent to the
      // other party via some separate messaging mechanism.
      bob.remoteAgent = carol
      carol.remoteAgent = bob

      // TODO: This should not be necessary. Instead of setting a variable
      // here, there should just be a "fund" mechanism which lets you insert a
      // transaction spending to the multisig address. If you are the person
      // generating that transaction (the funding transaction), then you are
      // the funder.
      bob.funder = true

      // TODO: Replace this with MsgOpenChannel. This should NOT create a
      // funding transaction. asyncOpenChannel should create the first message
      // that needs to be sent to the other party (an instance of
      // MsgOpenChannel).
      yield bob.asyncOpenChannel(Bn(1e8), yield carol.asyncToPublic())

      should.exist(bob.other)
      should.exist(bob.fundingTxObj)

      // TODO: Not finished.
    }, this)
  })
})
