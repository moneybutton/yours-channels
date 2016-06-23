'use strict'
let asink = require('asink')
let TxObj = require('./tx-obj')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let Sig = require('yours-bitcoin/lib/sig')
let OpCode = require('yours-bitcoin/lib/op-code')
let Hash = require('yours-bitcoin/lib/hash')
let KeyPair = require('yours-bitcoin/lib/key-pair')

class SpendingTxObj extends TxObj {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
  * Used to build destination transactions in which spend from non-standard outputs
  * like htlc or rhtlc. Conveniance function that all destination transactions call
  */
  asyncBuild (address, commitmentTxObj, bip, builderId, commitmentTxDepth) { // rename bip to xprv
    return asink(function * () {
      this.txb = new TxBuilder()
      this.txb.setVersion(2)
      let txseqnum = 100 // this will need to be stored in outputList eventually

      // build input scripts form outputList
      for (let i in commitmentTxObj.outputList) {
        i = parseInt(i)
        Object.assign(
          commitmentTxObj.outputList[i],
          this.buildInputScript(commitmentTxObj.outputList[i], builderId))
        if (commitmentTxObj.outputList[i].partialScriptSig) {
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
      }

      if (!this.txb.txIns.length) {
        throw new Error('no spendable outputs found')
      }

      this.txb.setChangeAddress(address)
      this.txb.build(true)

      // sign the input scripts
      for (let i in commitmentTxObj.outputList) {
        i = parseInt(i)
        if (commitmentTxObj.outputList[i].partialScriptSig) {
          let path = commitmentTxObj.outputList[i].channelDestPath

          let keyPair = new KeyPair(
            (yield bip.asyncDerive(path)).privKey,
            (yield bip.asyncDerive(path)).pubKey)
          // console.log('spend priv key', keyPair.privKey.toJSON());
          // console.log('spend pub key', keyPair.pubKey.toJSON());
          let sig = this.txb.getSig(
            keyPair,
            Sig.SIGHASH_ALL,
            i,
            commitmentTxObj.outputList[i].redeemScript)
          commitmentTxObj.outputList[i].partialScriptSig.setChunkBuffer(
            commitmentTxObj.outputList[i].sigPos,
            sig.toTxFormat())
          this.txb.tx.txIns[i].setScript(commitmentTxObj.outputList[i].partialScriptSig)
        }
      }
    }, this)
  }

  buildInputScript (outputObject, builderId) {
    if (outputObject.kind === 'pubKey' && !outputObject.revocable) {
      return this.pubKeyInputScript(outputObject, builderId)
    } else if (outputObject.kind === 'pubKey' && outputObject.revocable) {
      return this.revPubKeyInputScript(outputObject, builderId)
    } else if (outputObject.kind === 'htlc' && !outputObject.revocable) {
      return this.htlcInputScript(outputObject, builderId)
    } else if (outputObject.kind === 'htlc' && outputObject.revocable) {
      return this.revHtlcInputScript(outputObject, builderId)
    }
  }

  /* spending from pubkey script */
  pubKeyInputScript (outputObject, builderId) {
    if (builderId === outputObject.channelDestId) {
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE),   // signature will go here
        sigPos: 0
      }
    } else {
      return {}
    }
  }

  /* spending from revocable pubkey script */
  revPubKeyInputScript (outputObject, builderId) {
    if (builderId === outputObject.channelDestId) {
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 0
      }
    } else if (builderId !== outputObject.channelDestId && outputObject.revocationSecret.buf) {
      return {
        partialScriptSig: new Script()
          .writeBuffer(outputObject.revocationSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 1
      }
    } else {
      return {}
    }
  }

  /* spending from htlc script */
  htlcInputScript (outputObject, builderId) {
    if (builderId === outputObject.channelDestId && outputObject.htlcSecret.buf) {
      // spends from branch 1 of htlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(outputObject.htlcSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 1
      }
    } else if (builderId !== outputObject.channelDestId && true) { // check CSV constraint here
      // spends from branch 2 of htlc
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 0
      }
    } else {
      return {}
    }
  }

  revHtlcInputScript (outputObject, builderId) {
    if (builderId === outputObject.channelDestId && outputObject.htlcSecret.buf) {
      // spends from branch 1 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(outputObject.htlcSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 1
      }
    } else if (builderId !== outputObject.channelDestId && true) { // check CSV constraint here
      // spends from branch 2 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE)
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 0
      }
    } else if (builderId !== outputObject.channelDestId && outputObject.revocationSecret.buf) {
      // spends from branch 3 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(outputObject.revocationSecret.buf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE)
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 1
      }
    } else {
      return {}
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
