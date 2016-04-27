'use strict'
let Struct = require('fullnode/lib/struct')
// let Agent = require('./agent.js')
let asink = require('asink')
// let Script = require('fullnode/lib/script')
// let Pubkey = require('fullnode/lib/pubkey')
// let Address = require('fullnode/lib/address')
// let Keypair = require('fullnode/lib/keypair')

function Protocol (agent, otherAgent) {
  if (!(this instanceof Protocol)) {
    return new Protocol(agent, otherAgent)
  }
  this.fromObject({agent, otherAgent})
}

Protocol.prototype = Object.create(Struct.prototype)
Protocol.prototype.constructor = Protocol

Protocol.prototype.asyncInitialize = function (privkey, msPrivkey) {
  return asink(function *() {
    yield this.agent.asyncInitialize(privkey, msPrivkey)

    this.agent.generateRevocationSecret()
    yield this.agent.revocationSecret.asyncGenerateHash()

    this.agent.generateHtlcSecret()
    yield this.agent.htlcSecret.asyncGenerateHash()
  }, this)
}

Protocol.prototype.openChannel = function (otherPubkey, otherMsPubkey) {
  return asink(function *() {
    yield this.agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
    yield this.agent.asyncBuildMultisig()
  }, this)
}

Protocol.prototype.createFundingTx = function (amount, txhashbuf, txoutnum, txout, pubkey) {
  return asink(function *() {
    yield this.agent.asyncBuildFundingTx(amount, txhashbuf, txoutnum, txout, pubkey)
  }, this)
}

module.exports = Protocol
