/**
 * MsgPay
 * ======
 *
 * The payment message sends an updated Output Description list and partially
 * signed commitment transction TxBuilder object to the other agent on the
 * channel. Either agent can send a msg-pay at any time, so long as the
 * previous msg-pay (from either party) was accepted. If a msg-pay is accepted,
 * a pay-res message (MsgPayRes) is sent in response.
 */
'use strict'
let Msg = require('./msg')
let OutputDescription = require('../output-description')
let TxBuilder = require('yours-bitcoin/lib/tx-builder')

class MsgPay extends Msg {
  constructor (args, chanId) {
    let cmd = 'pay'
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
}

module.exports = MsgPay
