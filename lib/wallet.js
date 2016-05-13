'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let Txout = require('yours-bitcoin/lib/tx-out')
let Address = require('yours-bitcoin/lib/address')

class Wallet extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  /*
   * just a mockup at this point
   */
  getUnspentOutput (amount, pubkey) {
    // from line 444 scritp-examples.js
    let inputTxAddress = Address.fromPubKey(pubkey)
    let scriptPubkey = inputTxAddress.toScript()
    let inputTxHashbuf = new Buffer(32)
    inputTxHashbuf.fill(0) // a fake, non-existent input transaction
    let inputTxoutnum = 0
    let inputTxout = new Txout(amount).setScript(scriptPubkey)

    return {
      inputTxout: new Txout(amount).setScript(inputTxAddress.toScript()),
      txhashbuf: inputTxHashbuf,
      txoutnum: inputTxoutnum,
      txout: inputTxout,
      pubKey: pubkey
    }
  }
}

module.exports = Wallet
