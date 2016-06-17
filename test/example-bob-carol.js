/* global describe,it */
'use strict'
let Agent = require('../lib/agent')
let PrivKey = require('yours-bitcoin/lib/priv-key')
// let PubKey = require('yours-bitcoin/lib/pub-key')
// let Address = require('yours-bitcoin/lib/address')
let HtlcSecret = require('../lib/scrts/htlc-secret')
let RevocationSecret = require('../lib/scrts/revocation-secret')
let Bn = require('yours-bitcoin/lib/bn')
let asink = require('asink')
let OutputDescription = require('../lib/output-description')
require('should')

describe('Example: Bob opens a channel with Carol', function () {
  let bob = {
    sourcePrivKey: PrivKey.fromRandom(),
    multisigPrivKey: PrivKey.fromRandom(),
    destinationPrivKey: PrivKey.fromRandom()
  }

  let carol = {
    sourcePrivKey: PrivKey.fromRandom(),
    multisigPrivKey: PrivKey.fromRandom(),
    destinationPrivKey: PrivKey.fromRandom()
  }

  it.skip('Bob establishes payment channel with Carol funded with 1 bitcoin and micropays her 1000 satoshis', function () {
    return asink(function * () {
      bob.agent = new Agent('Bob')
      yield bob.agent.asyncInitialize(bob.sourcePrivKey, bob.multisigPrivKey, bob.destinationPrivKey)

      carol.agent = new Agent('Carol')
      yield carol.agent.asyncInitialize(carol.sourcePrivKey, carol.multisigPrivKey, carol.destinationPrivKey)

      // TODO: This should not be necessary. Instead of setting the remote
      // agent, each agent should generate messages which can be sent to the
      // other party via some separate messaging mechanism.
      bob.agent.remoteAgent = carol.agent
      carol.agent.remoteAgent = bob.agent

      // TODO: This should not be necessary. Instead of setting a variable
      // here, there should just be a "fund" mechanism which lets you insert a
      // transaction spending to the multisig address. If you are the person
      // generating that transaction (the funding transaction), then you are
      // the funder.
      bob.agent.funder = true

      // Bob opens the channel by sending a message to Carol. TODO: Replace
      // this with MsgOpenChannel. This should NOT create a funding
      // transaction. asyncOpenChannel should create the first message that
      // needs to be sent to the other party (an instance of MsgOpenChannel).
      yield bob.agent.remoteAgent.asyncOpenChannel(Bn(1e8), yield bob.agent.asyncToPublic())

      // sanity checks
      bob.agent.id.should.equal('Bob')
      bob.agent.other.id.should.equal('Carol')
      carol.agent.id.should.equal('Carol')
      carol.agent.other.id.should.equal('Bob')

      // Carol generates an HTLC secret for receiving the payment.
      carol.htlcSecrets = [yield new HtlcSecret().asyncInitialize()]
      carol.revocationSecrets = [yield new RevocationSecret().asyncInitialize()]

      // Carol sends the HTLC hash to Bob. TODO: This should be sent as a Msg.
      bob.htlcSecrets = [carol.htlcSecrets[0].toPublic()]
      bob.revocationSecrets = [yield new RevocationSecret().asyncInitialize()]

      // Bob builds a new output list containing the payment to Carol
      let outputList = [
        new OutputDescription(carol.agent.id, carol.agent.id, 'htlc', bob.htlcSecrets[0], carol.revocationSecrets[0], Bn(1e3))
      ]
      let changeOutput = new OutputDescription(bob.agent.id, bob.agent.id, 'pubKey', bob.htlcSecrets[0], bob.revocationSecrets[0])

      // Bob sends the output list to Carol.
      bob.agent.sender = true
      yield bob.agent.remoteAgent.asyncSendOutputList(outputList, changeOutput)

      // TODO: Also show that spending works.
    }, this)
  })
})
