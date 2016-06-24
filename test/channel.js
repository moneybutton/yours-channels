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
    it('should set chanPath, myChanXPrv, theirChanXPub', function () {
      return asink(function * () {
        let channel = new Channel(myXPrv, theirXPub)
        yield channel.asyncInitialize()
        should.exist(channel.chanPath)
        should.exist(channel.myChanXPrv)
        should.exist(channel.theirChanXPub)
      }, this)
    })
  })

  describe('@randomChanPath', function () {
    it('should give a path with two numbers', function () {
      let path = Channel.randomChanPath()
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

  describe('#randomChanPath', function () {
    it('should give a path with two numbers', function () {
      let path = new Channel().randomChanPath().chanPath
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

  describe('#asyncBuildMultiSigAddr', function () {
    it('should build a multisig address', function () {
      return asink(function * () {
        let channel = new Channel(myXPrv, theirXPub)
        yield channel.asyncInitialize()
        yield channel.asyncBuildMultiSigAddr()
        should.exist(channel.multiSigAddr)

        // 3 is the mainnet constant; tests always run on mainnet
        channel.multiSigAddr.toString()[0].should.equal('3')
      }, this)
    })

    it('should build this known multisig address', function () {
      return asink(function * () {
        let myXPrv = Bip32.fromString('xprv9s21ZrQH143K3vDcUe4KsRnPzFpxwv9VhnExscaAB6KGW9kTr1YhJngKqA47ycSMzzJoGUFeh5PkC4r8nRr7iDqXSdrdh1M1rXqgFhHsFbV')
        let theirXPub = Bip32.fromString('xpub661MyMwAqRbcGsGCwFS4LxezMPgLmXQDqE5q4fUSpQ4rWSHxtQ3USe9N4AkH2x4tzoMtXiWvepZeq5AicnpqapAS68JWGJLrnrSdW5Crofo')
        let channel = new Channel(myXPrv, theirXPub)
        channel.chanPath = 'm/1/1'
        yield channel.asyncInitialize()
        yield channel.asyncBuildMultiSigAddr()
        should.exist(channel.multiSigAddr)

        // 3 is the mainnet constant; tests always run on mainnet
        channel.multiSigAddr.toString().should.equal('3JPTiXjHVB5HBnUiZMXVmV4G4SkTtVgqE7')
      }, this)
    })
  })
})
