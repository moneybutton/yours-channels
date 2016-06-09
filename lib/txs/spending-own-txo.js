'use strict'
let asink = require('asink')
let Scripts = require('./scripts')
let SpendingTxoBuilder = require('./spending-txo-builder')

class DestinationOwnTxo extends SpendingTxoBuilder {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Used if the agent himself published the commitment transaction.
   * Requires payee to present their htlc secret.
   * Spends from the first branch of the rhtlc script
   */
  asyncBuild (commitmentTxo, destination) {
    return asink(function * () {
      return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
        Scripts.spendFromRhtlc(commitmentTxo.htlcSecret), commitmentTxo.rhtlcRedeemScript,
        1, commitmentTxo.rhtlcOutNum)
    }, this)
  }
}

module.exports = DestinationOwnTxo
