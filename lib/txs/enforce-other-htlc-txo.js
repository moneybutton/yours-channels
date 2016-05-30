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
    return asink(function *() {
      return yield this.asyncBuildTxo(destination, commitmentTxo.txb.tx,
        Scripts.enforceFromRhtlc(), commitmentTxo.rhtlcRedeemScript,
        0, commitmentTxo.rhtlcOutNum)
    }, this)
  }
}

module.exports = EnforceOtherHtlcTxo
