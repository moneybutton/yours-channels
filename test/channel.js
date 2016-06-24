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

  describe('#asyncInitialize', function () {
    it('should set rootPath, myXPrvRoot, theirXPubRoot', function () {
      return asink(function * () {
        let channel = new Channel(myXPrv, theirXPub)
        yield channel.asyncInitialize()
        should.exist(channel.rootPath)
        should.exist(channel.myXPrvRoot)
        should.exist(channel.theirXPubRoot)
      }, this)
    })
  })

  describe('@randomRootPath', function () {
    it('should give a path with two numbers', function () {
      let path = Channel.randomRootPath()
      let [, x, y] = path.split('/').map((a) => Number(a))

      // these (random) numbers should almost always be between 0 and the
      // largest 31 bit number. technically, they could be exactly equal to 0
      // or the largest 31 bit number, but that should almost never happen.
      x.should.greaterThan(0)
      x.should.lessThan(0x7fffffff)
      y.should.greaterThan(0)
      y.should.lessThan(0x7fffffff)
      x.should.not.equal(y)
    })
  })

  describe('#randomRootPath', function () {
    it('should give a path with two numbers', function () {
      let path = new Channel().randomRootPath().rootPath
      let [, x, y] = path.split('/').map((a) => Number(a))

      // these (random) numbers should almost always be between 0 and the
      // largest 31 bit number. technically, they could be exactly equal to 0
      // or the largest 31 bit number, but that should almost never happen.
      x.should.greaterThan(0)
      x.should.lessThan(0x7fffffff)
      y.should.greaterThan(0)
      y.should.lessThan(0x7fffffff)
      x.should.not.equal(y)
    })
  })
})
