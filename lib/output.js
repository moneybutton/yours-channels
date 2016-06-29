// just a dummy at this point
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let Bn = require('yours-bitcoin/lib/bn')
let Script = require('yours-bitcoin/lib/script')
let HtlcSecret = require('./scrts/htlc-secret')
let RevSecret = require('./scrts/rev-secret')

class OutputDesc extends Struct {
  constructor (
    kind,
    networkSourceId,
    channelSourceId,
    channelDestId,
    networkDestId,
    channelSourcePath,
    channelDestPath,
    htlcSecret,
    revSecret,
    amount,
    redeemScript
  ) {
    super()
    this.fromObject({
      kind,
      networkSourceId,
      channelSourceId,
      channelDestId,
      networkDestId,
      channelSourcePath,
      channelDestPath,
      htlcSecret,
      revSecret,
      amount,
      redeemScript
    })
  }

  fromJSON (json) {
    this.channelSourcePath = json.channelSourcePath
    this.channelDestPath = json.channelDestPath
    this.networkSourceId = json.networkSourceId
    this.channelSourceId = json.channelSourceId
    this.channelDestId = json.channelDestId
    this.networkDestId = json.networkDestId
    this.kind = json.kind
    this.htlcSecret = json.htlcSecret ? new HtlcSecret().fromJSON(json.htlcSecret) : undefined
    this.revSecret = json.revSecret ? new RevSecret().fromJSON(json.revSecret) : undefined
    this.redeemScript = json.redeemScript ? Script.fromJSON(json.redeemScript) : undefined
    this.amount = json.amount ? new Bn().fromJSON(json.amount) : undefined
    return this
  }

  toPublic () {
    let outputDesc = new OutputDesc()
    outputDesc.channelSourcePath = this.channelSourcePath
    outputDesc.channelDestPath = this.channelDestPath
    outputDesc.networkSourceId = this.networkSourceId
    outputDesc.channelSourceId = this.channelSourceId
    outputDesc.channelDestId = this.channelDestId
    outputDesc.networkDestId = this.networkDestId
    outputDesc.kind = this.kind
    outputDesc.htlcSecret = this.htlcSecret ? this.htlcSecret.toPublic() : undefined
    outputDesc.revSecret = this.revSecret ? this.revSecret.toPublic() : undefined
    outputDesc.amount = this.amount
    return outputDesc
  }
}

module.exports = OutputDesc
