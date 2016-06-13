'use strict'
let asink = require('asink')
let Scripts = require('./scripts')
let SpendingTxoBuilder = require('./spending-txo-builder')

class EnforceOtherHtlcTxo extends SpendingTxoBuilder {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Used if the other agent publishes a commitment transaction and does
   * not publish the htlc secret in time by destination from the commitment tx.
   * Spends from the second branch of the rhtlc script
   */
  asyncBuild (commitmentTxo, destination) {
    return asink(function * () {
      return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
        Scripts.enforceFromRhtlc(), commitmentTxo.rhtlcRedeemScript,
        0, commitmentTxo.rhtlcOutNum)
    }, this)
  }
}

module.exports = EnforceOtherHtlcTxo
