'use strict'
let Struct = require('yours-bitcoin/lib/struct')

class Channel extends Struct {
  constructor (
    multiSigAddr,
    myXprv,
    myXpub,
    counterpartyXpub
  ) {
    super({
      multiSigAddr,
      myXprv,
      myXpub,
      counterpartyXpub
    })
  }

  asyncSetFundingTx (fundingTx) {
  }

  asyncUpdate (outputDescriptions) {
  }

  // For reducing the number of outputs
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
