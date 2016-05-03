'use strict'
let Struct = require('fullnode/lib/struct')
let Script = require('fullnode/lib/script')
let Opcode = require('fullnode/lib/opcode')
let BN = require('fullnode/lib/bn')

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
  if (!agent.other.pubkey) {
    throw new Error('agent.asyncBuildMultisig must be called before Scripts.htlc')
  }
  if (!agent.other.htlcSecret) {
    throw new Error('other agent must be initialized before calling Scripts.htlc')
  }
  if (!agent.pubkey) {
    throw new Error('agent.asyncInitialize must be called before Scripts.htlc')
  }

  let script = Script()
    .writeOpcode(Opcode.OP_IF)
      // agent's sig & agent's HTLC secret needed to spend
      .writeBuffer(agent.other.pubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
      .writeOpcode(Opcode.OP_HASH160)
      .writeBuffer(agent.other.htlcSecret.hash)
      .writeOpcode(Opcode.OP_EQUAL)
    .writeOpcode(Opcode.OP_ELSE)
      // otherAgent's sig needed to spend, subject to SVC lock
      .writeBN(BN(100))
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_DROP)
      .writeBuffer(agent.pubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSIG)
    .writeOpcode(Opcode.OP_ENDIF)
  return script
}

/*
 * Constructs a revocable HTLC to otherAgent can get money if he knows the secret
 */
Scripts.rhtlc = function (agent) {
  if (!agent.other.pubkey) {
    throw new Error('agent.asyncBuildMultisig must be called before Scripts.rhtlc')
  }
  if (!agent.other.htlcSecret) {
    throw new Error('other agent must be initialized before calling Scripts.rhtlc')
  }
  if (!agent.pubkey) {
    throw new Error('agent.asyncInitialize must be called before Scripts.rhtlc')
  }
  if (!agent.other.revocationSecret) {
    throw new Error('agent.storeOtherRevocationSecret must be called before Scripts.rhtlc')
  }
  let script = Script()
    .writeOpcode(Opcode.OP_IF)
      // otherAgent's sig & otherAgent's HTLC secret needed to spend
      .writeBuffer(agent.other.pubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_HASH160)
      .writeBuffer(agent.other.htlcSecret.hash)
      .writeOpcode(Opcode.OP_EQUALVERIFY)
    .writeOpcode(Opcode.OP_ELSE)
      .writeOpcode(Opcode.OP_IF)
        // agent's sig needed to spend, subject to CSV lock
        .writeBN(BN(100))
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(agent.pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_ELSE)
        // agents sig & otherAgent's revocation secret needed to spend
        .writeBuffer(agent.pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
        .writeOpcode(Opcode.OP_HASH160)
        .writeBuffer(agent.other.revocationSecret.hash)
        .writeOpcode(Opcode.OP_EQUALVERIFY)
      .writeOpcode(Opcode.OP_ENDIF)
    .writeOpcode(Opcode.OP_ENDIF)
  return script
}

module.exports = Scripts
