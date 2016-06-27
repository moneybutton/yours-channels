'use strict'
let asink = require('asink')
let TxObj = require('./tx-obj')
let OutputDescription = require('../output-description')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Address = require('yours-bitcoin/lib/address')
let Bn = require('yours-bitcoin/lib/bn')
let Consts = require('../consts.js')

class Commitment extends TxObj {
  constructor (outputList, txb) {
    super({outputList, txb})
  }

  asyncBuild (fundingTx, multisigAddress, builderId, xPubs) {
    return asink(function * () {
      if (!this.outputList) {
        throw new Error('Commitment not sufficiently initialized')
      }

      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(yield fundingTx.asyncHash(), 0, fundingTx.txOuts[0], multisigAddress.script)
      for (let i = 0; i < this.outputList.length; i++) {
        // build output scripts
        this.outputList[i].revocable = this.outputList[i].channelDestId !== builderId
        this.outputList[i].redeemScript = this.buildRedeemScript(this.outputList[i], builderId, xPubs)
        this.outputList[i].scriptPubkey = Address.fromRedeemScript(this.outputList[i].redeemScript).toScript()
        // this.outputList[i].scriptPubkey = yield this.asyncToP2shOutput(this.outputList[i].redeemScript)
        if (i < this.outputList.length - 1) {
          this.txb.outputToScript(this.outputList[i].amount, this.outputList[i].scriptPubkey)
        } else {
          this.txb.setChangeScript(this.outputList[i].scriptPubkey)
        }
      }

      this.txb.build()
      yield this.txb.asyncSign(0, multisigAddress.keyPair, fundingTx.txOuts[0])
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
        .writeBuffer(outputObject.revocationSecret.hash)
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
        .writeBuffer(outputObject.revocationSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
      .writeOpCode(OpCode.OP_ENDIF)
    .writeOpCode(OpCode.OP_ENDIF)
  }

  fromJSON (json) {
    if (json.outputList) {
      this.outputList = []
      for (let i in json.outputList) {
        this.outputList.push(new OutputDescription().fromJSON(json.outputList[i]))
      }
    }
    this.txb = json.txb ? new TxBuilder().fromJSON(json.txb) : undefined
    return this
  }

  toPublic () {
    let commitment = new Commitment().fromObject()
    if (this.outputList) {
      commitment.outputList = []
      for (let i in this.outputList) {
        commitment.outputList.push(this.outputList[i].toPublic())
      }
    }
    commitment.txb = this.txb
    return commitment
  }
}

module.exports = Commitment
