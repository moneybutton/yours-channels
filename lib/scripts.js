'use strict'
let asink = require('asink')

let Hash = require('yours-bitcoin/lib/hash')

let Struct = require('yours-bitcoin/lib/struct')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Bn = require('yours-bitcoin/lib/bn')

class Scripts extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Constructs a HTLC where agent can get a payment if she knows the secret
   */
  static htlc (spendingPubKey, otherPubKey, htlcSecret) {
    if (!spendingPubKey) {
      throw new Error('agent.asyncInitialize must be called before static htlc')
    }
    if (!otherPubKey) {
      throw new Error('agent.asyncInitializeMultisig must be called before static htlc')
    }
    if (!htlcSecret) {
      throw new Error('agent must be initialized before calling static htlc')
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
  static spendFromHtlc (htlcSecret) {
    return new Script()
      .writeBuffer(htlcSecret.buf)
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_TRUE)
  }

  // spends from branch 2 of htlc
  static enforceFromHtlc () {
    return new Script()
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_FALSE)
  }

  /*
   * Constructs a revocable HTLC to otherAgent can get money if he knows the secret
   */
  static rhtlc (spendingPubKey, otherPubKey, otherHtlcSecret, otherRevocationSecrets) {
    if (!otherPubKey) {
      throw new Error('agent.asyncInitializeMultisig must be called before static rhtlc')
    }
    if (!otherHtlcSecret) {
      throw new Error('other agent must be initialized before calling static rhtlc')
    }
    if (!spendingPubKey) {
      throw new Error('agent.asyncInitialize must be called before static rhtlc')
    }
    if (!otherRevocationSecrets) {
      throw new Error('agent.setOtherRevocationSecret must be called before static rhtlc')
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
  static spendFromRhtlc (htlcSecret) {
    return new Script()
      .writeBuffer(htlcSecret.buf)
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_TRUE)
  }

  // spends from branch 2 of rhtlc
  static enforceFromRhtlc () {
    return new Script()
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_TRUE)
      .writeOpCode(OpCode.OP_FALSE)
  }

  // spends from branch 3 of rhtlc
  static revokeRhtlc (secret) {
    return new Script()
      .writeBuffer(secret.buf)
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_FALSE)
      .writeOpCode(OpCode.OP_FALSE)
  }

  static toP2shInput (script, redeemScript) {
    return script.writeBuffer(redeemScript.toBuffer())
  }

  static asyncToP2shOutput (script) {
    return asink(function *() {
      let scriptHash = yield Hash.asyncSha256Ripemd160(script.toBuffer())
      return new Script()
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(scriptHash)
        .writeOpCode(OpCode.OP_EQUAL)
    }, this)
  }
}

module.exports = Scripts
