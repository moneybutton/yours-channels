'use strict'
let asink = require('asink')
let Tx = require('./tx')
let Output = require('../output')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Address = require('yours-bitcoin/lib/address')
let Bn = require('yours-bitcoin/lib/bn')
let Consts = require('../consts.js')

class Commitment extends Tx {
  constructor (outputs, txb) {
    super({outputs, txb})
  }

  asyncBuild (fundingTxHash, fundingTxOut, multisigAddress, builderId, xPubs) {
    return asink(function * () {
      if (!this.outputs) {
        throw new Error('Commitment not sufficiently initialized')
      }

      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(fundingTxHash, 0, fundingTxOut, multisigAddress.script)
      for (let i = 0; i < this.outputs.length; i++) {
        // build output scripts
        this.outputs[i].revocable = this.outputs[i].channelDestId !== builderId
        this.outputs[i].redeemScript = this.buildRedeemScript(this.outputs[i], builderId, xPubs)
        this.outputs[i].scriptPubkey = Address.fromRedeemScript(this.outputs[i].redeemScript).toScript()
        // this.outputs[i].scriptPubkey = yield this.asyncToP2shOutput(this.outputs[i].redeemScript)
        if (i < this.outputs.length - 1) {
          this.txb.outputToScript(this.outputs[i].amount, this.outputs[i].scriptPubkey)
        } else {
          this.txb.setChangeScript(this.outputs[i].scriptPubkey)
        }
      }

      this.txb.build()
      yield this.txb.asyncSign(0, multisigAddress.keyPair, fundingTxOut)
      return this
    }, this)
  }

  buildRedeemScript (outputObject, builderId, xPubs) {
    if (outputObject.kind === undefined) {
      throw new Error('Insufficient arguments for buildRedeemScript')
    }

    let sourcePath = outputObject.channelSourcePath
    let sourceBip = xPubs[outputObject.channelSourceId]
    let sourcePubKey = sourceBip.derive(sourcePath).pubKey // TODO: asyncDerive

    let destPath = outputObject.channelDestPath
    let destBip = xPubs[outputObject.channelDestId]
    let destPubKey = destBip.derive(destPath).pubKey // TODO: asyncDerive

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
      throw new Error('invalid kind in Commitment.asyncBuild')
    }
  }

  pubKeyRedeemScript (destPubKey) {
    // output to channel dest
    return new Script()
      .writeBuffer(destPubKey.toBuffer())
      .writeOpCode(OpCode.OP_CHECKSIG)
  }

  // all checks but the last should be ...VERIFY
  revPubKeyRedeemScript (destPubKey, sourcePubKey, outputObject) {
    return new Script()
      .writeOpCode(OpCode.OP_IF)
        // output to channel dest
        // encumbered by a CSV_DELAY CSV time lock
        // time lock is needed to allow channel source to spend via branch 2
        // should the tx be revoked
        .writeBuffer(destPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(outputObject.csvDelay || Consts.CSV_DELAY)
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_DROP)
      .writeOpCode(OpCode.OP_ELSE)
        // output to channel source
        // sourcePubKey & owner's revocation secret needed to spend
        // this branch is used if a revoked commitment tx has been broadcast
        .writeBuffer(sourcePubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(outputObject.revSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
  }

  htlcRedeemScript (destPubKey, sourcePubKey, outputObject) {
    let script = new Script()
      .writeOpCode(OpCode.OP_IF)
        // output to channel dest
        // channel dest's sig & and network dest's HTLC secret needed to spend
        // this branch can be spent if chanel dest has the htlc secret
        .writeBuffer(destPubKey.toBuffer()) // push the agent's pubKey
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY) // check sig against redeem script
        .writeOpCode(OpCode.OP_HASH160) // hash htlc secret from redeem script
        .writeBuffer(outputObject.htlcSecret.hash) // push htlc secret hash of the htlc secret
        .writeOpCode(OpCode.OP_EQUAL) // check equality
      .writeOpCode(OpCode.OP_ELSE)
        // output to channel source
        // channel source's sig needed to spend, subject to SVC lock
        // this branch can be spent if channel dest does not reveil the htlc secret in time
        .writeBuffer(sourcePubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(outputObject.csvDelay || Consts.CSV_DELAY)
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_DROP)
      .writeOpCode(OpCode.OP_ENDIF)
    return script
  }

  revHtlcRedeemScript (destPubKey, sourcePubKey, outputObject) {
    let longDelay = outputObject.csvDelay || Consts.CSV_DELAY
    let shortDelay = longDelay.div(Bn(2))
    return new Script()
      .writeOpCode(OpCode.OP_IF)
        // output to channel dest
        // channel dest's sig & and network dest's HTLC secret needed to spend
        // this branch can be spent if chanel dest has the htlc secret
        // corresponds to the first branch of the htlc script
        // must be encumbered by a time lock to allow channel source to spend if tx was revoked
        .writeBuffer(destPubKey.toBuffer()) // check pubkey
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
        .writeOpCode(OpCode.OP_HASH160) // check htlc secret
        .writeBuffer(outputObject.htlcSecret.hash)
        .writeOpCode(OpCode.OP_EQUALVERIFY)
        .writeBn(shortDelay) // check time lock
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
      .writeOpCode(OpCode.OP_ELSE)
       .writeOpCode(OpCode.OP_IF)
         // output to channel source
         // channel source's sig needed to spend, subject to SVC lock
         // this branch can be spent if channel dest does not reveil the htlc secret in time
         // corresponds to second branch of htlc script
        .writeBuffer(sourcePubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeBn(longDelay)
        .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_DROP)
      .writeOpCode(OpCode.OP_ELSE)
        // output to channel source
        // sourcePubKey & owner's revocation secret needed to spend
        // this branch is used if a revoked commitment tx has been broadcast
        // this corresponds to second branch of rev pubKey script
        .writeBuffer(sourcePubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIGVERIFY)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(outputObject.revSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
    .writeOpCode(OpCode.OP_ENDIF)
  }

  fromJSON (json) {
    if (json.outputs) {
      this.outputs = []
      for (let i in json.outputs) {
        this.outputs.push(new Output().fromJSON(json.outputs[i]))
      }
    }
    this.txb = json.txb ? new TxBuilder().fromJSON(json.txb) : undefined
    return this
  }

  toPublic () {
    let commitment = new Commitment().fromObject()
    if (this.outputs) {
      commitment.outputs = []
      for (let i in this.outputs) {
        commitment.outputs.push(this.outputs[i].toPublic())
      }
    }
    commitment.txb = this.txb
    return commitment
  }
}

module.exports = Commitment
