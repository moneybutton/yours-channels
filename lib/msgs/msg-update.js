/**
 * MsgUpdate
 * =========
 *
 * Message to update the commitment transaction. When an agent wishes to make a
 * payment or to update the commitment transaction for any other reason, such
 * as reducing the output list or changing the fee amount, they send an
 * 'update' message.  When an agent sends an update message with a new
 * commitment tx, they expect the other party to also send an update message
 * with a new commitment tx. Then both parties should revoke any old outputs.
 */
'use strict'
let Msg = require('./msg')
let Commitment = require('../../lib/txs/commitment')
let Bn = require('yours-bitcoin/lib/bn')

class MsgUpdate extends Msg {
  constructor (args, chanId) {
    let cmd = 'update'
    super(cmd, args, chanId)
  }

  setCommitment (commitment) {
    this.args.commitment = commitment.toPublic().toJSON()
    return this
  }

  getCommitment () {
    return Commitment.fromJSON(this.args.commitment)
  }

  setAmount (amount) {
    this.args.amount = amount.toString()
    return this
  }

  getAmount () {
    return Bn(this.args.amount)
  }
}

module.exports = MsgUpdate
