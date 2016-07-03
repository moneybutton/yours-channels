'use strict'
let asink = require('asink')
let Tx = require('./tx')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let Sig = require('yours-bitcoin/lib/sig')
let OpCode = require('yours-bitcoin/lib/op-code')
let Hash = require('yours-bitcoin/lib/hash')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let Bn = require('yours-bitcoin/lib/bn')
let Consts = require('../consts.js')

class Spending extends Tx {
  constructor (txb) {
    super({txb})
  }

  /*
  * Used to build destination transactions in which spend from non-standard outputs
  * like htlc or rhtlc. Conveniance function that all destination transactions call
  */
  asyncBuild (address, commitment, xPrv, myId, commitmentTxDepth, secretMap) {
    return asink(function * () {
      this.txb = new TxBuilder()
      this.txb.setVersion(2)

      // build input scripts form outputs
      for (let i in commitment.outputs) {
        i = parseInt(i)
        Object.assign(
          commitment.outputs[i],
          this.buildInputScript(commitment.outputs[i], myId, commitmentTxDepth, secretMap))

        if (commitment.outputs[i].partialScriptSig) {
          let scriptSig = this.toP2shInput(
            commitment.outputs[i].partialScriptSig,
            commitment.outputs[i].redeemScript)
          this.txb.inputFromScript(
            commitment.txb.tx.hash(),
            i,
            commitment.txb.tx.txOuts[i],
            scriptSig,
            commitment.outputs[i].csvDelay || Consts.CSV_DELAY)
        }
      }

      if (!this.txb.txIns.length) {
        throw new Error('no spendable outputs found')
      }

      this.txb.setChangeAddress(address)
      this.txb.build(true)

      // sign the input scripts
      let nIn = 0
      for (let i in commitment.outputs) {
        i = parseInt(i)
        if (commitment.outputs[i].partialScriptSig) {
          let path = commitment.outputs[i].channelDestPath

          let keyPair = new KeyPair(
            (yield xPrv.asyncDerive(path)).privKey,
            (yield xPrv.asyncDerive(path)).pubKey
          )
          let sig = this.txb.getSig(
            keyPair,
            Sig.SIGHASH_ALL,
            nIn,
            commitment.outputs[i].redeemScript)
          commitment.outputs[i].partialScriptSig.setChunkBuffer(
            commitment.outputs[i].sigPos,
            sig.toTxFormat())
          this.txb.tx.txIns[nIn].setScript(commitment.outputs[i].partialScriptSig)
          nIn++
        }
      }
    }, this)
  }

  buildInputScript (outputObject, myId, commitmentTxDepth, secretMap) {
    if (outputObject.kind === 'pubKey' && !outputObject.revocable) {
      return this.pubKeyInputScript(outputObject, myId)
    } else if (outputObject.kind === 'pubKey' && outputObject.revocable) {
      return this.revPubKeyInputScript(outputObject, myId, commitmentTxDepth, secretMap)
    } else if (outputObject.kind === 'htlc' && !outputObject.revocable) {
      return this.htlcInputScript(outputObject, myId, commitmentTxDepth, secretMap)
    } else if (outputObject.kind === 'htlc' && outputObject.revocable) {
      return this.revHtlcInputScript(outputObject, myId, commitmentTxDepth, secretMap)
    }
  }

  /* spending from pubkey script */
  pubKeyInputScript (outputObject, myId) {
    if (myId === outputObject.channelDestId) {
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
  revPubKeyInputScript (outputObject, myId, commitmentTxDepth, secretMap) {
    let csvDelay = outputObject.csvDelay || Consts.CSV_DELAY
    if (myId === outputObject.channelDestId && parseInt(commitmentTxDepth) >= parseInt(csvDelay)) {
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 0
      }
    } else if (myId !== outputObject.channelDestId && outputObject.revSecret.buf) {
      let revSecretBuf = secretMap.get(outputObject.revSecret.hash.toString('hex'))
      return {
        partialScriptSig: new Script()
          .writeBuffer(revSecretBuf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 1
      }
    } else {
      return {}
    }
  }

  /* spending from htlc script */
  htlcInputScript (outputObject, myId, commitmentTxDepth, secretMap) {
    let csvDelay = outputObject.csvDelay || Consts.CSV_DELAY
    let htlcSecretBuf = secretMap.get(outputObject.htlcSecret.hash.toString('hex'))

    if (myId === outputObject.channelDestId && htlcSecretBuf) {
      // spends from branch 1 of htlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(htlcSecretBuf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 1
      }
    } else if (myId !== outputObject.channelDestId && parseInt(commitmentTxDepth) >= parseInt(csvDelay)) {
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

  revHtlcInputScript (outputObject, myId, commitmentTxDepth, secretMap) {
    let longDelay = outputObject.csvDelay || Consts.CSV_DELAY
    let shortDelay = longDelay.div(Bn(2))
    let htlcSecretBuf = secretMap.get(outputObject.htlcSecret.hash.toString('hex'))
    let revSecretBuf = secretMap.get(outputObject.revSecret.hash.toString('hex'))

    if (myId === outputObject.channelDestId && htlcSecretBuf && parseInt(commitmentTxDepth) >= parseInt(shortDelay)) {
      // spends from branch 1 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(htlcSecretBuf)
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE),
        sigPos: 1
      }
    } else if (myId !== outputObject.channelDestId && parseInt(commitmentTxDepth) >= parseInt(longDelay)) { // check CSV constraint here
      // spends from branch 2 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeOpCode(OpCode.OP_TRUE)   // signature will go here
          .writeOpCode(OpCode.OP_TRUE)
          .writeOpCode(OpCode.OP_FALSE),
        sigPos: 0
      }
    } else if (myId !== outputObject.channelDestId && revSecretBuf) {
      // spends from branch 3 of rhtlc
      return {
        partialScriptSig: new Script()
          .writeBuffer(revSecretBuf)
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
      throw new Error('Insufficient parameters for toP2shInput')
    }
    return script.writeBuffer(redeemScript.toBuffer())
  }

  asyncToP2shOutput (script) {
    return asink(function * () {
      if (!script) {
        throw new Error('Insufficient parameters for asyncToP2shOutput')
      }
      let scriptHash = yield Hash.asyncSha256Ripemd160(script.toBuffer())

      return new Script()
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(scriptHash)
        .writeOpCode(OpCode.OP_EQUAL)
    }, this)
  }
}

module.exports = Spending
