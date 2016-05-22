'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

let SpendingTxoBuilder = require('./spending-txo-builder.js')

let Scripts = require('../scripts.js')

class EnforceOwnHtlcTxo extends SpendingTxoBuilder {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Used if agent publishes a commitment transaction and the other agent does
   * not publish the htlc secret in time by spending from the commitment tx.
   * Spends from the second branch of the htlc script
   */
  asyncBuild (commitmentTxo, spending) {
    return asink(function *() {
      return yield this.asyncBuildTxo(spending, commitmentTxo.txb.tx,
        Scripts.enforceFromHtlc(), commitmentTxo.htlcRedeemScript,
        0, commitmentTxo.htlcOutNum)
    }, this)
  }
}

module.exports = EnforceOwnHtlcTxo
