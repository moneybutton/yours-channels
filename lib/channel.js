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

  asyncOpenStep1 () {
  }

  asyncOpenStep2 () {
  }

  asyncClose () {
  }

  asyncReduce () {
  }

  asyncHandleMsgOpen () {
  }

  asyncHandleMsgOpenRes () {
  }

  asyncHandleMsgFundingTx () {
  }

  asyncHandleMsgUpdate () {
  }

  asyncHandleMsgUpdateRes () {
  }

  asyncHandleMsgSecret () {
  }
}

module.exports = Channel
