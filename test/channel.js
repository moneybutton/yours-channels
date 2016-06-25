/* global describe,it */
'use strict'
let Bip32 = require('yours-bitcoin/lib/bip-32')
let Bn = require('yours-bitcoin/lib/bn')
let Channel = require('../lib/channel')
let MsgUpdate = require('../lib/msgs/msg-update')
let Tx = require('yours-bitcoin/lib/tx')
let TxIn = require('yours-bitcoin/lib/tx-in')
let Script = require('yours-bitcoin/lib/script')
let asink = require('asink')
let should = require('should')

describe('Channel', function () {
  let fundingAmount = Bn(1e8)
  let myXPrv = Bip32.fromRandom()
  // let myXPub = myXPrv.toPublic()
  let theirXPrv = Bip32.fromRandom()
  let theirXPub = theirXPrv.toPublic()

  it('should exist', function () {
    should.exist(Channel)
    should.exist(new Channel())
  })

  describe('API Example', function () {
    function mockFundingTx (multiSigAddr) {
      let tx = new Tx()
      {
        let txHashBuf = new Buffer(32)
        txHashBuf.fill(0)
        let txOutNum = 0
        let script = Script.fromString('OP_TRUE')
        tx.versionBytesNum = 2
        tx.addTxIn(txHashBuf, txOutNum, script, TxIn.SEQUENCE_FINAL)
      }

      {
        let script = multiSigAddr.toScript()
        tx.addTxOut(fundingAmount, script)
      }

      return tx
    }

    it('Bob opens a channel with Carol, sends 1000 satoshi, closes channel', function () {
      return asink(function * () {
        let bob = {}
        let carol = {}

        bob.xPrv = Bip32.fromRandom()
        carol.xPrv = Bip32.fromRandom()

        bob.channel = new Channel(fundingAmount, bob.xPrv, carol.xPrv.toPublic())
        yield bob.channel.asyncInitialize()

        let multiSigAddr = bob.channel.multiSigAddr
        let fundingTx = mockFundingTx(multiSigAddr)

        let msg = yield bob.channel.asyncOpen(fundingTx)
        ;(msg instanceof MsgUpdate).should.equal(true)

        // TODO: Finished
      }, this)
    })
  })

  describe('#constructor', function () {
    return asink(function * () {
      let channel = new Channel(fundingAmount, myXPrv, theirXPub)
      should.exist(channel.fundingAmount)
      should.exist(channel.myXPrv)
      should.exist(channel.theirXPub)
    }, this)
  })

  describe('#asyncInitialize', function () {
    it('should set chanPath, myChanXPrv, theirChanXPub', function () {
      return asink(function * () {
        let channel = new Channel(fundingAmount, myXPrv, theirXPub)
        yield channel.asyncInitialize()
        should.exist(channel.chanPath)
        should.exist(channel.myChanXPrv)
        should.exist(channel.theirChanXPub)
        should.exist(channel.myId)
        should.exist(channel.theirId)
        channel.myId.should.equal(yield channel.myXPrv.toPublic().asyncToString())
        channel.theirId.should.equal(yield channel.theirXPub.asyncToString())
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
        let channel = new Channel(fundingAmount, myXPrv, theirXPub)
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
        let channel = new Channel(fundingAmount, myXPrv, theirXPub)
        channel.chanPath = 'm/1/1'
        yield channel.asyncInitialize()
        yield channel.asyncBuildMultiSigAddr()
        should.exist(channel.multiSigAddr)

        // 3 is the mainnet constant; tests always run on mainnet
        channel.multiSigAddr.toString().should.equal('3JPTiXjHVB5HBnUiZMXVmV4G4SkTtVgqE7')
      }, this)
    })
  })

  describe('#asyncGetId', function () {
    it('should return the multisig address', function () {
      return asink(function * () {
        let channel = new Channel(fundingAmount, myXPrv, theirXPub)
        yield channel.asyncInitialize()
        let id = yield channel.asyncGetId()
        id.should.equal(channel.multiSigAddr.toString())
      }, this)
    })
  })

  describe('#asyncNewRevSecret', function () {
    it('should add and return a new revSecret', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let revSecret = yield channel.asyncNewRevSecret()
        should.exist(revSecret.buf)
        should.exist(revSecret.hash)
        channel.secrets[0].should.equal(revSecret)
      }, this)
    })
  })

  describe('#asyncOpen', function () {
    it('should create a msgUpdate with output descriptions of length 1', function () {
      return asink(function * () {
        let channel = new Channel(fundingAmount, myXPrv, theirXPub)
        yield channel.asyncInitialize()
        let msg = yield channel.asyncOpen()
        msg.args.outputDescriptions.length.should.equal(1)
      }, this)
    })
  })
})
