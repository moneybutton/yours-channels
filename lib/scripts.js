'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Bn = require('yours-bitcoin/lib/bn')

// let asink = require('asink')
// let Hash = require('fullnode/lib/hash')
// let Random = require('fullnode/lib/random')

function Scripts () {
  if (!(this instanceof Scripts)) {
    return new Scripts()
  }
  this.fromObject({})
}

Scripts.prototype = Object.create(Struct.prototype)
Scripts.prototype.constructor = Scripts

/*
 * Constructs a HTLC where agent can get a payment if she knows the secret
 */
Scripts.htlc = function (agent) {
  if (!agent.other.pubKey) {
    throw new Error('agent.asyncBuildMultisig must be called before Scripts.htlc')
  }
  if (!agent.htlcSecret) {
    throw new Error('agent must be initialized before calling Scripts.htlc')
  }
  if (!agent.spending.keyPair.pubKey) {
    throw new Error('agent.asyncInitialize must be called before Scripts.htlc')
  }

  let script = new Script()
    .writeOpCode(OpCode.OP_IF)
      // agent's sig & agent's HTLC secret needed to spend
      .writeBuffer(agent.spending.keyPair.pubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
      .writeOpCode(OpCode.OP_HASH160)
      .writeBuffer(agent.htlcSecret.hash)
      .writeOpCode(OpCode.OP_EQUAL)
    .writeOpCode(OpCode.OP_ELSE)
      // otherAgent's sig needed to spend, subject to SVC lock
      .writeBuffer(agent.other.pubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIG)
      .writeBn(Bn(100))
      .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
    .writeOpCode(OpCode.OP_ENDIF)
  return script
}

/*
 * Constructs a revocable HTLC to otherAgent can get money if he knows the secret
 */
Scripts.rhtlc = function (agent) {
  if (!agent.other.pubKey) {
    throw new Error('agent.asyncBuildMultisig must be called before Scripts.rhtlc')
  }
  if (!agent.other.htlcSecret) {
    throw new Error('other agent must be initialized before calling Scripts.rhtlc')
  }
  if (!agent.spending.keyPair.pubKey) {
    throw new Error('agent.asyncInitialize must be called before Scripts.rhtlc')
  }
  if (!agent.other.revocationSecret) {
    throw new Error('agent.storeOtherRevocationSecret must be called before Scripts.rhtlc')
  }

  let script = new Script()
    .writeOpCode(OpCode.OP_IF)
      // otherAgent's sig & otherAgent's HTLC secret needed to spend
      .writeBuffer(agent.other.pubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
      .writeOpCode(OpCode.OP_HASH160)
      .writeBuffer(agent.other.htlcSecret.hash)
      .writeOpCode(OpCode.OP_EQUAL)
    .writeOpCode(OpCode.OP_ELSE)
     .writeOpCode(OpCode.OP_IF)
        // agent's sig needed to spend, subject to CSV lock
        .writeBuffer(agent.spending.keyPair.pubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(Bn(100))
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
      .writeOpCode(OpCode.OP_ELSE)
        // agents sig & otherAgent's revocation secret needed to spend
        .writeBuffer(agent.spending.keyPair.pubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(agent.other.revocationSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
    .writeOpCode(OpCode.OP_ENDIF)
  return script
}

Scripts.spendFromRhtlc = function (agent) {
  return new Script()
    .writeBuffer(agent.htlcSecret.buf)
    .writeOpCode(OpCode.OP_TRUE)
    .writeOpCode(OpCode.OP_TRUE)
}

Scripts.spendFromHtlc = function (agent) {
  return new Script()
    .writeBuffer(agent.htlcSecret.buf)
    .writeOpCode(OpCode.OP_TRUE)
    .writeOpCode(OpCode.OP_TRUE)
}

Scripts.enforceFromHtlc = function () {
  return new Script()
    .writeOpCode(OpCode.OP_TRUE)
    .writeOpCode(OpCode.OP_FALSE)
}

Scripts.enforceFromRhtlc = function () {
  return new Script()
    .writeOpCode(OpCode.OP_TRUE)
    .writeOpCode(OpCode.OP_TRUE)
    .writeOpCode(OpCode.OP_FALSE)
}

module.exports = Scripts
