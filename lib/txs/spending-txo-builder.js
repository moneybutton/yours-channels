'use strict'
let asink = require('asink')
let Scripts = require('./scripts.js')
let Struct = require('yours-bitcoin/lib/struct')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Sig = require('yours-bitcoin/lib/sig')

class SpendingTxoBuilder extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
  * Used to build destination transactions in which spend from non-standard outputs
  * like htlc or rhtlc. Conveniance function that all destination transactions call
  */
  asyncBuildTxo (destination, commitmentTx, partialScriptSig, redeemScript, sigPos, txoutnum) {
    return asink(function *() {
      let txhashbuf = commitmentTx.hash()
      let txout = commitmentTx.txOuts[txoutnum]
      let txseqnum = 100

      this.txb = new TxBuilder()
      this.txb.setVersion(2)

      // build the input script
      let scriptSig = Scripts.toP2shInput(partialScriptSig, redeemScript)

      this.txb.inputFromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      this.txb.setChangeAddress(destination.address)
      this.txb.build()

      // sign the input script
      let subScript = commitmentTx.txOuts[txoutnum].script
      let sig = this.txb.getSig(destination.keyPair, Sig.SIGHASH_ALL, 0, subScript)
      scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
      this.txb.tx.txIns[0].setScript(scriptSig)
    }, this)
  }
}

module.exports = SpendingTxoBuilder
