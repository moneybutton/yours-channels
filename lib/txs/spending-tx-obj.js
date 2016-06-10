'use strict'
let asink = require('asink')
let TxObj = require('./tx-obj')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let Sig = require('yours-bitcoin/lib/sig')
let OpCode = require('yours-bitcoin/lib/op-code')
let Hash = require('yours-bitcoin/lib/hash')

class SpendingTxObj extends TxObj {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
  NOTE old version was: return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
    Scripts.spendFromRhtlc(commitmentTxo.htlcSecret), commitmentTxo.rhtlcRedeemScript,
    1, commitmentTxo.rhtlcOutNum)

  * Used to build destination transactions in which spend from non-standard outputs
  * like htlc or rhtlc. Conveniance function that all destination transactions call
  */
  asyncBuild (destination, commitmentTxObj) {
    return asink(function * () {
      let commitmentTx = commitmentTxObj.txb.tx
      let partialScriptSig = this.spendFromRhtlc(commitmentTxObj.htlcSecret)
      let redeemScript = commitmentTxObj.rhtlcRedeemScript
      let sigPos = 1
      let txoutnum = 0

      let txhashbuf = commitmentTx.hash()
      let txout = commitmentTx.txOuts[txoutnum]
      let txseqnum = 100

      this.txb = new TxBuilder()
      this.txb.setVersion(2)

      // build the input script
      let scriptSig = this.toP2shInput(partialScriptSig, redeemScript)

      this.txb.inputFromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      this.txb.setChangeAddress(destination.address)
      this.txb.build()

      // sign the input script
      let subScript = commitmentTx.txOuts[txoutnum].script
      let sig = this.txb.getSig(destination.keyPair, Sig.SIGHASH_ALL, 0, subScript)
      scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
      this.txb.tx.txIns[0].setScript(scriptSig)
    }, this)
  }

  // spends from branch 1 of rhtlc
  spendFromRhtlc (htlcSecret) {
    return new Script()
      .writeBuffer(htlcSecret.buf)
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_TRUE)
  }

  // spends from branch 2 of rhtlc
  enforceFromRhtlc () {
    return new Script()
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_TRUE)
      .writeOpCode(OpCode.OP_FALSE)
  }

  // spends from branch 3 of rhtlc
  revokeRhtlc (revocationSecret) {
    return new Script()
      .writeBuffer(revocationSecret.buf)
      .writeOpCode(OpCode.OP_TRUE)   // signature will go here
      .writeOpCode(OpCode.OP_FALSE)
      .writeOpCode(OpCode.OP_FALSE)
  }

  toP2shInput (script, redeemScript) {
    if (!script || !redeemScript) {
      throw new Error('Insuficient parameters for toP2shInput')
    }
    return script.writeBuffer(redeemScript.toBuffer())
  }

  asyncToP2shOutput (script) {
    return asink(function * () {
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

module.exports = SpendingTxObj
