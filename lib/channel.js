// TODO: All channel properties need to be saved in a database, not in memory,
// so that the state is consistent across tabs and can be synced across
// devices.
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let MsgUpdate = require('./msgs/msg-update')
let RevSecret = require('./scrts/revocation-secret')
let Random = require('yours-bitcoin/lib/random')
let Script = require('yours-bitcoin/lib/script')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let OutputDescription = require('../lib/output-description')
let Commitment = require('../lib/txs/commitment')
let TxOut = require('yours-bitcoin/lib/tx-out')
let asink = require('asink')

class Channel extends Struct {
  constructor (
    fundingAmount,
    myXPrv,
    theirXPub,
    chanPath,
    myChanXPrv,
    theirChanXPub,
    myId,
    theirId,
    state = Channel.STATE_INITIAL,
    multiSigScript,
    multiSigAddr,
    id,
    secrets = [],
    fundingTx,
    fundingTxHash,
    fundingTxConfirmations = 0,
    myCommitments = [],
    theirCommitments = [],
    errStr = ''
  ) {
    super({
      fundingAmount,
      myXPrv,
      theirXPub,
      chanPath,
      myChanXPrv,
      theirChanXPub,
      myId,
      theirId,
      state,
      multiSigScript,
      multiSigAddr,
      id,
      secrets,
      fundingTx,
      fundingTxHash,
      fundingTxConfirmations,
      myCommitments,
      theirCommitments,
      errStr
    })
  }

  asyncInitialize () {
    return asink(function * () {
      if (!this.chanPath) {
        this.randomChanPath()
      }
      this.myChanXPrv = yield this.myXPrv.asyncDerive(this.chanPath)
      this.theirChanXPub = yield this.theirXPub.asyncDerive(this.chanPath)
      this.myId = yield this.myXPrv.toPublic().asyncToString()
      this.theirId = yield this.theirXPub.asyncToString()
      return this.asyncBuildMultiSigAddr()
    }, this)
  }

  static randomIndex () {
    // non-hardened bip 32 path indices can be any 31 bit integer. (the 32nd
    // bit is used to specify the hardening, which is not used here).
    return Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
  }

  static randomChanPath () {
    let x = Channel.randomIndex()
    let y = Channel.randomIndex()
    return `m/${x}/${y}`
  }

  randomChanPath () {
    this.chanPath = Channel.randomChanPath()
    return this
  }

  asyncBuildMultiSigAddr () {
    return asink(function * () {
      let pubKey1 = this.myChanXPrv.pubKey
      let pubKey2 = this.theirChanXPub.pubKey
      let script = Script.fromPubKeys(2, [pubKey1, pubKey2])
      this.multiSigScript = script
      this.multiSigAddr = yield Address.asyncFromRedeemScript(this.multiSigScript)
      this.id = yield this.multiSigAddr.asyncToString()
      return this
    }, this)
  }

  asyncGetId () {
    return this.multiSigAddr.asyncToString()
  }

  asyncNewRevSecret () {
    return asink(function * () {
      let revSecret = new RevSecret()
      yield revSecret.asyncInitialize()
      this.secrets.push(revSecret)
      return revSecret
    }, this)
  }

  asyncOpen (fundingTx, channelSourceIndex = Channel.randomIndex(), channelDestIndex = Channel.randomIndex()) {
    return asink(function * () {
      this.fundingTx = fundingTx // TODO: Validate that funding tx spends to multisig
      this.fundingTxHash = yield fundingTx.asyncHash()
      let revSecret = yield this.asyncNewRevSecret()
      let outputDescription = new OutputDescription().fromObject({
        kind: 'pubKey',
        networkSourceId: this.theirId,
        channelSourceId: this.theirId,
        channelDestId: this.myId,
        networkDestId: this.myId,
        channelSourcePath: `m/0/${channelSourceIndex}`,
        channelDestPath: `m/0/${channelDestIndex}`,
        // htlcSecret, // Not used in refund tx
        revocationSecret: revSecret.toPublic()
        // amount // Left undefined because this is the change output
      })
      let outputDescriptions = [outputDescription]
      return this.asyncUpdate(outputDescriptions)
    }, this)
  }

  /**
   * When the funding transaction is confirmed on the blockchain, call this
   * method.
   */
  asyncConfirmFundingTx (nConfirmations, fundingTx) {
    return asink(function * () {
      if (typeof nConfirmations !== 'number') {
        throw new Error('nConfirmations must be a number')
      }
      this.fundingTx = fundingTx
      this.fundingTxHash = yield fundingTx.asyncHash()
      this.fundingTxConfirmations = nConfirmations
      // TODO: What else?
    }, this)
  }

  asyncBuildCommitment (outputDescriptions, fundingTxHash, fundingTxOut) {
    return asink(function * () {
      let commitment = new Commitment()
      commitment.outputList = outputDescriptions
      let xPubs = {
        [this.myId]: this.myChanXPrv.toPublic(),
        [this.theirId]: this.theirChanXPub.toPublic()
      }
      let keyPair = new KeyPair(this.myChanXPrv.privKey, this.myChanXPrv.pubKey)
      if (fundingTxHash === undefined) {
        fundingTxHash = yield this.fundingTx.asyncHash()
      }
      fundingTxOut = fundingTxOut || this.fundingTx.txOuts[0]
      return commitment.asyncBuild(fundingTxHash, fundingTxOut, {script: this.multiSigScript, keyPair}, this.myId, xPubs)
    }, this)
  }

  asyncUpdate (outputDescriptions) {
    return asink(function * () {
      if (this.state !== Channel.STATE_INITIAL) {
        throw new Error(`Cannot update during ${this.state} state`)
      }
      let commitment = yield this.asyncBuildCommitment(outputDescriptions)
      this.myCommitments.push(commitment)

      let msg = new MsgUpdate()
        .setChanId(this.id)
        .setChanPath(this.chanPath)
        .setCommitment(commitment)
        .setFundingAmount(this.fundingAmount)
      this.state = Channel.STATE_BUILT
      return msg
    }, this)
  }

  asyncHandleMsgUpdate (msgUpdate) {
    return asink(function * () {
      if (this.state === Channel.STATE_INITIAL) {
        // TODO: Check validity
        this.state = Channel.STATE_BUILT_AND_STORED
        let myCommitment = msgUpdate.getCommitment()
        let keyPair = new KeyPair(this.myChanXPrv.privKey, this.myChanXPrv.pubKey)
        let script = this.multiSigAddr.toScript()
        let txOut = TxOut.fromProperties(this.fundingAmount, script)
        yield myCommitment.txb.asyncSign(0, keyPair, txOut)
        this.myCommitments.push(myCommitment)

        let outputDescriptions = myCommitment.outputList
        this.fundingTxHash = myCommitment.txb.tx.txIns[0].txHashBuf
        let fundingTxOut = TxOut.fromProperties(this.fundingAmount, this.multiSigAddr.toScript())
        let theirCommitment = yield this.asyncBuildCommitment(outputDescriptions, this.fundingTxHash, fundingTxOut)
        this.theirCommitments.push(theirCommitment)

        let msg = new MsgUpdate()
          .setChanId(this.id)
          .setChanPath(this.chanPath)
          .setCommitment(theirCommitment)
          .setFundingAmount(this.fundingAmount)
        return msg
      } else if (this.state === Channel.STATE_BUILT) {
        // TODO: Check validity
        this.state = Channel.STATE_STORED
      } else {
        return this.asyncError(`Cannot receive msgUpdate in ${this.state} state`)
      }
    }, this)
  }

  asyncHandleMsgSecret (msgSecret) {
    if (this.state === Channel.STATE_BUILT_AND_STORED) {
      // TODO: Check validity
      this.state = Channel.STATE_INITIAL
    } else if (this.state === Channel.STATE_STORED) {
      // TODO: Check validity
      this.state = Channel.STATE_INITIAL
    } else {
      return this.asyncError(`Cannot receive msgSecret in ${this.state} state`)
    }
  }

  asyncError (errStr) {
    this.state = Channel.STATE_ERROR
    this.errStr = errStr
    // TODO: What now? Close channel?
  }
}

Channel.STATE_INITIAL = 'initial'
Channel.STATE_ERROR = 'error'
Channel.STATE_BUILT_AND_STORED = 'built-and-stored'
Channel.STATE_BUILT = 'built'
Channel.STATE_STORED = 'stored'
Channel.STATE_CLOSED = 'closed'

module.exports = Channel
