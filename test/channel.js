/* global describe,it */
'use strict'
let Channel = require('../lib/channel')
let should = require('should')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let asink = require('asink')

describe('Channel', function () {
  let myXPrv = Bip32.fromRandom()
  // let myXPub = myXPrv.toPublic()
  let theirXPrv = Bip32.fromRandom()
  let theirXPub = theirXPrv.toPublic()

  it('should exist', function () {
    should.exist(Channel)
    should.exist(new Channel())
  })

  describe('#constructor', function () {
    return asink(function * () {
      let channel = new Channel(myXPrv, theirXPub)
      should.exist(channel.myXPrv)
      should.exist(channel.theirXPub)
    }, this)
  })
})
