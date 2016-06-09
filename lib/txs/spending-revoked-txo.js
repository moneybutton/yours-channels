'use strict'
let asink = require('asink')
let Scripts = require('./scripts')
let SpendingTxoBuilder = require('./spending-txo-builder')

class DestinationRevokedTxo extends SpendingTxoBuilder {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Used if the other agent publishes an old commitment transaction.
   * Requires payee to present the respective revocation secret.
   * Spends from the third branch of the rhtlc script
   */
  asyncBuild (commitmentTxo, destination) {
    return asink(function * () {
      return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
        Scripts.revokeRhtlc(commitmentTxo.revocationSecret), commitmentTxo.rhtlcRedeemScript,
        1, commitmentTxo.rhtlcOutNum)
    }, this)
  }
}

module.exports = DestinationRevokedTxo
