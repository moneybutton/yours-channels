'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

let Scripts = require('../scripts.js')

class FundingTxo extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncInitialize (amount, funding, multisig, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
    return asink(function *() {
      if (!amount || !funding || !multisig || !inputTxHashbuf ||
          typeof inputTxoutnum !== 'number' || !inputTxout || !pubKey) {
        throw new Error('Insuficient arguments for FundingTxo.asyncInitialize')
      }

      this.amount = amount
      this.txb = new TxBuilder()
      this.txb.inputFromPubKeyHash(inputTxHashbuf, inputTxoutnum, inputTxout, pubKey)
      this.txb.setChangeAddress(funding.address)
      this.txb.outputToAddress(amount, multisig.address)
      this.txb.build()
      this.txb.sign(0, funding.keyPair, inputTxout)
    }, this)
  }

  toJson() {
    return {
      amount: this.amount.toJson(),
      txb: this.txb.toJson()
    }
  }

  fromJson (json) {
    this.fromObject({
      amount: json.amount,
      txb: new TxBuilder().fromJson(json.txb)
    })
    return this
  }

  asyncToPublic () {
    return asink(function *() {
      let fundingTxo = new FundingTxo()
      let hash = yield this.txb.tx.asyncHash()
      fundingTxo.amount = this.amount
      fundingTxo.txb = new TxBuilder()
      fundingTxo.txb.tx.txOuts = this.txb.tx.txOuts
      fundingTxo.txb.tx.hash = () => hash
      return fundingTxo
    }, this)
  }

}

module.exports = FundingTxo
