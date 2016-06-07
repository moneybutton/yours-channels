'use strict'
let asink = require('asink')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Txo = require('./txo.js')

class FundingTxo extends Txo {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncInitialize (amount, sourceAddress, multisigAddress, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
    return asink(function *() {
      if (!amount || !sourceAddress || !multisigAddress || !inputTxHashbuf ||
          typeof inputTxoutnum !== 'number' || !inputTxout || !pubKey) {
        throw new Error('Insuficient arguments for FundingTxo.asyncInitialize')
      }

      this.amount = amount
      this.txb = new TxBuilder()
      this.txb.inputFromPubKeyHash(inputTxHashbuf, inputTxoutnum, inputTxout, pubKey)
      this.txb.setChangeAddress(sourceAddress.address)
      this.txb.outputToAddress(amount, multisigAddress.address)
      this.txb.build()
      this.txb.sign(0, sourceAddress.keyPair, inputTxout)
    }, this)
  }

  fromJSON (json) {
    this.fromObject({
      amount: json.amount,
      txb: new TxBuilder().fromJSON(json.txb)
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
