'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let MsgUpdate = require('../../lib/msg-update')

class Channel extends Struct {
  constructor (
    state = 'normal',
    multiSigAddr,
    myXprv,
    myXpub,
    yourXpub
  ) {
    super({
      state,
      multiSigAddr,
      myXprv,
      myXpub,
      yourXpub
    })
  }

  asyncSetFundingTx (fundingTx) {
  }

  asyncUpdate (outputDescriptions) {
    let msg = new MsgUpdate()
    msg.setOutputDescriptions(outputDescriptions)
  }

  asyncHandleMsgUpdate (msgUpdate) {
  }

  asyncHandleMsgUpdateRes (msgUpdateRes) {
  }

  asyncHandleMsgSecret (msgSecret) {
  }
}

module.exports = Channel
