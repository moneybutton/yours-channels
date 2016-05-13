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
Scripts.htlc = function (spendingPubKey, otherPubKey, htlcSecret) {
  if (!spendingPubKey) {
    throw new Error('agent.asyncInitialize must be called before Scripts.htlc')
  }
  if (!otherPubKey) {
    throw new Error('agent.asyncBuildMultisig must be called before Scripts.htlc')
  }
  if (!htlcSecret) {
    throw new Error('agent must be initialized before calling Scripts.htlc')
  }

  let script = new Script()
    .writeOpCode(OpCode.OP_IF)
      // agent's sig & agent's HTLC secret needed to spend
      .writeBuffer(spendingPubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
      .writeOpCode(OpCode.OP_HASH160)
      .writeBuffer(htlcSecret.hash)
      .writeOpCode(OpCode.OP_EQUAL)
    .writeOpCode(OpCode.OP_ELSE)
      // otherAgent's sig needed to spend, subject to SVC lock
      .writeBuffer(otherPubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIG)
      .writeBn(Bn(100))
      .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
    .writeOpCode(OpCode.OP_ENDIF)
  return script
}

// spends from branch 1 of htlc
Scripts.spendFromHtlc = function (htlcSecret) {
  return new Script()
    .writeBuffer(htlcSecret.buf)
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
Scripts.rhtlc = function (spendingPubKey, otherPubKey, otherHtlcSecret, otherRevocationSecrets) {
  if (!otherPubKey) {
    throw new Error('agent.asyncBuildMultisig must be called before Scripts.rhtlc')
  }
  if (!otherHtlcSecret) {
    throw new Error('other agent must be initialized before calling Scripts.rhtlc')
  }
  if (!spendingPubKey) {
    throw new Error('agent.asyncInitialize must be called before Scripts.rhtlc')
  }
  if (!otherRevocationSecrets) {
    throw new Error('agent.storeOtherRevocationSecret must be called before Scripts.rhtlc')
  }

  let otherRevocationSecret = otherRevocationSecrets[otherRevocationSecrets.length - 1]

  let script = new Script()
    .writeOpCode(OpCode.OP_IF)
      // otherAgent's sig & otherAgent's HTLC secret needed to spend
      .writeBuffer(otherPubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
      .writeOpCode(OpCode.OP_HASH160)
      .writeBuffer(otherHtlcSecret.hash)
      .writeOpCode(OpCode.OP_EQUAL)
    .writeOpCode(OpCode.OP_ELSE)
     .writeOpCode(OpCode.OP_IF)
        // agent's sig needed to spend, subject to CSV lock
        .writeBuffer(spendingPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(Bn(100))
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
      .writeOpCode(OpCode.OP_ELSE)
        // agents sig & otherAgent's revocation secret needed to spend
        .writeBuffer(spendingPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(otherRevocationSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
    .writeOpCode(OpCode.OP_ENDIF)
  return script
}

// spends from branch 1 of rhtlc
Scripts.spendFromRhtlc = function (htlcSecret) {
  return new Script()
    .writeBuffer(htlcSecret.buf)
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
Scripts.revokeRhtlc = function (secret) {
  return new Script()
    .writeBuffer(secret.buf)
    .writeOpCode(OpCode.OP_TRUE)   // signature will go here
    .writeOpCode(OpCode.OP_FALSE)
    .writeOpCode(OpCode.OP_FALSE)
}

module.exports = Scripts
