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
let OutputDescription = require('../output-description')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Bn = require('yours-bitcoin/lib/bn')

class MsgUpdate extends Msg {
  constructor (args, chanId) {
    let cmd = 'update'
    super(cmd, args, chanId)
  }

  setOutputDescriptions (outputDescriptions) {
    this.args.outputDescriptions = outputDescriptions.map((outputDescription) => outputDescription.toPublic().toJSON())
    return this
  }

  getOutputDescriptions () {
    return this.args.outputDescriptions.map((json) => OutputDescription.fromJSON(json))
  }

  setCommitmentTxBuilder (commitmentTxBuilder) {
    this.args.commitmentTxBuilder = commitmentTxBuilder.toJSON()
    return this
  }

  getCommitmentTxBuilder () {
    return TxBuilder.fromJSON(this.args.commitmentTxBuilder)
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
