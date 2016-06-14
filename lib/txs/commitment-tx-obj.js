'use strict'
let asink = require('asink')
let TxObj = require('./tx-obj')
let KeyPairAddress = require('../addrs/key-pair-address')
let OutputDescription = require('../output-description')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let Bn = require('yours-bitcoin/lib/bn')

class CommitmentTxObj extends TxObj {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncBuild () {
    return asink(function * () {
      if (!this.multisigAddress ||
        !this.fundingTxObj ||
        !this.ownerDestinationAddress ||
        !this.builderDestinationAddress ||
        !this.outputList ||
        !this.changeOutput ||
        !this.ownerId ||
        !this.builderId) {
        throw new Error('CommitmentTxObj not sufficiently initialized')
      }

      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(this.fundingTxObj.txb.tx.hash(), 0, this.fundingTxObj.txb.tx.txOuts[0], this.multisigAddress.script)
      for (let i = 0; i < this.outputList.length; i++) {
        // build output scripts
        Object.assign(this.outputList[i], this.buildRedeemScript(this.outputList[i]))
        this.outputList[i].scriptPubkey = yield this.asyncToP2shOutput(this.outputList[i].redeemScript)
        this.txb.outputToScript(this.outputList[i].amount, this.outputList[i].scriptPubkey)
      }
      // build change script
      this.change = {}
      Object.assign(this.change, this.buildRedeemScript(this.changeOutput))
      this.change.scriptPubkey = yield this.asyncToP2shOutput(this.change.redeemScript)
      this.txb.setChangeScript(this.change.scriptPubkey)

      this.txb.build()
      yield this.txb.asyncSign(0, this.multisigAddress.keyPair, this.fundingTxObj.txb.tx.txOuts[0])
    }, this)
  }

  buildRedeemScript (outputObject) {
    if (outputObject.intermediateDestId === this.builderId) {
      return {
        revocable: false,
        kind: 'htlc',
        redeemScript: this.htlcOutputScript(
          this.ownerDestinationAddress.keyPair.pubKey,
          this.builderDestinationAddress.keyPair.pubKey,
          outputObject.htlcSecret)
      }
    // the output to an owner should be revocable, thus a RHTCL
    } if (outputObject.intermediateDestId === this.ownerId) {
      return {
        revocable: true,
        kind: 'htlc',
        redeemScript: this.revHtlcOutputScript(
          this.ownerDestinationAddress.keyPair.pubKey,
          this.builderDestinationAddress.keyPair.pubKey,
          outputObject.htlcSecret,
          outputObject.revocationSecret)
      }
    } else {
      throw new Error('invalid id in CommitmentTxObj.asyncBuild')
    }
  }

  pubkeyOutputScript (ownerPubKey) {
    if (!ownerPubKey) {
      throw new Error('Insuficient arguments for pubkey')
    }
    let script = new Script()
        .writeBuffer(ownerPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
    return script
  }

  revPubkeyOutputScript (ownerPubKey, builderPubKey, ownerRevocationSecret) {
    if (!ownerPubKey || !ownerRevocationSecret) {
      throw new Error('Insuficient arguments for revPubkey')
    }
    let script = new Script()
      .writeOpCode(OpCode.OP_IF)
        .writeBuffer(ownerPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
      .writeOpCode(OpCode.OP_ELSE)
        // builder sig & owner's revocation secret needed to spend
        .writeBuffer(builderPubKey.toBuffer())
        .writeOpCode(OpCode.OP_CHECKSIG)
        .writeOpCode(OpCode.OP_HASH160)
        .writeBuffer(ownerRevocationSecret.hash)
        .writeOpCode(OpCode.OP_EQUAL)
        .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
      .writeOpCode(OpCode.OP_ENDIF)
    return script
  }

  /*
   * Constructs a HTLC where agent can get a payment if she knows the secret
   */
  htlcOutputScript (ownerPubKey, builderPubKey, htlcSecret) {
    if (!ownerPubKey || !builderPubKey || !htlcSecret) {
      throw new Error('Insuficient arguments for htlcOutputScript')
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
  revHtlcOutputScript (ownerPubKey, builderPubKey, ownerHtlcSecret, ownerRevocationSecret) {
    if (!ownerPubKey || !builderPubKey || !ownerHtlcSecret || !ownerRevocationSecret) {
      throw new Error('Insuficient arguments for revHtlcOutputScript')
    }

    let script = new Script()
      .writeOpCode(OpCode.OP_IF)
        // owner's sig & otherAgent's HTLC secret needed to spend
        .writeBuffer(ownerPubKey.toBuffer()) // push the other agent's pubKey
        .writeOpCode(OpCode.OP_CHECKSIG) // check the signature in the redeemScript
        .writeOpCode(OpCode.OP_HASH160) // hash the htlc secret from the redeemScript
        .writeBuffer(ownerHtlcSecret.hash) // push the hash of the htlc secret
        .writeOpCode(OpCode.OP_EQUAL) // check equality
        .writeOpCode(OpCode.OP_DROP) // remove boolean from stack
      .writeOpCode(OpCode.OP_ELSE)
       .writeOpCode(OpCode.OP_IF)
          // builder's sig needed to spend, subject to CSV lock
          .writeBuffer(builderPubKey.toBuffer())
          .writeOpCode(OpCode.OP_CHECKSIG)
          .writeBn(Bn(100))
          .writeOpCode(OpCode.OP_CHECKSEQUENCEVERIFY)
        .writeOpCode(OpCode.OP_ELSE)
          // builder sig & owner's revocation secret needed to spend
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
    commitmentTxObj.txb = this.txb // TODO implement toPublic of txb
    return commitmentTxObj
  }
}

module.exports = CommitmentTxObj
