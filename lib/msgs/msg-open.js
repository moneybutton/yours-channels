/**
 * MsgOpen
 * =======
 *
 * This is the "open" message and is used to open a channel. This is the first
 * message sent on a channel. It is what you sent when you want to open a
 * channel with someone. It contains your public key for use in the multisig
 * transaction, and the amount of bitcoins you intend to fund the channel with.
 */
'use strict'
let Bn = require('yours-bitcoin/lib/bn')
let PubKey = require('yours-bitcoin/lib/pub-key')
let Msg = require('./msg')

class MsgOpen extends Msg {
  constructor (args, chanId) {
    let cmd = 'open'
    super(cmd, args, chanId)
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

module.exports = MsgOpen
