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

/* ---- open a channel ---- */

Protocol.prototype.asyncOpenChannel = function (otherPubkey, otherMsPubkey) {
  return asink(function *() {
    yield this.agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
    yield this.agent.asyncBuildMultisig()
  }, this)
}

/* ---- send a payment ---- */

Protocol.prototype.initPayment = function (amount, amountToOther, htlcSecret, revocationSecret) {
  return asink(function *() {
    this.agent.storeOtherHTLCSecret(htlcSecret)
    this.agent.storeOtherRevocationSecret(revocationSecret)
    yield this.agent.asyncBuildHtlcTxb(amount, amountToOther)
  }, this)
}

Protocol.prototype.submitPaymentTxb = function (txb) {
  this.agent.asyncAcceptCommitmentTx(txb)
}

Protocol.prototype.reveilRevocationSecret = function (secret) {
  // TODO
}

module.exports = Protocol
