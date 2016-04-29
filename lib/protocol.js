'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')

function Protocol (agent, otherAgent) {
  if (!(this instanceof Protocol)) {
    return new Protocol(agent, otherAgent)
  }
  this.fromObject({agent, otherAgent})
}

Protocol.prototype = Object.create(Struct.prototype)
Protocol.prototype.constructor = Protocol

/* ---- open a channel ---- */

Protocol.prototype.asyncOpenChannel = function (amount, otherPubkey, otherMsPubkey) {
  return asink(function *() {
    yield this.agent.asyncInitializeOther(otherPubkey, otherMsPubkey)
    yield this.agent.asyncBuildMultisig()

    if (this.agent.funder) {
      let output = this.agent.wallet.getUnspentOutput(amount, this.agent.address)
      this.agent.asyncBuildFundingTx(amount, output.txhashbuf, output.txoutnum, output.txout, output.pubkey)
    } else {
      this.other.agent.asyncOpenChannel(amount, this.agent.pubkey, this.agent.msPubkey)
    }
  }, this)
}

/* ---- send a payment ---- */

Protocol.prototype.initPayment = function (amount, amountToOther, htlcSecret, revocationSecret) {
  return asink(function *() {
    this.agent.storeOtherSecrets(htlcSecret, revocationSecret)
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
