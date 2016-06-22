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
let TxIn = require('yours-bitcoin/lib/tx-in')
let Bn = require('yours-bitcoin/lib/bn')
let Script = require('yours-bitcoin/lib/script')
let OpCode = require('yours-bitcoin/lib/op-code')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let SpendingTxObj = require('../../lib/txs/spending-tx-obj')
let TxHelper = require('../test-helpers/tx-helper')

let bob, carol
let htlcSecret, revocationSecret
let bips, bobBip32, carolBip32
let pubKeyCommitmentTxObj, revPubKeyCommitmentTxObj, htlcCommitmentTxObj, revHtlcCommitmentTxObj
let txVerifier, error
let spendingTxObj, address

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

      bobBip32 = new Bip32().fromRandom()
      carolBip32 = new Bip32().fromRandom()
      bips = {
        bob: bobBip32.toPublic(),
        carol: carolBip32.toPublic()
      }

      spendingTxObj = new SpendingTxObj()
      address = new Address().fromPrivKey(new PrivKey().fromRandom())
    }, this)
  })

  describe('#asyncBuild', function () {
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

    it('build a spending transaction. Case revocable pubKey branch one', function () {
      return asink(function * () {
        let revPubKeyCommitmentTxObj = yield buildRevPubKeyCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, revPubKeyCommitmentTxObj, carolBip32, carol.id)
        txVerifier = new TxVerifier(spendingTxObj.txb.tx, spendingTxObj.txb.uTxOutMap)
        error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
        if (error) {
          console.log(txVerifier.getDebugString())
        }
        error.should.equal(false)
      }, this)
    })

    it('build a spending transaction. Case revocable pubKey branch two', function () {
      return asink(function * () {
        let revPubKeyCommitmentTxObj = yield buildRevPubKeyCommitmentTxObj()
        yield spendingTxObj.asyncBuild(address, revPubKeyCommitmentTxObj, bobBip32, bob.id)
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
        yield spendingTxObj.asyncBuild(address, htlcCommitmentTxObj, bobBip32, bob.id)
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
    it('concatenation of pubKeyRedeemScript and pubKeyInputScript should evaluate to true', function () {
      return asink(function * () {
        let keyPair = new KeyPair().fromRandom()
        let commitmentTxObj = new CommitmentTxObj()
        let scriptPubKey = commitmentTxObj.pubKeyRedeemScript(keyPair.pubKey)

        let outputObject = {
          channelDestId: 'aliceId'
        }
        let builderId = 'aliceId'
        let spendingScriptObj = spendingTxObj.pubKeyInputScript(outputObject, builderId)
        let scriptSig = spendingScriptObj.partialScriptSig
        let sigPos = spendingScriptObj.sigPos

        let {verified, debugString} = TxHelper.interpCheckSig(scriptSig, scriptPubKey, keyPair.privKey, sigPos, TxIn.SEQUENCE_FINAL)

        if (!verified) {
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })

    it('concatenation of pubKeyRedeemScript and pubKeyInputScript should evaluate to true, p2sh version', function () {
      return asink(function * () {
        let keyPair = new KeyPair().fromRandom()
        let redeemScript = new Script()
          .writeBuffer(keyPair.pubKey.toBuffer())
          .writeOpCode(OpCode.OP_CHECKSIG)
        let scriptPubKey = Address.fromRedeemScript(redeemScript).toScript()

        let partialScriptSig = new Script()
          .writeOpCode(OpCode.OP_FALSE)   // signature will go here
        let sigPos = 0
        // let scriptSig = commitmentTxObj.toP2shInput(partialScriptSig, redeemScript)
        let scriptSig = Script.fromBuffer(partialScriptSig.toBuffer()).writeBuffer(redeemScript.toBuffer())

        let {verified, debugString} = TxHelper.interpCheckSig(scriptSig, scriptPubKey, keyPair.privKey, sigPos, TxIn.SEQUENCE_FINAL, redeemScript)

        if (!verified) {
          console.log('pubKey:', keyPair.pubKey.toString())
          console.log('pre-scriptSig:', scriptSig.toString())
          console.log('scriptPubKey:', scriptPubKey.toString())
          console.log('redeemScript:', redeemScript.toString())
          console.log(debugString)
        }
        verified.should.equal(true)
      }, this)
    })
  })
})
