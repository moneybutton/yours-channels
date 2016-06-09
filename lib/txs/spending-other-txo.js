'use strict'
let asink = require('asink')
let Scripts = require('./scripts')
let SpendingTxoBuilder = require('./spending-txo-builder')

class DestinationOtherTxo extends SpendingTxoBuilder {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Used if the other agent published the commitment transaction.
   * Requires payee to present their htlc secret.
   * Spends from the first branch of the htlc script
   */
  asyncBuild (commitmentTxo, destination) {
    return asink(function *() {
      return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
          Scripts.spendFromHtlc(commitmentTxo.htlcSecret),
          commitmentTxo.htlcRedeemScript, 1, commitmentTxo.htlcOutNum)
    }, this)
  }
}

module.exports = DestinationOtherTxo
