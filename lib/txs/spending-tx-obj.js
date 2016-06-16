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
  asyncBuild (destination, commitmentTxObj, agentId) {
    return asink(function * () {
      this.txb = new TxBuilder()
      this.txb.setVersion(2)
      let txseqnum = 100 // this will need to be stored in outputList eventually

      // build input scripts form outputList
      for (let i in commitmentTxObj.outputList) {
        i = parseInt(i)
        Object.assign(
          commitmentTxObj.outputList[i],
          this.buildInputScript(commitmentTxObj.outputList[i]))
        let scriptSig = this.toP2shInput(
          commitmentTxObj.outputList[i].partialScriptSig,
          commitmentTxObj.outputList[i].redeemScript)
        this.txb.inputFromScript(
          commitmentTxObj.txb.tx.hash(),
          i,
          commitmentTxObj.txb.tx.txOuts[i],
          scriptSig,
          txseqnum)
      }

      // TODO: build input scripts form changeOutput

      // build the transaction
      // this.txb.outputToAddress
      this.txb.setChangeAddress(destination.address)
      this.txb.build(true)

      // sign the input scripts
      for (let i in commitmentTxObj.outputList) {
        i = parseInt(i)
        let sig = this.txb.getSig(
          destination.keyPair,
          Sig.SIGHASH_ALL,
          0,
          commitmentTxObj.txb.tx.txOuts[i].script)
        commitmentTxObj.outputList[i].partialScriptSig.setChunkBuffer(
          commitmentTxObj.outputList[i].sigPos,
          sig.toTxFormat())
        this.txb.tx.txIns[i].setScript(commitmentTxObj.outputList[i].partialScriptSig)
      }
    }, this)
  }

  buildInputScript (outputObject) {
    if (outputObject.kind === 'pubKey' && !outputObject.revocable) {
      return this.pubKeyInputScript()
    } else if (outputObject.kind === 'pubKey' && outputObject.revocable) {
      return this.revPubKeyInputScript(outputObject.spendingAction, outputObject.revocationSecret)
    } else if (outputObject.kind === 'htlc' && !outputObject.revocable) {
      return this.htlcInputScript(outputObject.spendingAction, outputObject.htlcSecret)
    } else if (outputObject.kind === 'htlc' && outputObject.revocable) {
      return this.revHtlcInputScript(outputObject.spendingAction, outputObject.htlcSecret, outputObject.revocationSecret)
    }
  }

  // script that spends from an p2sh pubKey script
  pubKeyInputScript () {
    return {
      partialScriptSig: new Script()
        .writeOpCode(OpCode.OP_TRUE),   // signature will go here
      sigPos: 0
    }
  }

  // script that spends from an p2sh pubKey script
  revPubKeyInputScript (spendingAction, revocationSecret) {
    if (spendingAction === 'spend') {
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 0
      }
    } else if (spendingAction === 'spend-revoked') {
      return {
        partialScriptSig: new Script()
          .writeBuffer(revocationSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 1
      }
    } else {
      throw new Error('Invalid spendingAction in buildInputScript, case revocable pubKey')
    }
  }

  // script that spends from an HTLC
  htlcInputScript (spendingAction, htlcSecret) {
    if (spendingAction === 'spend') {
      // spends from branch 1 of htlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(htlcSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 0
      }
    } else if (spendingAction === 'enforce') {
      // spends from branch 2 of htlc
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 0
      }
    } else {
      throw new Error('Invalid spendingAction in buildInputScript, case htlc')
    }
  }

  // scripts that spend from a revocable HTLC
  revHtlcInputScript (spendingAction, htlcSecret, revocationSecret) {
    if (spendingAction === 'spend') {
      // spends from branch 1 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(htlcSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 1
      }
    } else if (spendingAction === 'enforce') {
      // spends from branch 2 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE)
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 0
      }
    } else if (spendingAction === 'spend-revoked') {
      // spends from branch 2 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(revocationSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE)
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 1
      }
    } else {
      throw new Error('Invalid spendingAction in buildInputScript, case revocable htlc')
    }
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
