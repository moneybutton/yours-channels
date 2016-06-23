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
    state = 'normal',
    multiSigAddr,
    fundingTx,
    errStr = ''
  ) {
    super({
      myXPrv,
      theirXPub,
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
    // non-hardened bip 32 path indices can be any 31 bit integer. (the 32nd
    // bit is used to specify the hardening, which is not used here).
    let x = Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
    let y = Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
    this.rootPath = `m/${x}/${y}`
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
    if (this.state !== 'normal') {
      throw new Error(`Cannot update during ${this.state} state`)
    }
    let msg = new MsgUpdate()
    msg.setOutputDescriptions(outputDescriptions)
    // TODO: Finish.
  }

  asyncHandleMsgUpdate (msgUpdate) {
    if (this.state === 'normal') {
      // Check validity
      this.state = 'responding-passive'

      // If this is the first commitment tx:
      // Craft msgSecret
      this.state = 'waiting-passive'

      // Else if this is not the first commitment tx:
      this.state = 'normal'
    } else if (this.state === 'waiting-active') {
      // Check validity

      // If this is the first commitment tx:
      this.state = 'normal'

      // Else if this is not the first commitment tx:
      this.state = 'sending-active'
      // Craft msgSecret
      this.state = 'responding-active'
    } else {
      return this.asyncError(`Cannot receive msgUpdate in ${this.state} state`)
    }
  }

  asyncHandleMsgSecret (msgSecret) {
    if (this.state === 'waiting-passive') {
      // Check validity
      this.state = 'sending-passive'
      // Craft msgSecret
      this.state = 'normal'
    } else if (this.state === 'responding-active') {
      // Check validity
      this.state = 'normal'
    } else {
      return this.asyncError(`Cannot receive msgSecret in ${this.state} state`)
    }
  }

  asyncError (errStr) {
    this.state = 'error'
    this.errStr = errStr
    // TODO: What now? Close channel?
  }
}

module.exports = Channel
