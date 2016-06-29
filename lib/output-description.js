// just a dummy at this point
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let Bn = require('yours-bitcoin/lib/bn')
let Script = require('yours-bitcoin/lib/script')
let HtlcSecret = require('./scrts/htlc-secret')
let RevocationSecret = require('./scrts/revocation-secret')

class OutputDescription extends Struct {
  constructor (
    kind,
    networkSourceId,
    channelSourceId,
    channelDestId,
    networkDestId,
    channelSourcePath,
    channelDestPath,
    htlcSecret,
    revocationSecret,
    amount,
    redeemScript) {
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
      revocationSecret,
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
    this.revocationSecret = json.revocationSecret ? new RevocationSecret().fromJSON(json.revocationSecret) : undefined
    this.redeemScript = json.redeemScript ? Script.fromJSON(json.redeemScript) : undefined
    this.amount = json.amount ? new Bn().fromJSON(json.amount) : undefined
    return this
  }

  toPublic () {
    let outputDescription = new OutputDescription()
    outputDescription.channelSourcePath = this.channelSourcePath
    outputDescription.channelDestPath = this.channelDestPath
    outputDescription.networkSourceId = this.networkSourceId
    outputDescription.channelSourceId = this.channelSourceId
    outputDescription.channelDestId = this.channelDestId
    outputDescription.networkDestId = this.networkDestId
    outputDescription.kind = this.kind
    outputDescription.htlcSecret = this.htlcSecret ? this.htlcSecret.toPublic() : undefined
    outputDescription.revocationSecret = this.revocationSecret ? this.revocationSecret.toPublic() : undefined
    outputDescription.amount = this.amount
    return outputDescription
  }
}

module.exports = OutputDescription
