'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Script = require('yours-bitcoin/lib/script')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Sig = require('yours-bitcoin/lib/sig')
let Hash = require('yours-bitcoin/lib/hash')
let Scripts = require('../scripts.js')

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

      let inputPubKey = destination.keyPair.pubKey.toString('hex')

      // sign the input script
      let subScript = commitmentTx.txOuts[txoutnum].script
      let sig = this.txb.getSig(destination.keyPair, Sig.SIGHASH_ALL, 0, subScript)
      scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
      this.txb.tx.txIns[0].setScript(scriptSig)
/*
      console.log('\tinput script signed with pubKey', inputPubKey)
      console.log()
      console.log('\tinput script:', scriptSig.toString());

      console.log();
      console.log('\toutput script:', subScript.toString());

      redeemScript = Script.fromBuffer(scriptSig.chunks[1].buf)
      let redeemScriptHash = yield Hash.asyncSha256Ripemd160(redeemScript.toBuffer())

      console.log();
      console.log('\tredeem script:', redeemScript.toString());

      console.log();
      console.log('\tredeem script hash:', redeemScriptHash.toString('hex'));
      console.log();
*/
    }, this)
  }
}

module.exports = SpendingTxoBuilder
