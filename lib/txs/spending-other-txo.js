'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Scripts = require('./scripts.js')
let SpendingTxoBuilder = require('./spending-txo-builder.js')

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
