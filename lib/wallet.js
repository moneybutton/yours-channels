'use strict'
let Struct = require('fullnode/lib/struct')
let Txout = require('fullnode/lib/txout')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Script = require('fullnode/lib/script')
let BN = require('fullnode/lib/bn')

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
Wallet.prototype.getUnspentOutput = function (amount, address) {
  let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + address.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
  let txoutamount = BN(1e10)
  let privkey = Privkey().fromRandom()
  let pubkey = Pubkey().fromPrivkey(privkey)
  return {
    txhashbuf: new Buffer(32).fill(0),
    txoutnum: 0,
    txout: Txout(txoutamount, scriptout),
    pubkey: pubkey
  }
}

module.exports = Wallet
