'use strict'
let Struct = require('fullnode/lib/struct')
let Txout = require('fullnode/lib/txout')
let Address = require('fullnode/lib/address')

function Wallet () {
  if (!(this instanceof Wallet)) {
    return new Wallet()
  }
  this.fromObject({})
}

Wallet.prototype = Object.create(Struct.prototype)
Wallet.prototype.constructor = Wallet

/*
 * just a mockup at this point
 */
Wallet.prototype.getUnspentOutput = function (amount, pubkey) {
  // from line 444 scritp-examples.js
  let inputTxAddress = Address().fromPubkey(pubkey)
  let scriptPubkey = inputTxAddress.toScript()
  let inputTxHashbuf = new Buffer(32)
  inputTxHashbuf.fill(0) // a fake, non-existent input transaction
  let inputTxoutnum = 0
  let inputTxout = Txout(amount).setScript(scriptPubkey)

  return {
    inputTxout: Txout(amount).setScript(inputTxAddress.toScript()),
    txhashbuf: inputTxHashbuf,
    txoutnum: inputTxoutnum,
    txout: inputTxout,
    pubkey: pubkey
  }
}

module.exports = Wallet
