/* global describe,it,beforeEach */
'use strict'
let should = require('should')
let asink = require('asink')
let OutputDescription = require('../../lib/output-description')
let CommitmentTxObj = require('../../lib/txs/commitment-tx-obj')
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
let bips, bobBip32, carolBip32
let pubKeyCommitmentTxObj, revPubKeyCommitmentTxObj, htlcCommitmentTxObj, revHtlcCommitmentTxObj
let txVerifier, error
let spendingTxObj, commitmentTxObj
let destKeyPair, sourceKeyPair, address

let buildPubKeyCommitmentTxObj = function () {
  return asink(function * () {
    // to build a transaction with pubKey outputs we must make sure that the
    // builder (carol) is the channel destination
    pubKeyCommitmentTxObj = new CommitmentTxObj()
    pubKeyCommitmentTxObj.outputList = [
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
    yield pubKeyCommitmentTxObj.asyncBuild(
      carol.fundingTxObj.txb,
      carol.multisigAddress,
      carol.id, // builder id
      bips)
    yield pubKeyCommitmentTxObj.txb.asyncSign(0, bob.multisigAddress.keyPair, bob.fundingTxObj.txb.tx.txOuts[0])
    return pubKeyCommitmentTxObj
  }, this)
}

let buildRevPubKeyCommitmentTxObj = function () {
  return asink(function * () {
    // to build a transaction with _revocable_ htlc outputs we
    // must make sure that the
    // builder (carol) is _not_ the channel destination
    revPubKeyCommitmentTxObj = new CommitmentTxObj()
    revPubKeyCommitmentTxObj.outputList = [
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
    yield revPubKeyCommitmentTxObj.asyncBuild(
      bob.fundingTxObj.txb,
      bob.multisigAddress,
      bob.id, // builder id
      bips)
    yield revPubKeyCommitmentTxObj.txb.asyncSign(0, carol.multisigAddress.keyPair, carol.fundingTxObj.txb.tx.txOuts[0])
    return revPubKeyCommitmentTxObj
  }, this)
}

let buildHtlcCommitmentTxObj = function () {
  return asink(function * () {
    // to build a transaction with htlc outputs we must make sure that the
    // builder (carol) is the channel destination
    htlcCommitmentTxObj = new CommitmentTxObj()
    htlcCommitmentTxObj.outputList = [
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
    yield htlcCommitmentTxObj.asyncBuild(
      carol.fundingTxObj.txb,
      carol.multisigAddress,
      carol.id, // builder id
      bips)
    yield htlcCommitmentTxObj.txb.asyncSign(0, bob.multisigAddress.keyPair, bob.fundingTxObj.txb.tx.txOuts[0])
    return htlcCommitmentTxObj
  }, this)
}

let buildRevHtlcCommitmentTxObj = function () {
  return asink(function * () {
    // to build a transaction with _revocable_ htlc outputs we
    // must make sure that the
    // builder (carol) is _not_ the channel destination
    revHtlcCommitmentTxObj = new CommitmentTxObj()
    revHtlcCommitmentTxObj.outputList = [
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
    yield revHtlcCommitmentTxObj.asyncBuild(
      bob.fundingTxObj.txb,
      bob.multisigAddress,
      bob.id, // builder id
      bips)
    yield revHtlcCommitmentTxObj.txb.asyncSign(0, carol.multisigAddress.keyPair, carol.fundingTxObj.txb.tx.txOuts[0])
    return revHtlcCommitmentTxObj
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
      bips = {
        bob: bobBip32.toPublic(),
        carol: carolBip32.toPublic()
      }

      commitmentTxObj = new CommitmentTxObj()
      spendingTxObj = new SpendingTxObj()
      address = new Address().fromPrivKey(new PrivKey().fromRandom())
    }, this)
  })

  describe('#asyncBuild', function () {
    // Case: pubKey
    it('build a spending transaction. Case pubKey', function () {
      return asink(function * () {
        let pubKeyCommitmentTxObj = yield buildPubKeyCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, pubKeyCommitmentTxObj, carolBip32, carol.id)
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
          let pubKeyCommitmentTxObj = yield buildPubKeyCommitmentTxObj()
          yield spendingTxObj.asyncBuild(address, pubKeyCommitmentTxObj, bobBip32, carol.id)
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
      }, this)
    })

    // Case: revocable pubKey

    it('build a spending transaction. Case revocable pubKey branch one', function () {
      return asink(function * () {
        let revPubKeyCommitmentTxObj = yield buildRevPubKeyCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, revPubKeyCommitmentTxObj, carolBip32, carol.id, Bn(100))
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it.skip('build a spending transaction. Case revocable pubKey branch one, should fail with wrong pubKey', function () {
      return asink(function * () {
        try {
          let revPubKeyCommitmentTxObj = yield buildRevPubKeyCommitmentTxObj()
          yield spendingTxObj.asyncBuild(address, revPubKeyCommitmentTxObj, bobBip32, carol.id)
          true.should.equal(false)
        } catch (err) {
          err.message.should.equal('no spendable outputs found')
        }
      }, this)
    })

    it('build a spending transaction. Case revocable pubKey branch two', function () {
      return asink(function * () {
        let revPubKeyCommitmentTxObj = yield buildRevPubKeyCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, revPubKeyCommitmentTxObj, carolBip32, carol.id, Bn(100))
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
        let htlcCommitmentTxObj = yield buildHtlcCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, htlcCommitmentTxObj, carolBip32, carol.id)
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
        let htlcCommitmentTxObj = yield buildHtlcCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, htlcCommitmentTxObj, bobBip32, bob.id, Bn(100))
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
        let revHtlcCommitmentTxObj = yield buildRevHtlcCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, revHtlcCommitmentTxObj, carolBip32, carol.id)
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
        let revHtlcCommitmentTxObj = yield buildRevHtlcCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, revHtlcCommitmentTxObj, bobBip32, bob.id)
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
        let scriptPubKey = commitmentTxObj.pubKeyRedeemScript(destKeyPair.pubKey)
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
        let scriptPubKey = commitmentTxObj.pubKeyRedeemScript(destKeyPair.pubKey)
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
        let scriptPubKey = commitmentTxObj.revPubKeyRedeemScript(
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
        let scriptPubKey = commitmentTxObj.revPubKeyRedeemScript(
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
        let scriptPubKey = commitmentTxObj.revPubKeyRedeemScript(
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
        let scriptPubKey = commitmentTxObj.revPubKeyRedeemScript(
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
        let scriptPubKey = commitmentTxObj.revPubKeyRedeemScript(
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
        let scriptPubKey = commitmentTxObj.revPubKeyRedeemScript(
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
        let scriptPubKey = commitmentTxObj.htlcRedeemScript(
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
        let scriptPubKey = commitmentTxObj.htlcRedeemScript(
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
        let scriptPubKey = commitmentTxObj.htlcRedeemScript(
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
  })
})
