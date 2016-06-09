'use strict'
// let asink = require('asink')
let TxObj = require('./tx-obj')

class SpendingTxObj extends TxObj {
  constructor () {
    super()
    this.fromObject({})
  }
}

module.exports = SpendingTxObj
