/* global describe,it */
'use strict'
let Address = require('yours-bitcoin/lib/address')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let Bn = require('yours-bitcoin/lib/bn')
let Channel = require('../lib/channel')
let MsgUpdate = require('../lib/msgs/msg-update')
let MsgSecrets = require('../lib/msgs/msg-secrets')
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

  function mockFundingTx (multiSigAddr, fundingAmount) {
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

  it('should exist', function () {
    should.exist(Channel)
    should.exist(new Channel())
  })

  describe('API Example', function () {
    it('Bob opens a channel with Carol, sends 1000 satoshi, closes channel', function () {
      return asink(function * () {
        let bob = {}
        let carol = {}

        bob.myXPrv = Bip32.fromRandom()
        carol.myXPrv = Bip32.fromRandom()

        // It is assumed there is an external mechanism that allows Bob and
        // Carol to find the other person's extended public key.
        bob.theirXPub = carol.myXPrv.toPublic()
        carol.theirXPub = bob.myXPrv.toPublic()

        // Bob initializes the channel on his end, creates the (unbroadcasted)
        // funding transaction, and creates the first update message to send to
        // Carol (sending the full funding amount back to Bob).
        bob.channel = new Channel(fundingAmount, bob.myXPrv, bob.theirXPub)
        yield bob.channel.asyncInitialize()

        bob.multiSigAddr = bob.channel.multiSigAddr
        let fundingTx = mockFundingTx(bob.multiSigAddr, fundingAmount)

        bob.channel.state.should.equal(Channel.STATE_INITIAL)
        bob.msg = yield bob.channel.asyncOpen(fundingTx)
        bob.channel.state.should.equal(Channel.STATE_BUILT)

        // Bob sends msg to Carol
        carol.msg = bob.msg

        // Carol already has Bob's xPub. Carol confirms that the id is
        // equal to the multiSigAddr she gets when deriving the chanPath from
        // the xPub.
        ;(carol.msg instanceof MsgUpdate).should.equal(true)
        let multiSigScript = Script.fromPubKeys(2, [carol.theirXPub.derive(carol.msg.chanPath).pubKey, carol.myXPrv.derive(carol.msg.chanPath).pubKey])
        carol.multiSigAddr = Address.fromRedeemScript(multiSigScript)
        carol.msg.chanId.should.equal(carol.multiSigAddr.toString())
        should.exist(carol.msg.getCommitment())

        // Carol notices that she has never received a message for this channel
        // id. She agrees to open a channel with Bob.
        carol.channel = new Channel(carol.msg.getFundingAmount(), carol.myXPrv, carol.theirXPub, carol.msg.getChanPath())
        yield carol.channel.asyncInitialize()
        carol.channel.state.should.equal(Channel.STATE_INITIAL)
        carol.msg = yield carol.channel.asyncHandleMsgUpdate(carol.msg)
        carol.channel.state.should.equal(Channel.STATE_BUILT_AND_STORED)

        // Carol sends msg to Bob. This is Carol's 'update' response containing
        // the commitment transaction built by Carol and to be owned by Bob.
        bob.msg = carol.msg

        // Bob does basic validation on message. TODO: Add more validation.
        ;(bob.msg instanceof MsgUpdate).should.equal(true)
        bob.msg.getFundingAmount().eq(fundingAmount).should.equal(true)
        bob.channel.state.should.equal(Channel.STATE_BUILT)
        bob.msg = yield bob.channel.asyncHandleMsgUpdate(bob.msg)
        bob.channel.state.should.equal(Channel.STATE_STORED)

        // Now Bob sends msg containing revocation secrets to Carol
        carol.msg = bob.msg

        // Carol does basic validation of message
        ;(carol.msg instanceof MsgSecrets).should.equal(true)
        carol.msg.args.secrets.length.should.equal(0) // no earlier commitment tx for refund tx
        carol.channel.state.should.equal(Channel.STATE_BUILT_AND_STORED)
        carol.msg = yield carol.channel.asyncHandleMsgSecrets(carol.msg)
        carol.channel.state.should.equal(Channel.STATE_INITIAL)

        // Now Carol sends the message with her secrets to Bob
        bob.msg = carol.msg

        // Bob does basic validation
        ;(bob.msg instanceof MsgSecrets).should.equal(true)
        carol.msg.args.secrets.length.should.equal(0) // no earlier commitment tx for refund tx
        bob.channel.state.should.equal(Channel.STATE_STORED)
        bob.msg = bob.channel.asyncHandleMsgSecrets(bob.msg)
        bob.channel.state.should.equal(Channel.STATE_INITIAL)
        ;(bob.msg === null).should.equal(true)

        // A this point, the channel is now open. Bob wishes pay Carol 1000 satoshis.
        bob.msg = yield bob.channel.asyncPay(Bn(1000))

        // TODO: Not finished.
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

  describe('@randomIndex', function () {
    it('should give a random index', function () {
      let x = Channel.randomIndex()

      // this (random) number should almost always be between 0 and the
      // largest 31 bit number. technically, it could be exactly equal to 0
      // or the largest 31 bit number, but that should almost never happen.
      x.should.greaterThan(0)
      x.should.lessThan(0x7fffffff)
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

  describe('#asyncGetSecret', function () {
    it('should get a secret', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let revSecret = yield channel.asyncNewRevSecret()
        let revSecret2 = yield channel.asyncGetSecret(revSecret.hash)
        revSecret2.should.equal(revSecret)
      }, this)
    })
  })

  describe('#asyncOpen', function () {
    it('should create a msgUpdate with output descriptions of length 1', function () {
      return asink(function * () {
        let channel = new Channel(fundingAmount, myXPrv, theirXPub)
        yield channel.asyncInitialize()
        let fundingTx = mockFundingTx(channel.multiSigAddr, fundingAmount)
        let msg = yield channel.asyncOpen(fundingTx)
        should.exist(msg.args.commitment)
        should.exist(channel.fundingTx)
        should.exist(channel.fundingTxHash)
        channel.fundingTxHash.toString('hex').should.equal(channel.fundingTx.hash().toString('hex'))
      }, this)
    })
  })
})
