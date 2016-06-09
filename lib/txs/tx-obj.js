'use strict'
let asink = require('asink')
let Hash = require('yours-bitcoin/lib/hash')
let Struct = require('yours-bitcoin/lib/struct')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')

class TxObj extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  toP2shInput (script, redeemScript) {
    if (!script || !redeemScript) {
      throw new Error('Insuficient parameters for toP2shInput')
    }
    return script.writeBuffer(redeemScript.toBuffer())
  }

  asyncToP2shOutput (script) {
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

module.exports = TxObj
