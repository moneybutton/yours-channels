'use strict'
let asink = require('asink')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Tx = require('./tx')

class Funding extends Tx {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncInitialize (amount, sourceAddress, multisigAddress, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
    return asink(function * () {
      if (!amount || !sourceAddress || !multisigAddress || !inputTxHashbuf ||
          typeof inputTxoutnum !== 'number' || !inputTxout || !pubKey) {
        throw new Error('Insufficient arguments for Funding.asyncInitialize')
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
    return asink(function * () {
      let funding = new Funding()
      let hash = yield this.txb.tx.asyncHash()
      funding.amount = this.amount
      funding.txb = new TxBuilder()
      funding.txb.tx.txOuts = this.txb.tx.txOuts
      funding.txb.tx.hash = () => hash
      return funding
    }, this)
  }

}

module.exports = Funding
