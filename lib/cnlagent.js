'use strict'
let asink = require('asink')
let Agent = require('./agent.js')
let Script = require('fullnode/lib/script')
let Opcode = require('fullnode/lib/opcode')
let Hash = require('fullnode/lib/hash')

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

CnlAgent.prototype.asyncSendPayment = function (amount, script) {
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

    let txb = yield this.asyncBuildParitalPaymentTx(this.otherBalance.add(amount), script, this.nlocktime)
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
    // TODO check balaces in txb and update this.balance, this.otherBalance

    let tx = yield this.asyncBuildPaymentTx(txb)
    return tx
  }, this)
}

CnlAgent.addressScript = function (address) {
  return address.toScript()
}

CnlAgent.htlcScript = function (pubkey) {
  let secretbuf = new Buffer('this is a secret string')
  let hashbuf = Hash.sha256(secretbuf)

  return Script()
    .writeOpcode(Opcode.OP_SHA256)
    .writeBuffer(hashbuf)
    .writeOpcode(Opcode.OP_EQUALVERIFY)
//    .writeBuffer(pubkey.toBuffer())  // TODO use otherAddress here somehow
    .writeOpcode(Opcode.OP_CHECKSIG)
}

module.exports = CnlAgent
