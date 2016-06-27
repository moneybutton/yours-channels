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
let OutputDescription = require('../lib/output-description')
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
    multiSigAddr,
    chanId,
    secrets = [],
    fundingTx,
    fundingTxHash,
    fundingTxConfirmations = 0,
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
      multiSigAddr,
      chanId,
      secrets,
      fundingTx,
      fundingTxHash,
      fundingTxConfirmations,
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

  static randomChanPath () {
    // non-hardened bip 32 path indices can be any 31 bit integer. (the 32nd
    // bit is used to specify the hardening, which is not used here).
    let x = Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
    let y = Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
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
      this.multiSigAddr = yield Address.asyncFromRedeemScript(script)
      this.chanId = yield this.multiSigAddr.asyncToString()
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

  asyncOpen (fundingTx) {
    return asink(function * () {
      this.fundingTx = fundingTx // TODO: Validate that funding tx spends to multisig
      this.fundingTxHash = yield fundingTx.asyncHash()
      let revSecret = yield this.asyncNewRevSecret()
      let outputDescription = new OutputDescription().fromObject({
        kind: 'pubKey',
        networkSourceId: this.myId,
        channelSourceId: this.myId,
        channelDestId: this.myId,
        networkDestId: this.myId,
        channelSourcePath: 'm/0', // TODO: Use different path
        channelDestPath: 'm/0', // TODO: Use different path
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

  /**
   * When a commitment tx is confirmed on the blockchain, call this method.
   */
  asyncConfirmCommitmentTx (commitmentTx) {
  }

  asyncUpdate (outputDescriptions) {
    if (this.state !== Channel.STATE_INITIAL) {
      throw new Error(`Cannot update during ${this.state} state`)
    }
    // let commitmentTxObj = new CommitmentTxObj()
    // asyncBuild (fundingTxb, multisigAddress, builderId, xPubs) {
    let msg = new MsgUpdate()
    msg.setChanId(this.chanId)
    msg.setChanPath(this.chanPath)
    msg.setOutputDescriptions(outputDescriptions)
    this.state = Channel.STATE_BUILT
    return msg
    // TODO: Finish.
  }

  asyncHandleMsgUpdate (msgUpdate) {
    if (this.state === Channel.STATE_INITIAL) {
    // Check validity
      this.state = Channel.STATE_BUILT_AND_STORED
    } else if (this.state === Channel.STATE_BUILT) {
      // Check validity
      this.state = Channel.STATE_STORED
    } else {
      return this.asyncError(`Cannot receive msgUpdate in ${this.state} state`)
    }
  }

  asyncHandleMsgSecret (msgSecret) {
    if (this.state === Channel.STATE_BUILT_AND_STORED) {
      // Check validity
      this.state = Channel.STATE_INITIAL
    } else if (this.state === Channel.STATE_STORED) {
      // Check validity
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
