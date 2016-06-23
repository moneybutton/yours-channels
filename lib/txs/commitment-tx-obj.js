'use strict'
let asink = require('asink')
let TxObj = require('./tx-obj')
let KeyPairAddress = require('../addrs/key-pair-address')
let OutputDescription = require('../output-description')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Address = require('yours-bitcoin/lib/address')
let Consts = require('../consts.js')

class CommitmentTxObj extends TxObj {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncBuild (fundingTxb, multisigAddress, builderId, bips) { // rename bips to xpubs
    return asink(function * () {
      if (!this.outputList) {
        throw new Error('CommitmentTxObj not sufficiently initialized')
      }

      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(yield fundingTxb.tx.asyncHash(), 0, fundingTxb.tx.txOuts[0], multisigAddress.script)
      for (let i = 0; i < this.outputList.length; i++) {
        // build output scripts
        this.outputList[i].revocable = this.outputList[i].channelDestId !== builderId
        this.outputList[i].redeemScript = this.buildRedeemScript(this.outputList[i], builderId, bips)
        this.outputList[i].scriptPubkey = Address.fromRedeemScript(this.outputList[i].redeemScript).toScript()
        // this.outputList[i].scriptPubkey = yield this.asyncToP2shOutput(this.outputList[i].redeemScript)
        if (i < this.outputList.length - 1) {
          this.txb.outputToScript(this.outputList[i].amount, this.outputList[i].scriptPubkey)
        } else {
          this.txb.setChangeScript(this.outputList[i].scriptPubkey)
        }
      }

      this.txb.build()
      yield this.txb.asyncSign(0, multisigAddress.keyPair, fundingTxb.tx.txOuts[0])
    }, this)
  }

  buildRedeemScript (outputObject, builderId, bips) {
    if (outputObject.kind === undefined) {
      throw new Error('Insuficient arguments for buildRedeemScript')
    }

    let sourcePath = outputObject.channelSourcePath
    let sourceBip = bips[outputObject.channelSourceId]
    let sourcePubKey = sourceBip.derive(sourcePath).pubKey

    let destPath = outputObject.channelDestPath
    let destBip = bips[outputObject.channelDestId]
    let destPubKey = destBip.derive(destPath).pubKey

    if (outputObject.kind === 'pubKey' && outputObject.channelDestId === builderId) {
      // build an spend to pubkey script
      return this.pubKeyRedeemScript(destPubKey)
    } else if (outputObject.kind === 'pubKey' && outputObject.channelDestId !== builderId) {
      // build a revocable spend to pubkey script
      return this.revPubKeyRedeemScript(destPubKey, sourcePubKey, outputObject)
    } else if (outputObject.kind === 'htlc' && outputObject.channelDestId === builderId) {
      // build an HTLC script
      return this.htlcRedeemScript(destPubKey, sourcePubKey, outputObject)
    } if (outputObject.kind === 'htlc' && outputObject.channelDestId !== builderId) {
      // build a revocable HTLC sctipt
      return this.revHtlcRedeemScript(destPubKey, sourcePubKey, outputObject)
    } else {
      throw new Error('invalid kind in CommitmentTxObj.asyncBuild')
    }
  }

  pubKeyRedeemScript (destPubKey) {
    return new Script()
      .writeBuffer(destPubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIG)
  }

  // all checks but the last should be ...VERIFY
  revPubKeyRedeemScript (destPubKey, sourcePubKey, outputObject) {
    return new Script()
      .writeOpCode(OpCode.OP_IF)
        // normal output to dest
        .writeBuffer(destPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(outputObject.csvDelay || Consts.CSV_DELAY)
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_DROP)
      .writeOpCode(OpCode.OP_ELSE)
        // sourcePubKey & owner's revocation secret needed to spend
        .writeBuffer(sourcePubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(outputObject.revocationSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
  }

  htlcRedeemScript (destPubKey, sourcePubKey, outputObject) {
    return new Script()
      .writeOpCode(OpCode.OP_IF)
        // dest's sig & agent's HTLC secret needed to spend
        .writeBuffer(destPubKey.toBuffer()) // push the agent's pubKey
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY) // check sig against redeem script
        .writeOpCode(OpCode.OP_HASH160) // hash htlc secret from redeem script
        .writeBuffer(outputObject.htlcSecret.hash) // push htlc secret hash of the htlc secret
        .writeOpCode(OpCode.OP_EQUAL) // check equality
      .writeOpCode(OpCode.OP_ELSE)
        // source's sig needed to spend, subject to SVC lock
        .writeBuffer(sourcePubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(outputObject.csvDelay || Consts.CSV_DELAY)
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
      .writeOpCode(OpCode.OP_ENDIF)
  }

  revHtlcRedeemScript (destPubKey, sourcePubKey, outputObject) {
    return new Script()
      .writeOpCode(OpCode.OP_IF)
        // channel dests's sig & network dests's HTLC secret needed to spend
        .writeBuffer(destPubKey.toBuffer()) // push the other agent's pubKey
        .writeOpCode(OpCode.OP_CHECKSIG) // check the signature in the redeemScript
        .writeOpCode(OpCode.OP_HASH160) // hash the htlc secret from the redeemScript
        .writeBuffer(outputObject.htlcSecret.hash) // push the hash of the htlc secret
        .writeOpCode(OpCode.OP_EQUAL) // check equality
        .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
      .writeOpCode(OpCode.OP_ELSE)
       .writeOpCode(OpCode.OP_IF)
          // channel sources' sig needed to spend, subject to CSV lock
          .writeBuffer(sourcePubKey.toBuffer())
          .writeOpCode(OpCode.OP_CHECKSIG)
          .writeBn(outputObject.csvDelay || Consts.CSV_DELAY)
          .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_ELSE)
          // channel sources' sig & channel dest's revocation secret needed to spend
          .writeBuffer(sourcePubKey.toBuffer())
          .writeOpCode(OpCode.OP_CHECKSIG)
          .writeOpCode(OpCode.OP_HASH160)
          .writeBuffer(outputObject.revocationSecret.hash)
          .writeOpCode(OpCode.OP_EQUAL)
          .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
        .writeOpCode(OpCode.OP_ENDIF)
      .writeOpCode(OpCode.OP_ENDIF)
  }

  fromJSON (json) {
    this.multisigAddress = this.multisigAddress ? new KeyPairAddress().fromJSON(json.multisigAddress) : undefined
    this.ownerDestinationAddress = json.ownerDestinationAddress ? new KeyPairAddress().fromJSON(json.ownerDestinationAddress) : undefined
    this.builderDestinationAddress = json.builderDestinationAddress ? new KeyPairAddress().fromJSON(json.builderDestinationAddress) : undefined
    if (json.outputList) {
      this.outputList = []
      for (let i in json.outputList) {
        this.outputList.push(new OutputDescription().fromJSON(json.outputList[i]))
      }
    }
    this.changeOutput = json.changeOutput ? new OutputDescription().fromJSON(json.changeOutput) : undefined
    this.ownerId = json.ownerId
    this.builderId = json.builderId
    this.txb = json.txb ? new TxBuilder().fromJSON(json.txb) : undefined
    return this
  }

  toPublic () {
    let commitmentTxObj = new CommitmentTxObj().fromObject()
    commitmentTxObj.multisigAddress = this.multisigAddress ? this.multisigAddress.toPublic() : undefined
    commitmentTxObj.ownerDestinationAddress = this.ownerDestinationAddress ? this.ownerDestinationAddress.toPublic() : undefined
    commitmentTxObj.builderDestinationAddress = this.builderDestinationAddress ? this.builderDestinationAddress.toPublic() : undefined
    if (this.outputList) {
      commitmentTxObj.outputList = []
      for (let i in this.outputList) {
        commitmentTxObj.outputList.push(this.outputList[i].toPublic())
      }
    }
    commitmentTxObj.changeOutput = this.changeOutput ? this.changeOutput.toPublic() : undefined
    commitmentTxObj.ownerId = this.ownerId
    commitmentTxObj.builderId = this.builderId
    commitmentTxObj.txb = this.txb
    return commitmentTxObj
  }
}

module.exports = CommitmentTxObj
