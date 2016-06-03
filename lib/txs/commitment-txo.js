'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Secret = require('../scrts/secret.js')
let Txo = require('./txo.js')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let TxOutMap = require('yours-bitcoin/lib/tx-out-map')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Bn = require('yours-bitcoin/lib/bn')

class CommitmentTxo extends Txo {
  constructor () {
    super()
    this.fromObject({})
  }

  initializeAddresses (multisig, destinations) {
    this.multisig = multisig
    this.destinations = destinations
  }

  initializeFundingTxo (fundingTxo) {
    this.fundingTxo = fundingTxo
  }

  asyncBuild (outputList, changeOutput, destinations, ownerId, builerId) {
    return asink(function *() {
      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(this.fundingTxo.txb.tx.hash(), 0, this.fundingTxo.txb.tx.txOuts[0], this.multisig.script)

      let redeemScript, scriptPubkey
      for (let i = 0; i < outputList.length; i++) {
        // build output scripts
        redeemScript = this.buildRedeemScript(outputList[i], destinations, ownerId, builerId)
        scriptPubkey = yield this.asyncToP2shOutput(redeemScript)
        this.txb.outputToScript(outputList[i].amount, scriptPubkey)
      }
      // build change script
      redeemScript = this.buildRedeemScript(changeOutput, destinations, ownerId, builerId)
      this.txb.setChangeScript(redeemScript)
      this.txb.build()
      yield this.txb.asyncSign(0, this.multisig.keyPair, this.fundingTxo.txb.tx.txOuts[0])
    }, this)
  }

  buildRedeemScript(outputObject, destinations, ownerId, builerId) {
    if (outputObject.to == builerId) {
      return this.htlcScript(
        destinations[ownerId].keyPair.pubKey,
        destinations[builerId].keyPair.pubKey,
        outputObject.htlcSecret)
    // the output to an owner should be revocable, thus a RHTCL
    } if (outputObject.to == ownerId) {
      return this.rhtlcScript(
        destinations[ownerId].keyPair.pubKey,
        destinations[builerId].keyPair.pubKey,
        outputObject.htlcSecret,
        outputObject.revocationSecret)
    } else {
      throw new Error('invalid id in CommitmentTxo.asyncBuild')
    }
  }

  /*
   * Constructs a HTLC where agent can get a payment if she knows the secret
   */
  htlcScript (ownerPubKey, builderPubKey, htlcSecret) {
    if(!ownerPubKey || !builderPubKey || !htlcSecret) {
      throw new Error('Insuficient arguments for htlcScript')
    }

    let script = new Script()
      .writeOpCode(OpCode.OP_IF)
        // agent's sig & agent's HTLC secret needed to spend
        .writeBuffer(builderPubKey.toBuffer()) // push the agent's pubKey
        .writeOpCode(OpCode.OP_CHECKSIG) // check sig against redeem script
        .writeOpCode(OpCode.OP_HASH160) // hash htlc secret from redeem script
        .writeBuffer(htlcSecret.hash) // push htlc secret hash of the htlc secret
        .writeOpCode(OpCode.OP_EQUAL) // check equality
        .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
      .writeOpCode(OpCode.OP_ELSE)
        // otherAgent's sig needed to spend, subject to SVC lock
        .writeBuffer(ownerPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(Bn(100))
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
      .writeOpCode(OpCode.OP_ENDIF)
    return script
  }

  /*
   * Constructs a revocable HTLC to otherAgent can get money if he knows the secret
   */
  rhtlcScript (ownerPubKey, builderPubKey, ownerHtlcSecret, ownerRevocationSecret) {
    if(!ownerPubKey || !builderPubKey || !ownerHtlcSecret || !ownerRevocationSecret) {
      throw new Error('Insuficient arguments for htlcScript')
    }

    let script = new Script()
      .writeOpCode(OpCode.OP_IF)
        // otherAgent's sig & otherAgent's HTLC secret needed to spend
        .writeBuffer(ownerPubKey.toBuffer()) // push the other agent's pubKey
        .writeOpCode(OpCode.OP_CHECKSIG) // check the signature in the redeemScript
        .writeOpCode(OpCode.OP_HASH160) // hash the htlc secret from the redeemScript
        .writeBuffer(ownerHtlcSecret.hash) // push the hash of the htlc secret
        .writeOpCode(OpCode.OP_EQUAL) // check equality
        .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
      .writeOpCode(OpCode.OP_ELSE)
       .writeOpCode(OpCode.OP_IF)
          // agent's sig needed to spend, subject to CSV lock
          .writeBuffer(builderPubKey.toBuffer())
          .writeOpCode(OpCode.OP_CHECKSIG)
          .writeBn(Bn(100))
          .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_ELSE)
          // agents sig & otherAgent's revocation secret needed to spend
          .writeBuffer(builderPubKey.toBuffer())
          .writeOpCode(OpCode.OP_CHECKSIG)
          .writeOpCode(OpCode.OP_HASH160)
          .writeBuffer(ownerRevocationSecret.hash)
          .writeOpCode(OpCode.OP_EQUAL)
          .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
        .writeOpCode(OpCode.OP_ENDIF)
      .writeOpCode(OpCode.OP_ENDIF)
    return script
  }
}

module.exports = CommitmentTxo
