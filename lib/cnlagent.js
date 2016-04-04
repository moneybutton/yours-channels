'use strict'
let asink = require('asink')
let Agent = require('./agent.js')

// the amount of time by which nlocktime is reduced every time the direction
// of the channel changes
const DELTA_NLOCKTIME = 60 * 60 * 24

function CnlAgent (privkey, msPrivkey, otherMsPubkey, otherAddress) {
  if (!(this instanceof CnlAgent)) {
    return new CnlAgent(privkey, msPrivkey, otherMsPubkey, otherAddress)
  }
  this.fromObject({privkey, msPrivkey, otherMsPubkey, otherAddress})
}

CnlAgent.prototype = Object.create(Agent.prototype)
CnlAgent.prototype.constructor = CnlAgent

/* conveniance methods */

CnlAgent.prototype.asyncSendPayment = function (amount) {
  return asink(function *() {
    if (!this.funded) {
      throw new Error('CnlAgent must me funded before payment can be sent')
    }

    // if the last payment did go in the direction of payer, decrease nlocktime
    if (this.towardsMe) {
      this.towardsMe = false
      this.nlocktime -= DELTA_NLOCKTIME
    }
    this.balance = this.balance.sub(amount)
    this.otherBalance = this.otherBalance.add(amount)

    let txb = yield this.asyncBuildParitalPaymentTx(this.otherBalance.add(amount), this.nlocktime)
    return txb
  }, this)
}

CnlAgent.prototype.asyncAcceptPayment = function (txb) {
  return asink(function *() {
    // if the last payment did _not_ go in the direction of payer,
    // check that sender has decreased nlocktime
    if (!this.towardsMe) {
      this.towardsMe = true
      // if the transaction's nlocktime plus DELTA_NLOCKTIME is bigger than the
      // nlocktime stored in the cnlAgent, the nlocktime has not been decreased sufficiently
      // in this case cnlAgent rejects the transaction
      if (txb.tx.nlocktime + DELTA_NLOCKTIME > this.nlocktime) {
        return false
      }
    }
  }, this)
}

module.exports = CnlAgent
