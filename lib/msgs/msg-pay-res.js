'use strict'
/**
 * MsgPayRes
 * =========
 *
 * A response to a 'pay' message (MsgPay). When someone updates the Output
 * Description list and sends a new commitment transaction TxBuilder object,
 * the agent needs to respond with another commitment transaction TxBuilder
 * object. If the agent disagrees about the payment for any reason, an 'error'
 * message (MsgError) is sent, and the channel is closed.
 */
let Msg = require('./msg')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

class MsgPayRes extends Msg {
  constructor (args, chanId) {
    let cmd = 'pay-res'
    super(cmd, args, chanId)
  }

  setCommitmentTxBuilder (commitmentTxBuilder) {
    this.args.commitmentTxBuilder = commitmentTxBuilder.toJSON()
    return this
  }

  getCommitmentTxBuilder () {
    return TxBuilder.fromJSON(this.args.commitmentTxBuilder)
  }
}

module.exports = MsgPayRes
