'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

class FundingTxo extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncInitialize (amount, source, multisig, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
    return asink(function * () {
      if (!amount || !source || !multisig || !inputTxHashbuf ||
          typeof inputTxoutnum !== 'number' || !inputTxout || !pubKey) {
        throw new Error('Insufficient arguments for FundingTxo.asyncInitialize')
      }

      this.amount = amount
      this.txb = new TxBuilder()
      this.txb.inputFromPubKeyHash(inputTxHashbuf, inputTxoutnum, inputTxout, pubKey)
      this.txb.setChangeAddress(source.address)
      this.txb.outputToAddress(amount, multisig.address)
      this.txb.build()
      this.txb.sign(0, source.keyPair, inputTxout)
    }, this)
  }
/*
  toJSON() {
    return {
      amount: this.amount.toJSON(),
      txb: this.txb.toJSON()
    }
  }
*/
  fromJSON (json) {
    this.fromObject({
      amount: json.amount,
      txb: new TxBuilder().fromJSON(json.txb)
    })
    return this
  }

  asyncToPublic () {
    return asink(function * () {
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
