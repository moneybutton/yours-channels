/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Address = require('yours-bitcoin/lib/address')
let Wallet = require('../lib/wallet')
let Bn = require('yours-bitcoin/lib/bn')

describe('Wallet', function () {
  let privKey = PrivKey.fromRandom()
  let pubKey = PubKey.fromPrivKey(privKey)
  let address = Address.fromPubKey(pubKey)

  it('should exist', function () {
    should.exist(Wallet)
    should.exist(new Wallet())
  })

  describe('#getUnspentOutput', function () {
    it('should return an unspent output', function () {
      return asink(function * () {
        let wallet = new Wallet()
        let output = wallet.getUnspentOutput(Bn(1e8), address)

        should.exist(output.txhashbuf)
        should.exist(output.txoutnum)
        should.exist(output.txout)
      }, this)
    })
  })
})
