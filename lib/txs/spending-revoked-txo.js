'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Scripts = require('../scripts.js')
let SpendingTxoBuilder = require('./spending-txo-builder.js')

class SpendingRevokedTxo extends SpendingTxoBuilder {
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
  asyncBuild (commitmentTxo, spending) {
    return asink(function *() {
      return yield this.asyncBuildTxo(spending, commitmentTxo.txb.tx,
        Scripts.revokeRhtlc(commitmentTxo.revocationSecret), commitmentTxo.rhtlcRedeemScript,
        1, commitmentTxo.rhtlcOutNum)
    }, this)
  }
}

module.exports = SpendingRevokedTxo
