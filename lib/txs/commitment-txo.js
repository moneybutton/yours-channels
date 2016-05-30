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
let TxOutMap = require('yours-bitcoin/lib/tx-out-map')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')

let Scripts = require('./scripts.js')

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
   * Checks if a commitment transaction obtained from the other agent is built
   * and signed correctly.
   * TODO: check redeemScripts
   * TODO: check that outputs are spendale
   */
  asyncCheckCommitmentTxo (newCommitmentTxo, fundingTxo, multisig) {
    return asink(function *() {
      yield newCommitmentTxo.txb.asyncSign(0, multisig.keyPair, fundingTxo.txb.tx.txOuts[0])

      // check that there is only one input
      if (newCommitmentTxo.txb.tx.txIns.length !== 1) {
        throw new Error('Commitment transaction can only have one input')
      }

      // check that txOutNum == 0
      if (newCommitmentTxo.txb.tx.txIns[0].txOutNum !== 0) {
        throw new Error('Commitment transaction spends from non-existing output')
      }

      // check that the right htlc secret has been used
      if (newCommitmentTxo.htlcSecret.hash.toString('hex') !== this.htlcSecret.hash.toString('hex')) {
        throw new Error('Invalid htlc secret')
      }

      // check that the right revocation secret has been used
      if (newCommitmentTxo.revocationSecret.hash.toString('hex') !== this.revocationSecret.hash.toString('hex')) {
        throw new Error('Invalid revocation secret')
      }

      // check that the commitment transaction spends from the source transaction
      let fundingTxHash = fundingTxo.txb.tx.hash().toString('hex')
      let commitmentTxInputHash = newCommitmentTxo.txb.tx.txIns[0].txHashBuf.toString('hex')
      if (fundingTxHash !== commitmentTxInputHash) {
        throw new Error('Commitment transaction does not spend from source transaction')
      }

      // verify commitment transaction against the source transaction
      let txOutMap = new TxOutMap()
      txOutMap.addTx(fundingTxo.txb.tx)
      let txVerifier = new TxVerifier(newCommitmentTxo.txb.tx, txOutMap)
      let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
      if (error) {
        throw new Error('Commitment transaction does not spend from the source transaction')
      }

      // if no error was thrown, we return true
      return true
    }, this)
  }

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
