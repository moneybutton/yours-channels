'use strict'
let Bn = require('yours-bitcoin/lib/bn')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Msg = require('./msg')

class MsgOpenChannel extends Msg {
  constructor (args = {}) {
    let cmd = 'open-channel'
    super(cmd, args)
  }

  /**
   * This person's public key which is to be used to generate the multisig
   * address for the funding transaction.
   */
  setPubKey (pubKey) {
    this.args.pubKey = pubKey.toHex()
  }

  /**
   * This is asynchronous because converting a pubkey from a hex string is a
   * blocking operation since it requires point multiplication.
   */
  asyncGetPubKey () {
    return PubKey.asyncFromHex(this.args.pubKey)
  }

  /**
   * amount: Bn, the quantity of satoshis channel is to be funded with
   */
  setAmount (amount) {
    this.args.amount = amount.toString()
  }

  getAmount () {
    return Bn(this.args.amount)
  }
}

module.exports = MsgOpenChannel
