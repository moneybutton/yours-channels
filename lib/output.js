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
    revocable,
    redeemScript,
    scriptPubkey
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
      revocable,
      redeemScript,
      scriptPubkey
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
    this.amount = json.amount ? new Bn().fromJSON(json.amount) : undefined
    this.revocable = json.revocable
    this.redeemScript = json.redeemScript ? Script.fromJSON(json.redeemScript) : undefined
    this.scriptPubkey = json.scriptPubkey ? Script.fromJSON(json.scriptPubkey) : undefined
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
    outputDesc.revocable = this.revocable
    outputDesc.redeemScript = this.redeemScript ? this.redeemScript.toJSON() : undefined
    outputDesc.scriptPubkey = this.scriptPubkey ? this.scriptPubkey.toJSON() : undefined
    return outputDesc
  }
}

module.exports = OutputDesc
