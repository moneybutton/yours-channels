'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Secret = require('../../lib/secret.js')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

let Scripts = require('../scripts.js')

class CommitmentTxo extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  initializeSecrets (htlcSecret, revocationSecret) {
    this.htlcSecret = htlcSecret
    this.revocationSecret = revocationSecret
  }

  initializeOtherSecrets (otherHtlcSecret, otherRevocationSecret) {
    this.otherHtlcSecret = otherHtlcSecret
    this.otherRevocationSecret = otherRevocationSecret
  }

  asyncInitialize (amount, amountToOther, fundingTxo, multisig, destination, otherDestination, funder) {
    return asink(function *() {

      if (!amount || !amountToOther || !fundingTxo || !multisig || !destination || !otherDestination) {
        throw new Error('Insuficient arguments for CommitmentTxo.asyncInitialize')
      }

      this.htlcRedeemScript = Scripts.htlc(destination.keyPair.pubKey, otherDestination.keyPair.pubKey, this.otherHtlcSecret)
      this.htlcScriptPubkey = yield Scripts.asyncToP2shOutput(this.htlcRedeemScript)

      this.rhtlcRedeemScript = Scripts.rhtlc(destination.keyPair.pubKey, otherDestination.keyPair.pubKey, this.htlcSecret, this.revocationSecret)
      this.rhtlcScriptPubkey = yield Scripts.asyncToP2shOutput(this.rhtlcRedeemScript)

      this.txb = new TxBuilder()
      this.txb.inputFromScriptHashMultiSig(fundingTxo.txb.tx.hash(), 0, fundingTxo.txb.tx.txOuts[0], multisig.script)
      // funder pays the transaction fee
      // note that the changeScript will always be on the last output
      let htlcOutNum, rhtlcOutNum
      if (funder) {
        this.txb.outputToScript(amountToOther, this.rhtlcScriptPubkey)
        this.txb.setChangeScript(this.htlcScriptPubkey)
        this.htlcOutNum = 1
        this.rhtlcOutNum = 0
      } else {
        this.txb.outputToScript(amount, this.htlcScriptPubkey)
        this.txb.setChangeScript(this.rhtlcScriptPubkey)
        this.htlcOutNum = 0
        this.rhtlcOutNum = 1
      }
      this.txb.build()
      yield this.txb.asyncSign(0, multisig.keyPair, fundingTxo.txb.tx.txOuts[0])
    }, this)
  }
/*
  toJSON () {
    return JSON.stringify(this)
  }
*/
  fromJSON (json) {
    if (json.txb) {
      this.txb = new TxBuilder().fromJSON(json.txb)
    }
    if (json.htlcSecret) {
      this.htlcSecret = new Secret().fromJSON(json.htlcSecret)
    }
    if (json.otherHtlcSecret) {
      this.otherHtlcSecret = new Secret().fromJSON(json.otherHtlcSecret)
    }
    if (json.revocationSecret) {
      this.revocationSecret = new Secret().fromJSON(json.revocationSecret)
    }
    if (typeof json.htlcOutNum !== 'undefined') {
      this.htlcOutNum = json.htlcOutNum
    }
    if (typeof json.rhtlcOutNum !== 'undefined') {
      this.rhtlcOutNum = json.rhtlcOutNum
    }
    if (json.htlcRedeemScript) {
      this.htlcRedeemScript = json.htlcRedeemScript
    }
    if (json.rhtlcRedeemScript) {
      this.rhtlcRedeemScript = json.rhtlcRedeemScript
    }
    if (json.htlcScriptPubkey) {
      this.htlcScriptPubkey = json.htlcScriptPubkey
    }
    if (json.rhtlcScriptPubkey) {
      this.rhtlcScriptPubkey = json.rhtlcScriptPubkey
    }
    return this
  }

  toPublic () {
    let commitmentTxo = new CommitmentTxo().fromObject(this)
    if (this.htlcSecret) {
      commitmentTxo.htlcSecret = this.htlcSecret.toPublic()
    }
    if (this.otherHtlcSecret) {
      commitmentTxo.otherHtlcSecret = this.otherHtlcSecret.toPublic()
    }
    if (this.revocationSecret) {
      commitmentTxo.revocationSecret = this.revocationSecret.toPublic()
    }
    return commitmentTxo
  }
}

module.exports = CommitmentTxo
