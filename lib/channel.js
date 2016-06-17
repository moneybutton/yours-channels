'use strict'
let Struct = require('yours-bitcoin/lib/struct')

class Channel extends Struct {
  constructor (
    chanId,
    myId,
    counterpartyId,
    myXprv,
    counterpartyXpub
  ) {
    super({
      chanId,
      myId,
      counterpartyId,
      myXprv,
      counterpartyXpub
    })
  }

  asyncOpen (bobXPub) {
  }

  asyncClose () {
  }

  asyncSetFundingTx (fundingTx) {
  }

  asyncUpdate (outputDescriptions) {
  }

  asyncReduce () {
  }

  asyncHandleMsgOpen (msgOpen) {
  }

  asyncHandleMsgOpenRes (msgOpenRes) {
  }

  asyncHandleMsgUpdate (msgUpdate) {
  }

  asyncHandleMsgUpdateRes (msgUpdateRes) {
  }

  asyncHandleMsgSecret (msgSecret) {
  }
}

module.exports = Channel
