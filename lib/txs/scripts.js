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
    if (!script || !redeemScript) {
      throw new Error('Insuficient parameters for toP2shInput')
    }
    return script.writeBuffer(redeemScript.toBuffer())
  }

  static asyncToP2shOutput (script) {
    return asink(function *() {
      if (!script) {
        throw new Error('Insuficient parameters for asyncToP2shOutput')
      }
      let scriptHash = yield Hash.asyncSha256Ripemd160(script.toBuffer())

      return new Script()
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(scriptHash)
        .writeOpCode(OpCode.OP_EQUAL)
    }, this)
  }
}

module.exports = Scripts
