'use strict'
let Struct = require('yours-bitcoin/lib/struct')

class Channel extends Struct {
  constructor (
    state,
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
  }

  // For reducing the number of outputs
  asyncReduce () {
  }

  asyncHandleMsgUpdate (msgUpdate) {
  }

  asyncHandleMsgUpdateRes (msgUpdateRes) {
  }

  asyncHandleMsgSecret (msgSecret) {
  }
}

module.exports = Channel
