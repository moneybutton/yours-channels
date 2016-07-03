/* global describe,it */
'use strict'
let Address = require('yours-bitcoin/lib/address')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let Bn = require('yours-bitcoin/lib/bn')
let Channel = require('../lib/channel')
let Consts = require('../lib/consts.js')
let Interp = require('yours-bitcoin/lib/interp')
let MsgSecrets = require('../lib/msgs/msg-secrets')
let MsgUpdate = require('../lib/msgs/msg-update')
let Output = require('../lib/output')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let Script = require('yours-bitcoin/lib/script')
let Tx = require('yours-bitcoin/lib/tx')
let TxIn = require('yours-bitcoin/lib/tx-in')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
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

  function asyncOpenChannel () {
    return asink(function * () {
      let bob = {}
      let carol = {}

      bob.myXPrv = Bip32.fromRandom()
      carol.myXPrv = Bip32.fromRandom()

      // It is assumed there is an external mechanism that allows Bob and
      // Carol to find the other person's extended public key.
      bob.theirXPub = carol.myXPrv.toPublic()
      carol.theirXPub = bob.myXPrv.toPublic()

      /* ---- Opening the channel and creating the funding tx ---- */

      // Bob initializes the channel on his end, creates the (unbroadcasted)
      // funding transaction, and creates the first update message to asyncSend to
      // Carol (asyncSending the full funding amount back to Bob).
      bob.channel = new Channel(fundingAmount, bob.myXPrv, bob.theirXPub)
      yield bob.channel.asyncInitialize()

      bob.multiSigAddr = bob.channel.multiSigAddr
      let fundingTx = mockFundingTx(bob.multiSigAddr, fundingAmount)

      bob.channel.state.should.equal(Channel.STATE_INITIAL)
      bob.msg = yield bob.channel.asyncOpen(fundingTx)
      bob.channel.state.should.equal(Channel.STATE_BUILT)

      // Bob asyncSends msg to Carol
      carol.msg = bob.msg

      // Carol already has Bob's xPub. Carol confirms that the id is
      // equal to the multiSigAddr she gets when deriving the chanPath from
      // the xPub.
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

      // Carol asyncSends msg to Bob. This is Carol's 'update' response containing
      // the commitment transaction built by Carol and to be owned by Bob.
      bob.msg = carol.msg

      // Bob does basic validation on message. TODO: Add more validation.
      bob.msg.getFundingAmount().eq(fundingAmount).should.equal(true)
      bob.channel.state.should.equal(Channel.STATE_BUILT)
      bob.msg = yield bob.channel.asyncHandleMsgUpdate(bob.msg)
      bob.channel.state.should.equal(Channel.STATE_STORED)

      // Now Bob asyncSends msg containing revocation secrets to Carol
      carol.msg = bob.msg

      // Carol does basic validation of message
      carol.msg.args.secrets.length.should.equal(0) // no earlier commitment tx for refund tx
      carol.channel.state.should.equal(Channel.STATE_BUILT_AND_STORED)
      carol.msg = yield carol.channel.asyncHandleMsgSecrets(carol.msg)
      carol.channel.state.should.equal(Channel.STATE_INITIAL)

      // Now Carol asyncSends the message with her secrets to Bob
      bob.msg = carol.msg

      // Bob does basic validation
      carol.msg.args.secrets.length.should.equal(0) // no earlier commitment tx for refund tx
      bob.channel.state.should.equal(Channel.STATE_STORED)
      bob.msg = bob.channel.asyncHandleMsgSecrets(bob.msg)
      bob.channel.state.should.equal(Channel.STATE_INITIAL)
      ;(bob.msg === null).should.equal(true)

      // Now carol and Bob monitor the multisig address until they find that
      // the refund transaction has one confirmation
      yield carol.channel.asyncConfirmFundingTx(bob.channel.fundingTx)

      return { bob, carol }
    }, this)
  }

  function asyncSend (from, to, amount, htlcSecret) {
    return asink(function * () {
      // A this point, the channel is now open. Bob wishes pay to 1000 satoshis.
      from.channel.state.should.equal(Channel.STATE_INITIAL)
      from.msg = yield from.channel.asyncPay(amount, htlcSecret)
      from.channel.state.should.equal(Channel.STATE_BUILT)

      // from asyncSends the message to to.
      to.msg = from.msg

      // to does basic validation of the update message
      ;(to.msg instanceof MsgUpdate).should.equal(true)
      to.channel.state.should.equal(Channel.STATE_INITIAL)
      to.msg = yield to.channel.asyncHandleMsgUpdate(to.msg)
      to.channel.state.should.equal(Channel.STATE_BUILT_AND_STORED)

      // to asyncSends update to from
      from.msg = to.msg

      // from handles update message
      ;(from.msg instanceof MsgUpdate).should.equal(true)
      from.msg.getFundingAmount().eq(fundingAmount).should.equal(true)
      from.channel.state.should.equal(Channel.STATE_BUILT)
      from.msg = yield from.channel.asyncHandleMsgUpdate(from.msg)
      from.channel.state.should.equal(Channel.STATE_STORED)

      // from asyncSends response to to containing secrets
      to.msg = from.msg

      // to does basic validation of the secret message
      // ;(to.msg instanceof MsgSecrets).should.equal(true)
      // to.msg.args.secrets.length.should.equal(1)
      // should.exist(to.msg.args.secrets[0].buf)
      to.channel.state.should.equal(Channel.STATE_BUILT_AND_STORED)
      to.msg = yield to.channel.asyncHandleMsgSecrets(to.msg)
      to.channel.state.should.equal(Channel.STATE_INITIAL)

      // Now to asyncSends the message with her secrets to from
      from.msg = to.msg

      // from does basic validation of the secret message
      ;(from.msg instanceof MsgSecrets).should.equal(true)
      // from.msg.args.secrets.length.should.equal(1)
      // TODO: Should to be retransmitting from's secrets?
      // should.not.exist(from.msg.args.secrets[0].buf)
      from.channel.state.should.equal(Channel.STATE_STORED)
      from.msg = from.channel.asyncHandleMsgSecrets(from.msg)
      from.channel.state.should.equal(Channel.STATE_INITIAL)
      ;(from.msg === null).should.equal(true)

      return { from, to }
    }, this)
  }

  function asyncClose (agent, commitment, secretMap) {
    return asink(function * () {
      // bob tests the validity of the refund transaction by building a spending
      // tx but not broadcasting it
      agent.spending = yield agent.channel.asyncBuildSpending(
        new Address().fromPrivKey(new PrivKey().fromRandom()),
        commitment,
        Consts.CSV_DELAY,
        secretMap
      )
      agent.txVerifier = new TxVerifier(agent.spending.txb.tx, agent.spending.txb.uTxOutMap)
      agent.txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false)
    }, this)
  }

  it('should exist', function () {
    should.exist(Channel)
    should.exist(new Channel())
  })

  describe('Integration tests', function () {
    it('Bob opens a channel with Carol, asyncSends 50000 satoshi in first payment, asyncSends 2000 satoshi in second payment, both validate every commitment', function () {
      return asink(function * () {
        let { bob, carol } = yield asyncOpenChannel()
        yield asyncSend(bob, carol, Bn(50000))

        bob.channel.myCommitments.length.should.equal(2)
        bob.channel.myCommitments[1].txb.tx.txOuts.length.should.equal(2)
        bob.channel.myCommitments[1].txb.tx.txOuts[0].valueBn.toString().should.equal('50000')
        carol.channel.myCommitments.length.should.equal(2)
        carol.channel.myCommitments[1].txb.tx.txOuts.length.should.equal(2)
        carol.channel.myCommitments[1].txb.tx.txOuts[0].valueBn.toString().should.equal('50000')

        yield asyncSend(bob, carol, Bn(2000))

        /* ---- closing the channel ---- */

        yield asyncClose(bob, bob.channel.myCommitments[0])
        yield asyncClose(bob, bob.channel.theirCommitments[0])

        // when carol tries to build a spending transaction for the refund tx
        // this should return the error 'no spendable outputs found'
        try {
          yield asyncClose(carol, carol.channel.myCommitments[0])
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
        try {
          yield asyncClose(carol, carol.channel.theirCommitments[0])
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }

        yield asyncClose(bob, bob.channel.myCommitments[1])
        yield asyncClose(bob, bob.channel.theirCommitments[1])
        yield asyncClose(carol, carol.channel.myCommitments[1])
        yield asyncClose(carol, carol.channel.theirCommitments[1])
        yield asyncClose(bob, bob.channel.myCommitments[2])
        yield asyncClose(bob, bob.channel.theirCommitments[2])
        yield asyncClose(carol, carol.channel.myCommitments[2])
        yield asyncClose(carol, carol.channel.theirCommitments[2])
      }, this)
    })

    it('Bob opens a channel with Carol, asyncSends 50000 satoshi to Carol, Carol asyncSends 2000 satoshi back to Bob, both validate every commitment', function () {
      return asink(function * () {
        let { bob, carol } = yield asyncOpenChannel()
        yield asyncSend(bob, carol, Bn(50000))
        yield asyncSend(carol, bob, Bn(2000))

        /* ---- closing the channel ---- */

        yield asyncClose(bob, bob.channel.myCommitments[0])
        yield asyncClose(bob, bob.channel.theirCommitments[0])

        // when carol tries to build a spending transaction for the refund tx
        // this should return the error 'no spendable outputs found'
        try {
          yield asyncClose(carol, carol.channel.myCommitments[0])
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
        try {
          yield asyncClose(carol, carol.channel.theirCommitments[0])
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }

        yield asyncClose(bob, bob.channel.myCommitments[1])
        yield asyncClose(bob, bob.channel.theirCommitments[1])
        yield asyncClose(carol, carol.channel.myCommitments[1])
        yield asyncClose(carol, carol.channel.theirCommitments[1])
        yield asyncClose(bob, bob.channel.myCommitments[2])
        yield asyncClose(bob, bob.channel.theirCommitments[2])
        yield asyncClose(carol, carol.channel.myCommitments[2])
        yield asyncClose(carol, carol.channel.theirCommitments[2])
      }, this)
    })

    it('Bob opens a channel with Carol, asyncSends 50000 satoshi to Carol via an htlc, Carol asyncSends 2000 satoshi back to Bob, both validate every commitment', function () {
      return asink(function * () {
        let { bob, carol } = yield asyncOpenChannel()
        let htlcSecret = yield bob.channel.asyncNewRevSecret()
        yield asyncSend(bob, carol, Bn(50000), htlcSecret)
        yield asyncSend(carol, bob, Bn(2000))

        yield asyncClose(bob, bob.channel.myCommitments[0])
        yield asyncClose(bob, bob.channel.theirCommitments[0])

        try {
          yield asyncClose(carol, carol.channel.myCommitments[0])
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
        try {
          yield asyncClose(carol, carol.channel.theirCommitments[0])
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }

        yield asyncClose(bob, bob.channel.myCommitments[1])
//        yield asyncClose(carol, carol.channel.myCommitments[1])
        yield asyncClose(bob, bob.channel.myCommitments[2])
//        yield asyncClose(carol, carol.channel.myCommitments[2])
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
        channel.secretMap.get(revSecret.hash.toString('hex')).should.equal(revSecret.buf)
      }, this)
    })
  })

  describe('#getSecret', function () {
    it('should get a secret', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let revSecret = yield channel.asyncNewRevSecret()
        let revSecret2 = channel.getSecret(revSecret.hash)
        revSecret2.should.equal(revSecret.buf)
      }, this)
    })
  })

  describe('#asyncOpen', function () {
    it('should create a msgUpdate with output descriptions of length 1', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let fundingTx = mockFundingTx(channel.multiSigAddr, fundingAmount)
        let msg = yield channel.asyncOpen(fundingTx)
        should.exist(msg.args.commitment)
        should.exist(channel.fundingTx)
        should.exist(channel.fundingTxHash)
        channel.fundingTxHash.toString('hex').should.equal(channel.fundingTx.hash().toString('hex'))
      }, this)
    })
  })

  describe('#asyncConfirmFundingTx', function () {
    it('should set the funding tx', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let fundingTx = mockFundingTx(channel.multiSigAddr, fundingAmount)
        yield channel.asyncConfirmFundingTx(fundingTx)
        should.exist(channel.fundingTx)
        should.exist(channel.fundingTxHash)
        channel.fundingTxHash.toString('hex').should.equal(fundingTx.hash().toString('hex'))
        channel.funded.should.equal(true)
      }, this)
    })
  })

  describe('#asyncBuildCommitent', function () {
    it('should build a commitment tx', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let fundingTx = mockFundingTx(channel.multiSigAddr, fundingAmount)
        let fundingTxHash = fundingTx.hash()
        let fundingTxOut = fundingTx.txOuts[0]
        let revSecret = yield channel.asyncNewRevSecret()
        let pathIndex = 1
        let output = new Output().fromObject({
          kind: 'pubKey',
          networkSourceId: channel.myId,
          channelSourceId: channel.myId,
          channelDestId: channel.theirId,
          networkDestId: channel.theirId,
          channelSourcePath: `m/0/${pathIndex}`,
          channelDestPath: `m/0/${pathIndex}`,
          // htlcSecret: htlcSecret ? htlcSecret.toPublic() : undefined,
          revSecret: revSecret.toPublic()
          // amount: amount // change
        })
        let commitment = yield channel.asyncBuildCommitment([output], fundingTxHash, fundingTxOut)
        should.exist(commitment)
      }, this)
    })
  })

  describe('#asyncBuildSpending', function () {
    it('should build a valid spending tx', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let fundingTx = mockFundingTx(channel.multiSigAddr, fundingAmount)
        let fundingTxHash = fundingTx.hash()
        let fundingTxOut = fundingTx.txOuts[0]
        let revSecret = yield channel.asyncNewRevSecret()
        let pathIndex = 1
        let output = new Output().fromObject({
          kind: 'pubKey',
          networkSourceId: channel.myId,
          channelSourceId: channel.myId,
          channelDestId: channel.myId,
          networkDestId: channel.myId,
          channelSourcePath: `m/0/${pathIndex}`,
          channelDestPath: `m/0/${pathIndex}`,
          // htlcSecret: htlcSecret ? htlcSecret.toPublic() : undefined,
          revSecret: revSecret.toPublic()
          // amount: amount // change
        })
        let commitment = yield channel.asyncBuildCommitment([output], fundingTxHash, fundingTxOut)
        let address = Address.fromPrivKey(PrivKey.fromRandom())
        let spending = yield channel.asyncBuildSpending(address, commitment, Consts.CSV_DELAY)
        let txVerifier = new TxVerifier(spending.txb.tx, spending.txb.uTxOutMap)
        txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false)
      }, this)
    })
  })

  describe('#asyncPay', function () {
    it('should return an update message', function () {
      return asink(function * () {
        let {bob} = yield asyncOpenChannel()
        let msg = yield bob.channel.asyncPay(Bn(50000))
        ;(msg instanceof MsgUpdate).should.equal(true)
        msg.args.commitment.outputs.length.should.equal(2) // one payment, one change
      }, this)
    })
  })

  describe('#asyncAddOutput', function () {
    it('should add a pubkey output to this output', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let revSecret = yield channel.asyncNewRevSecret()
        let pathIndex = 1
        let output = new Output().fromObject({
          kind: 'pubKey',
          networkSourceId: channel.myId,
          channelSourceId: channel.myId,
          channelDestId: channel.myId,
          networkDestId: channel.myId,
          channelSourcePath: `m/0/${pathIndex}`,
          channelDestPath: `m/0/${pathIndex}`,
          // htlcSecret: htlcSecret ? htlcSecret.toPublic() : undefined,
          revSecret: revSecret.toPublic()
          // amount: amount // change
        })
        let outputs = yield channel.asyncAddOutput(output, [])
        outputs.length.should.equal(2)
        outputs[0].kind.should.equal('pubKey')
      }, this)
    })
  })

  describe('#asyncUpdate', function () {
    it('should get an update message', function () {
      return asink(function * () {
        let channel = yield new Channel(fundingAmount, myXPrv, theirXPub).asyncInitialize()
        let fundingTx = mockFundingTx(channel.multiSigAddr, fundingAmount)
        channel.fundingTx = fundingTx
        let revSecret = yield channel.asyncNewRevSecret()
        let pathIndex = 1
        let output = new Output().fromObject({
          kind: 'pubKey',
          networkSourceId: channel.myId,
          channelSourceId: channel.myId,
          channelDestId: channel.myId,
          networkDestId: channel.myId,
          channelSourcePath: `m/0/${pathIndex}`,
          channelDestPath: `m/0/${pathIndex}`,
          // htlcSecret: htlcSecret ? htlcSecret.toPublic() : undefined,
          revSecret: revSecret.toPublic()
          // amount: amount // change
        })
        channel.state.should.equal(Channel.STATE_INITIAL)
        let msg = yield channel.asyncUpdate([output])
        channel.state.should.equal(Channel.STATE_BUILT)
        ;(msg instanceof MsgUpdate).should.equal(true)
        msg.args.commitment.outputs.length.should.equal(1)
        msg.args.commitment.outputs[0].kind.should.equal('pubKey')
      }, this)
    })
  })
})
