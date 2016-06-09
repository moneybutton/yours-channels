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
        !this.ownerDesitinationAddress ||
        !this.builderDestinationAddress ||
        !this.outputList ||
        !this.changeOutput ||
        !this.ownerId ||
        !this.builderId) {
        throw new Error('CommitmentTxObj not sufficiently initialized')
      }

      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(this.fundingTxObj.txb.tx.hash(), 0, this.fundingTxObj.txb.tx.txOuts[0], this.multisigAddress.script)

      let redeemScript, scriptPubkey
      for (let i = 0; i < this.outputList.length; i++) {
        // build output scripts
        redeemScript = this.buildRedeemScript(this.outputList[i])
        scriptPubkey = yield this.asyncToP2shOutput(redeemScript)
        this.txb.outputToScript(this.outputList[i].amount, scriptPubkey)
      }
      // build change script
      redeemScript = this.buildRedeemScript(this.changeOutput)
      this.txb.setChangeScript(redeemScript)

      this.txb.build()
      yield this.txb.asyncSign(0, this.multisigAddress.keyPair, this.fundingTxObj.txb.tx.txOuts[0])
    }, this)
  }

  buildRedeemScript (outputObject) {
    if (outputObject.intermediateDestId === this.builderId) {
      return this.htlcScript(
        this.ownerDesitinationAddress.keyPair.pubKey,
        this.builderDestinationAddress.keyPair.pubKey,
        outputObject.htlcSecret)
    // the output to an owner should be revocable, thus a RHTCL
    } if (outputObject.intermediateDestId === this.ownerId) {
      return this.rhtlcScript(
        this.ownerDesitinationAddress.keyPair.pubKey,
        this.builderDestinationAddress.keyPair.pubKey,
        outputObject.htlcSecret,
        outputObject.revocationSecret)
    } else {
      throw new Error('invalid id in CommitmentTxObj.asyncBuild')
    }
  }

  /*
   * Constructs a HTLC where agent can get a payment if she knows the secret
   */
  htlcScript (ownerPubKey, builderPubKey, htlcSecret) {
    if (!ownerPubKey || !builderPubKey || !htlcSecret) {
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
    if (!ownerPubKey || !builderPubKey || !ownerHtlcSecret || !ownerRevocationSecret) {
      throw new Error('Insuficient arguments for rhtlcScript')
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

  fromJSON (json) {
    if (json.multisigAddress) {
      this.multisigAddress = new KeyPairAddress().fromJSON(json.multisigAddress)
    }
    if (json.ownerDesitinationAddress) {
      this.ownerDesitinationAddress = new KeyPairAddress().fromJSON(json.ownerDesitinationAddress)
    }
    if (json.builderDestinationAddress) {
      this.builderDestinationAddress = new KeyPairAddress().fromJSON(json.builderDestinationAddress)
    }
    if (json.outputList) {
      this.outputList = []
      for (let output in json.outputList) {
        this.outputList.push(new OutputDescription().fromJSON(output))
      }
    }
    if (json.changeOutput) {
      this.changeOutput = new OutputDescription().fromJSON(json.changeOutput)
    }
    if (typeof json.ownerId !== 'undefined') {
      this.ownerId = json.ownerId
    }
    if (typeof json.builderId !== 'undefined') {
      this.builderId = json.builderId
    }
    if (json.txb) {
      this.txb = new TxBuilder().fromJSON(json.txb)
    }
    return this
  }

  toPublic () {
    let commitmentTxObj = new CommitmentTxObj().fromObject()
    if (this.multisigAddress) {
      commitmentTxObj.multisigAddress = this.multisigAddress.toPublic()
    }
    if (this.ownerDesitinationAddress) {
      commitmentTxObj.ownerDesitinationAddress = this.ownerDesitinationAddress.toPublic()
    }
    if (this.builderDestinationAddress) {
      commitmentTxObj.builderDestinationAddress = this.builderDestinationAddress.toPublic()
    }
    if (this.outputList) {
      commitmentTxObj.outputList = []
      for (let output in this.outputList) {
        commitmentTxObj.outputList.push(output.toPublic())
      }
    }
    if (this.changeOutput) {
      commitmentTxObj.changeOutput = this.changeOutput.toPublic()
    }
    if (typeof this.ownerId !== 'undefined') {
      commitmentTxObj.ownerId = this.ownerId
    }
    if (typeof this.builderId !== 'undefined') {
      commitmentTxObj.builderId = this.builderId
    }
    if (this.txb) {
      commitmentTxObj.txb = this.txb.toPublic()
    }
    return commitmentTxObj
  }
}

module.exports = CommitmentTxObj
