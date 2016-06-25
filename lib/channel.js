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
    state = Channel.STATE_NORMAL,
    multiSigAddr,
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
    if (this.state !== Channel.STATE_NORMAL) {
      throw new Error(`Cannot update during ${this.state} state`)
    }
    // let commitmentTxObj = new CommitmentTxObj()
    // asyncBuild (fundingTxb, multisigAddress, builderId, xPubs) {
    let msg = new MsgUpdate()
    msg.setOutputDescriptions(outputDescriptions)
    this.state = Channel.STATE_WAITING_ACTIVE
    return msg
    // TODO: Finish.
  }

  asyncHandleMsgUpdate (msgUpdate) {
    if (this.state === Channel.STATE_NORMAL) {
      // Check validity
      this.state = Channel.STATE_RESPONDING_PASSIVE

      // If this is the first commitment tx:
      // Craft msgSecret
      this.state = Channel.STATE_WAITING_PASSIVE

      // Else if this is not the first commitment tx:
      this.state = Channel.STATE_NORMAL
    } else if (this.state === Channel.STATE_WAITING_ACTIVE) {
      // Check validity

      // If this is the first commitment tx:
      this.state = Channel.STATE_NORMAL

      // Else if this is not the first commitment tx:
      this.state = Channel.STATE_SENDING_ACTIVE
      // Craft msgSecret
      this.state = Channel.STATE_RESPONDING_ACTIVE
    } else {
      return this.asyncError(`Cannot receive msgUpdate in ${this.state} state`)
    }
  }

  asyncHandleMsgSecret (msgSecret) {
    if (this.state === Channel.STATE_WAITING_PASSIVE) {
      // Check validity
      this.state = Channel.STATE_SENDING_PASSIVE
      // Craft msgSecret
      this.state = Channel.STATE_NORMAL
    } else if (this.state === Channel.STATE_RESPONDING_ACTIVE) {
      // Check validity
      this.state = Channel.STATE_NORMAL
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

Channel.STATE_NORMAL = 'normal'
Channel.STATE_ERROR = 'error'
Channel.STATE_WAITING_PASSIVE = 'waiting-passive'
Channel.STATE_RESPONDING_PASSIVE = 'responding-passive'
Channel.STATE_SENDING_PASSIVE = 'sending-passive'
Channel.STATE_WAITING_ACTIVE = 'waiting-active'
Channel.STATE_RESPONDING_ACTIVE = 'responding-active'
Channel.STATE_SENDING_ACTIVE = 'sending-active'
Channel.STATE_CLOSED = 'closed'

module.exports = Channel
