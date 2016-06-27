/* global describe,it,beforeEach */
'use strict'
let should = require('should')
let asink = require('asink')
let OutputDescription = require('../../lib/output-description')
let Commitment = require('../../lib/txs/commitment')
let FundingTxObj = require('../../lib/txs/funding-tx-obj')
let HtlcSecret = require('../../lib/scrts/htlc-secret')
let RevocationSecret = require('../../lib/scrts/revocation-secret')
let Agent = require('../../lib/agent')
let Wallet = require('../../lib/wallet')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let Address = require('yours-bitcoin/lib/address')
let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let SpendingTxObj = require('../../lib/txs/spending-tx-obj')
let TxHelper = require('../test-helpers/tx-helper')
let Consts = require('../../lib/consts.js')

let bob, carol
let htlcSecret, revocationSecret
let xPubs, bobBip32, carolBip32
let pubKeyCommitment, revPubKeyCommitment, htlcCommitment, revHtlcCommitment
let txVerifier, error
let spendingTxObj, commitment
let destKeyPair, sourceKeyPair, address

let buildPubKeyCommitment = function () {
  return asink(function * () {
    // to build a transaction with pubKey outputs we must make sure that the
    // builder (carol) is the channel destination
    pubKeyCommitment = new Commitment()
    pubKeyCommitment.outputList = [
      new OutputDescription(
        'pubKey',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7)),
      new OutputDescription(
        'pubKey',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7))
    ]
    yield pubKeyCommitment.asyncBuild(
      carol.fundingTxObj.txb.tx.hash(),
      carol.fundingTxObj.txb.tx.txOuts[0],
      carol.multisigAddress,
      carol.id, // builder id
      xPubs)
    yield pubKeyCommitment.txb.asyncSign(0, bob.multisigAddress.keyPair, bob.fundingTxObj.txb.tx.txOuts[0])
    return pubKeyCommitment
  }, this)
}

let buildRevPubKeyCommitment = function () {
  return asink(function * () {
    // to build a transaction with _revocable_ htlc outputs we
    // must make sure that the
    // builder (carol) is _not_ the channel destination
    revPubKeyCommitment = new Commitment()
    revPubKeyCommitment.outputList = [
      new OutputDescription(
        'pubKey',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7)),
      new OutputDescription(
        'pubKey',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7))
    ]
    yield revPubKeyCommitment.asyncBuild(
      bob.fundingTxObj.txb.tx.hash(),
      bob.fundingTxObj.txb.tx.txOuts[0],
      bob.multisigAddress,
      bob.id, // builder id
      xPubs)
    yield revPubKeyCommitment.txb.asyncSign(0, carol.multisigAddress.keyPair, carol.fundingTxObj.txb.tx.txOuts[0])
    return revPubKeyCommitment
  }, this)
}

let buildHtlcCommitment = function () {
  return asink(function * () {
    // to build a transaction with htlc outputs we must make sure that the
    // builder (carol) is the channel destination
    htlcCommitment = new Commitment()
    htlcCommitment.outputList = [
      new OutputDescription(
        'htlc',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7)),
      new OutputDescription(
        'htlc',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7))
    ]
    yield htlcCommitment.asyncBuild(
      carol.fundingTxObj.txb.tx.hash(),
      carol.fundingTxObj.txb.tx.txOuts[0],
      carol.multisigAddress,
      carol.id, // builder id
      xPubs)
    yield htlcCommitment.txb.asyncSign(0, bob.multisigAddress.keyPair, bob.fundingTxObj.txb.tx.txOuts[0])
    return htlcCommitment
  }, this)
}

let buildRevHtlcCommitment = function () {
  return asink(function * () {
    // to build a transaction with _revocable_ htlc outputs we
    // must make sure that the
    // builder (carol) is _not_ the channel destination
    revHtlcCommitment = new Commitment()
    revHtlcCommitment.outputList = [
      new OutputDescription(
        'htlc',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7)),
      new OutputDescription(
        'htlc',
        'alice', 'bob', 'carol', 'dave',
        'm/1/2', 'm/4/5',
        htlcSecret, revocationSecret,
        Bn(1e7))
    ]
    yield revHtlcCommitment.asyncBuild(
      bob.fundingTxObj.txb.tx.hash(),
      bob.fundingTxObj.txb.tx.txOuts[0],
      bob.multisigAddress,
      bob.id, // builder id
      xPubs)
    yield revHtlcCommitment.txb.asyncSign(0, carol.multisigAddress.keyPair, carol.fundingTxObj.txb.tx.txOuts[0])
    return revHtlcCommitment
  }, this)
}

describe('SpendingTxObj', function () {
  it('should exist', function () {
    should.exist(SpendingTxObj)
    should.exist(new SpendingTxObj())
  })

  beforeEach(function () {
    return asink(function * () {
      bob = new Agent('bob')
      yield bob.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())
      bob.funder = true
      carol = new Agent('carol')
      yield carol.asyncInitialize(PrivKey.fromRandom(), PrivKey.fromRandom(), PrivKey.fromRandom())

      bob.other = yield carol.asyncToPublic()
      carol.other = yield bob.asyncToPublic()

      yield bob.multisigAddress.asyncInitialize(bob.other.multisigAddress.pubKey)
      yield carol.multisigAddress.asyncInitialize(carol.other.multisigAddress.pubKey)

      let inputAmountBn = Bn(1e10)
      let fundingAmount = Bn(1e8)
      let wallet = new Wallet()
      let output = wallet.getUnspentOutput(inputAmountBn, bob.sourceAddress.keyPair.pubKey)

      let fundingTxObj = new FundingTxObj()
      yield fundingTxObj.asyncInitialize(
        fundingAmount,
        bob.sourceAddress,
        bob.multisigAddress,
        output.txhashbuf,
        output.txoutnum,
        output.txout,
        output.pubKey,
        output.inputTxout)

      bob.fundingTxObj = carol.fundingTxObj = fundingTxObj

      htlcSecret = new HtlcSecret()
      yield htlcSecret.asyncInitialize()
      revocationSecret = new RevocationSecret()
      yield revocationSecret.asyncInitialize()

      destKeyPair = new KeyPair().fromRandom()
      sourceKeyPair = new KeyPair().fromRandom()

      bobBip32 = new Bip32().fromRandom()
      carolBip32 = new Bip32().fromRandom()
      xPubs = {
        bob: bobBip32.toPublic(),
        carol: carolBip32.toPublic()
      }

      commitment = new Commitment()
      spendingTxObj = new SpendingTxObj()
      address = new Address().fromPrivKey(new PrivKey().fromRandom())
    }, this)
  })

  describe('#asyncBuild', function () {
    // Case: pubKey
    it('build a spending transaction. Case pubKey', function () {
      return asink(function * () {
        let pubKeyCommitment = yield buildPubKeyCommitment()
        yield spendingTxObj.asyncBuild(address, pubKeyCommitment, carolBip32, carol.id)
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it.skip('build a spending transaction. Case pubKey, should fail with the wrong pub key', function () {
      return asink(function * () {
        try {
          let pubKeyCommitment = yield buildPubKeyCommitment()
          yield spendingTxObj.asyncBuild(address, pubKeyCommitment, bobBip32, carol.id)
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
      }, this)
    })

    // Case: revocable pubKey

    it('build a spending transaction. Case revocable pubKey branch 1', function () {
      return asink(function * () {
        let revPubKeyCommitment = yield buildRevPubKeyCommitment()
        yield spendingTxObj.asyncBuild(address, revPubKeyCommitment, carolBip32, carol.id, Bn(100))
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('build a spending transaction. Case revocable pubKey branch 1, should fail with wrong pubKey', function () {
      return asink(function * () {
        try {
          let revPubKeyCommitment = yield buildRevPubKeyCommitment()
          yield spendingTxObj.asyncBuild(address, revPubKeyCommitment, bobBip32, carol.id)
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
      }, this)
    })

    it('build a spending transaction. Case revocable pubKey branch 2', function () {
      return asink(function * () {
        let revPubKeyCommitment = yield buildRevPubKeyCommitment()
        yield spendingTxObj.asyncBuild(address, revPubKeyCommitment, carolBip32, carol.id, Bn(100))
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('build a spending transaction. Case branch one of htlc', function () {
      return asink(function * () {
        let htlcCommitment = yield buildHtlcCommitment()
        yield spendingTxObj.asyncBuild(address, htlcCommitment, carolBip32, carol.id)
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('build a spending transaction. Case branch two of htlc', function () {
      return asink(function * () {
        let htlcCommitment = yield buildHtlcCommitment()
        yield spendingTxObj.asyncBuild(address, htlcCommitment, carolBip32, carol.id, Bn(100))
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('build a spending transaction. Case branch one of revocable htlc', function () {
      return asink(function * () {
        let revHtlcCommitment = yield buildRevHtlcCommitment()
        yield spendingTxObj.asyncBuild(address, revHtlcCommitment, carolBip32, carol.id, Bn(100))
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('build a spending transaction. Case branch two of revocable htlc', function () {
      return asink(function * () {
        let revHtlcCommitment = yield buildRevHtlcCommitment()
        yield spendingTxObj.asyncBuild(address, revHtlcCommitment, carolBip32, carol.id, Bn(100)) // TODO: does this need to be carol' bib and id or bob's?
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it.skip('build a spending transaction. Case branch three of revocable htlc', function () {
      return asink(function * () {
        // TODO
      }, this)
    })
  })

  describe('#pubKeyInputScript', function () {
    it('pubKeyRedeemScript and pubKeyInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.pubKeyRedeemScript(destKeyPair.pubKey)
        let spendingScriptObj = spendingTxObj.pubKeyInputScript({ channelDestId: 'aliceId' }, 'aliceId')

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          Bn(100))

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('pubKeyRedeemScript and pubKeyInputScript should evaluate to false if keys don\'t match', function () {
      return asink(function * () {
        let scriptPubKey = commitment.pubKeyRedeemScript(destKeyPair.pubKey)
        let spendingScriptObj = spendingTxObj.pubKeyInputScript({ channelDestId: 'aliceId' }, 'aliceId')

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EVAL_FALSE')
      }, this)
    })
  })

  describe('#revPubKeyRedeemScript', function () {
    it('branch 1 of revPubKeyRedeemScript and revPubKeyInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revPubKeyRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revPubKeyInputScript(
          { channelDestId: 'aliceId', revocationSecret: revocationSecret },
          'aliceId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 1 of revPubKeyRedeemScript and revPubKeyInputScript should evaluate to false if keys don\'t match', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revPubKeyRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revPubKeyInputScript(
          { channelDestId: 'aliceId', revocationSecret: revocationSecret },
          'aliceId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EVAL_FALSE')
      }, this)
    })

    it('branch 1 of revPubKeyRedeemScript and revPubKeyInputScript should evaluate to false if CSV does', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revPubKeyRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revPubKeyInputScript(
          { channelDestId: 'aliceId', revocationSecret: revocationSecret },
          'aliceId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY.sub(Bn(1)))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME')
      }, this)
    })

    it('branch 2 of revPubKeyRedeemScript and revPubKeyInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revPubKeyRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revPubKeyInputScript(
          { channelDestId: 'aliceId', revocationSecret: revocationSecret },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 2 of revPubKeyRedeemScript and revPubKeyInputScript should evaluate to false if keys don\'t match', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revPubKeyRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revPubKeyInputScript(
          { channelDestId: 'aliceId', revocationSecret: revocationSecret },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_CHECKSIGVERIFY')
      }, this)
    })

    it('branch 2 of revPubKeyRedeemScript and revPubKeyInputScript should evaluate to false if the wrong rev sec is used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revPubKeyRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { revocationSecret: revocationSecret })
        let revocationSecret2 = new RevocationSecret()
        yield revocationSecret2.asyncInitialize()
        let spendingScriptObj = spendingTxObj.revPubKeyInputScript(
          { channelDestId: 'aliceId', revocationSecret: revocationSecret2 },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EVAL_FALSE')
      }, this)
    })
  })

  describe('#htlcRedeemScript', function () {
    it('branch 1 of htlcRedeemScript and htlcInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.htlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret })
        let spendingScriptObj = spendingTxObj.htlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret
          },
          'aliceId')

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          Bn(100))

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 1 of htlcRedeemScript and htlcInputScript should evaluate to false if the wrong keys are used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.htlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret })
        let spendingScriptObj = spendingTxObj.htlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret
          },
          'aliceId')

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Bn(100))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_CHECKSIGVERIFY')
      }, this)
    })

    it('branch 1 of htlcRedeemScript and htlcInputScript should evaluate to false if the wrong htlc secret is', function () {
      return asink(function * () {
        let scriptPubKey = commitment.htlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret })
        let htlcSecret2 = new HtlcSecret()
        yield htlcSecret2.asyncInitialize()
        let spendingScriptObj = spendingTxObj.htlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret2
          },
          'aliceId')

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Bn(100))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_CHECKSIGVERIFY')
      }, this)
    })

    it('branch 2 of htlcRedeemScript and htlcInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.htlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret })
        let spendingScriptObj = spendingTxObj.htlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret
          },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Bn(100))

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 2 of htlcRedeemScript and htlcInputScript should evaluate to false if the wrong keys are used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.htlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret })
        let spendingScriptObj = spendingTxObj.htlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret
          },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Bn(100))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EVAL_FALSE')
      }, this)
    })

    it('branch 2 of htlcRedeemScript and htlcInputScript should evaluate to false if CSV does', function () {
      return asink(function * () {
        let scriptPubKey = commitment.htlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret })
        let spendingScriptObj = spendingTxObj.htlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret
          },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY.sub(Bn(1)))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME')
      }, this)
    })
  })

  describe('#revHtlcInputScript', function () {
    it('branch 1 of revHtlcRedeemScript and revHtlcInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'aliceId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          Bn(100))

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 1 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if wrong keys are used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'aliceId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Bn(100))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_CHECKSIGVERIFY')
      }, this)
    })

    it('branch 1 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if wrong htlc secret is used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let htlcSecret2 = new HtlcSecret()
        yield htlcSecret2.asyncInitialize()

        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret2,
            revocationSecret: revocationSecret
          },
          'aliceId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          Bn(100))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EQUALVERIFY')
      }, this)
    })

    it('branch 1 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if CSV does', function () {
      return asink(function * () {
        let longDelay = Consts.CSV_DELAY
        let shortDelay = longDelay.div(Bn(2))
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'aliceId',
          shortDelay)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          destKeyPair.privKey,
          spendingScriptObj.sigPos,
          shortDelay.sub(Bn(1)))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME')
      }, this)
    })

    it('branch 2 of revHtlcRedeemScript and revHtlcInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Bn(100))

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 2 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if wrong keys are used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Bn(100))

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EVAL_FALSE')
      }, this)
    })

    it('branch 2 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if CSV does', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'bobId',
          Consts.CSV_DELAY)

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY.sub(Bn(1))
        )

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_UNSATISFIED_LOCKTIME')
      }, this)
    })

    it('branch 3 of revHtlcRedeemScript and revHtlcInputScript should evaluate to true', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'bobId',
          Consts.CSV_DELAY.sub(Bn(1)))

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('branch 3 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if the wrong keys are used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret
          },
          'bobId',
          Consts.CSV_DELAY.sub(Bn(1)))

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          new PrivKey().fromRandom(),
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_CHECKSIGVERIFY')
      }, this)
    })

    it('branch 3 of revHtlcRedeemScript and revHtlcInputScript should evaluate to false if the wrong revocationSecret is used', function () {
      return asink(function * () {
        let scriptPubKey = commitment.revHtlcRedeemScript(
          destKeyPair.pubKey,
          sourceKeyPair.pubKey,
          { htlcSecret: htlcSecret, revocationSecret: revocationSecret })

        let revocationSecret2 = new RevocationSecret()
        yield revocationSecret2.asyncInitialize()
        let spendingScriptObj = spendingTxObj.revHtlcInputScript(
          {
            channelDestId: 'aliceId',
            htlcSecret: htlcSecret,
            revocationSecret: revocationSecret2
          },
          'bobId',
          Consts.CSV_DELAY.sub(Bn(1)))

        let {verified, debugString} = TxHelper.interpCheckSig(
          spendingScriptObj.partialScriptSig,
          scriptPubKey,
          sourceKeyPair.privKey,
          spendingScriptObj.sigPos,
          Consts.CSV_DELAY)

        verified.should.equal(false)
        JSON.parse(debugString).errStr.should.equal('SCRIPT_ERR_EVAL_FALSE')
      }, this)
    })
  })
})
