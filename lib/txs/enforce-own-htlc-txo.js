'use strict'
let asink = require('asink')
let Scripts = require('./scripts.js')
let SpendingTxoBuilder = require('./spending-txo-builder.js')

class EnforceOwnHtlcTxo extends SpendingTxoBuilder {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Used if agent publishes a commitment transaction and the other agent does
   * not publish the htlc secret in time by destination from the commitment tx.
   * Spends from the second branch of the htlc script
   */
  asyncBuild (commitmentTxo, destination) {
    return asink(function *() {
      return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
        Scripts.enforceFromHtlc(), commitmentTxo.htlcRedeemScript,
        0, commitmentTxo.htlcOutNum)
    }, this)
  }
}

module.exports = EnforceOwnHtlcTxo
