// TODO: All channel properties need to be saved in a database, not in memory,
// so that the state is consistent across tabs and can be synced across
// devices.
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let MsgUpdate = require('./msgs/msg-update')
let Random = require('yours-bitcoin/lib/random')
let Script = require('yours-bitcoin/lib/script')
let Address = require('yours-bitcoin/lib/address')
let asink = require('asink')

class Channel extends Struct {
  constructor (
    myXPrv,
    theirXPub,
    rootPath,
    myXPrvRoot,
    theirXPubRoot,
    state = Channel.STATE_NORMAL,
    multiSigAddr,
    fundingTx,
    errStr = ''
  ) {
    super({
      myXPrv,
      theirXPub,
      rootPath,
      myXPrvRoot,
      theirXPubRoot,
      state,
      multiSigAddr,
      fundingTx,
      errStr
    })
  }

  asyncInitialize () {
    return asink(function * () {
      if (!this.rootPath) {
        this.randomRootPath()
      }
      this.myXPrvRoot = yield this.myXPrv.asyncDerive(this.rootPath)
      this.theirXPubRoot = yield this.theirXPub.asyncDerive(this.rootPath)
      return this.asyncBuildMultiSigAddr()
    }, this)
  }

  randomRootPath () {
    this.rootPath = Channel.randomRootPath()
    return this
  }

  static randomRootPath () {
    // non-hardened bip 32 path indices can be any 31 bit integer. (the 32nd
    // bit is used to specify the hardening, which is not used here).
    let x = Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
    let y = Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
    return `m/${x}/${y}`
  }

  asyncBuildMultiSigAddr () {
    return asink(function * () {
      let pubKey1 = this.myXPrvRoot.pubKey
      let pubKey2 = this.theirXPubRoot.pubKey
      let script = Script.fromPubKeys(pubKey1, pubKey2)
      this.multiSigAddr = Address.asyncFromRedeemScript(script)
      return this
    }, this)
  }

  asyncConfirmFundingTx (fundingTx) {
    this.fundingTx = fundingTx
    // TODO: What else?
  }

  asyncUpdate (outputDescriptions) {
    if (this.state !== Channel.STATE_NORMAL) {
      throw new Error(`Cannot update during ${this.state} state`)
    }
    let msg = new MsgUpdate()
    msg.setOutputDescriptions(outputDescriptions)
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

Channel.STATE_NORMAL = 0
Channel.STATE_ERROR = 1
Channel.STATE_WAITING_PASSIVE = 2
Channel.STATE_RESPONDING_PASSIVE = 3
Channel.STATE_SENDING_PASSIVE = 4
Channel.STATE_WAITING_ACTIVE = 5
Channel.STATE_RESPONDING_ACTIVE = 6
Channel.STATE_SENDING_ACTIVE = 7
Channel.STATE_CLOSED = 8

module.exports = Channel
