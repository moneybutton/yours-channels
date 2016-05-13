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

// spends from branch 1 of htlc
Scripts.spendFromHtlc = function (agent) {
  return new Script()
    .writeBuffer(agent.htlcSecret.buf)
    .writeOpCode(OpCode.OP_TRUE)   // signature will go here
    .writeOpCode(OpCode.OP_TRUE)
}

// spends from branch 2 of htlc
Scripts.enforceFromHtlc = function () {
  return new Script()
    .writeOpCode(OpCode.OP_TRUE)   // signature will go here
    .writeOpCode(OpCode.OP_FALSE)
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
  if (!agent.other.revocationSecrets) {
    throw new Error('agent.storeOtherRevocationSecret must be called before Scripts.rhtlc')
  }

  let revocationSecrets = agent.other.revocationSecrets
  let revocationSecret = revocationSecrets[revocationSecrets.length - 1]

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
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(revocationSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
    .writeOpCode(OpCode.OP_ENDIF)
  return script
}

// spends from branch 1 of rhtlc
Scripts.spendFromRhtlc = function (agent) {
  return new Script()
    .writeBuffer(agent.htlcSecret.buf)
    .writeOpCode(OpCode.OP_TRUE)   // signature will go here
    .writeOpCode(OpCode.OP_TRUE)
}

// spends from branch 2 of rhtlc
Scripts.enforceFromRhtlc = function () {
  return new Script()
    .writeOpCode(OpCode.OP_TRUE)   // signature will go here
    .writeOpCode(OpCode.OP_TRUE)
    .writeOpCode(OpCode.OP_FALSE)
}

// spends from branch 3 of rhtlc
Scripts.revokeRhtlc = function (agent, secret) {
  return new Script()
    .writeBuffer(secret.buf)
    .writeOpCode(OpCode.OP_TRUE)   // signature will go here
    .writeOpCode(OpCode.OP_FALSE)
    .writeOpCode(OpCode.OP_FALSE)
}

module.exports = Scripts
