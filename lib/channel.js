// TODO: All channel properties need to be saved in a database, not in memory,
// so that the state is consistent across tabs and can be synced across
// devices.
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let MsgUpdate = require('../../lib/msg-update')

class Channel extends Struct {
  constructor (
    state = 'normal',
    multiSigAddr,
    myXprv,
    myXpub,
    theirXpub,
    fundingTx,
    errStr = ''
  ) {
    super({
      state,
      multiSigAddr,
      myXprv,
      myXpub,
      theirXpub,
      fundingTx,
      errStr
    })
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
