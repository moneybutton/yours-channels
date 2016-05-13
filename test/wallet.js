/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey.js')
let Address = require('fullnode/lib/address.js')
let Wallet = require('../lib/wallet.js')
let Bn = require('fullnode/lib/bn')

describe('Wallet', function () {
  let privkey = Privkey().fromRandom()
  let pubkey = Pubkey().fromPrivkey(privkey)
  let address = Address().fromPubkey(pubkey)

  it('should exist', function () {
    should.exist(Wallet)
    should.exist(new Wallet())
  })

  describe('#getUnspentOutput', function () {
    it('getUnspentOutput should return an unspent output', function () {
      return asink(function *() {
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(Bn(1e8), address)

        should.exist(output.txhashbuf)
        should.exist(output.txoutnum)
        should.exist(output.txout)
      }, this)
    })
  })
})
