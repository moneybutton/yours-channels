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

  asyncInitialize (amount, amountToOther, fundingTxo, multisig, spending, otherSpending, htlcSecret, otherHtlcSecret, otherRevocationSecret, funder) {
    return asink(function *() {

      if (!amount || !amountToOther || !fundingTxo || !multisig || !spending || !otherSpending || !htlcSecret || !otherHtlcSecret || !otherRevocationSecret) {
        throw new Error('Insuficient arguments for CommitmentTxo.asyncInitialize')
      }

      // as the other guy will store this trasnaction, we store .. as follows:
      this.htlcSecret = otherHtlcSecret
      this.otherHtlcSecret = htlcSecret
      this.revocationSecret = otherRevocationSecret

      this.htlcRedeemScript = Scripts.htlc(spending.keyPair.pubKey, otherSpending.keyPair.pubKey, htlcSecret)
      this.htlcScriptPubkey = yield Scripts.asyncToP2shOutput(this.htlcRedeemScript)

      this.rhtlcRedeemScript = Scripts.rhtlc(spending.keyPair.pubKey, otherSpending.keyPair.pubKey, otherHtlcSecret, otherRevocationSecret)
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

  toJson () {
    return {
      txb: this.txb.toJson(),
      htlcSecret: this.htlcSecret.toJson(),
      otherHtlcSecret: this.otherHtlcSecret.toJson(),
      revocationSecret: this.revocationSecret.toJson(),
      htlcOutNum: this.htlcOutNum,
      rhtlcOutNum: this.rhtlcOutNum,
      htlcRedeemScript: this.htlcRedeemScript.toJson(),
      rhtlcRedeemScript: this.rhtlcRedeemScript.toJson(),
      htlcScriptPubkey: this.htlcScriptPubkey.toFastHex(),
      rhtlcScriptPubkey: this.rhtlcScriptPubkey.toFastHex(),
    }
  }

  fromJson (json) {
    this.txb = new TxBuilder().fromJson(json.txb)
    this.htlcSecret = new Secret().fromJson(json.htlcSecret)
    this.otherHtlcSecret = new Secret().fromJson(json.otherHtlcSecret)
    this.revocationSecret = new Secret().fromJson(json.revocationSecret)
    this.htlcOutNum = json.htlcOutNum
    this.rhtlcOutNum = json.rhtlcOutNum
    this.htlcRedeemScript = json.htlcRedeemScript
    this.rhtlcRedeemScript = json.rhtlcRedeemScript
    this.htlcScriptPubkey = json.htlcScriptPubkey
    this.rhtlcScriptPubkey = json.rhtlcScriptPubkey
    return this
  }

  toPublic () {
    let commitmentTxo = new CommitmentTxo().fromObject(this)
    commitmentTxo.htlcSecret = this.htlcSecret.toPublic()
    commitmentTxo.otherHtlcSecret = this.otherHtlcSecret.toPublic()
    commitmentTxo.revocationSecret = this.revocationSecret.toPublic()
    return commitmentTxo
  }
}

module.exports = CommitmentTxo
