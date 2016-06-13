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
  * Used to build destination transactions in which spend from non-standard outputs
  * like htlc or rhtlc. Conveniance function that all destination transactions call
  */
  asyncBuild (destination, commitmentTxObj) {
    return asink(function * () {
      this.txb = new TxBuilder()
      this.txb.setVersion(2)
      let commitmentTx = commitmentTxObj.txb.tx

      // build input scripts
      for (let i in commitmentTxObj.outputList) {
        i = parseInt(i)
        let { sigPos, partialScriptSig } = this.inputScript(commitmentTxObj.outputList[i])

        commitmentTxObj.outputList[i].sigPos = sigPos
        commitmentTxObj.outputList[i].partialScriptSig = partialScriptSig
        let redeemScript = commitmentTxObj.outputList[i].redeemScript
        let txseqnum = 100
        let scriptSig = this.toP2shInput(partialScriptSig, redeemScript)
        this.txb.inputFromScript(commitmentTx.hash(), i, commitmentTx.txOuts[i], scriptSig, txseqnum)
      }

      // build the transaction
      this.txb.setChangeAddress(destination.address)
      this.txb.build()

      // sign the input scripts
      for (let i in commitmentTxObj.outputList) {
        i = parseInt(i)
        let sig = this.txb.getSig(
          destination.keyPair,
          Sig.SIGHASH_ALL,
          0,
          commitmentTx.txOuts[i].script)
        commitmentTxObj.outputList[i].partialScriptSig.setChunkBuffer(
          commitmentTxObj.outputList[i].sigPos,
          sig.toTxFormat())
        this.txb.tx.txIns[i].setScript(commitmentTxObj.outputList[i].partialScriptSig)
      }
    }, this)
  }

  inputScript (outputObject) {
    let partialScriptSig, sigPos
    if (outputObject.kind === 'htlc') {
      if (outputObject.spendingAction === 'spend') {
        // spends from branch 1 of htlc
        partialScriptSig = new Script()
          .writeBuffer(outputObject.htlcSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE)
        sigPos = 1
      } else if (outputObject.spendingAction === 'enforce') {
        // spends from branch 2 of htlc
        partialScriptSig = new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE)
        sigPos = 0
      } else {
        throw new Error('Error 1 in spendingTxObj.inputScript')
      }
    } else if (outputObject.kind === 'revHtlc') {
      if (outputObject.spendingAction === 'spend') {
        // spends from branch 1 of rhtlc
        partialScriptSig = new Script()
          .writeBuffer(outputObject.htlcSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE)
        sigPos = 1
      } else if (outputObject.spendingAction === 'enforce') {
        // spends from branch 2 of rhtlc
        partialScriptSig = new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE)
          .writeOpCode(OpCode.OP_FALSE)
        sigPos = 0
      } else if (outputObject.spendingAction === 'revoke') {
        // spends from branch 2 of rhtlc
        partialScriptSig = new Script()
          .writeBuffer(outputObject.revocationSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE)
          .writeOpCode(OpCode.OP_FALSE)
        sigPos = 1
      } else {
        throw new Error('Error 2 in spendingTxObj.inputScript')
      }
    }
    return { partialScriptSig: partialScriptSig, sigPos: sigPos }
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
