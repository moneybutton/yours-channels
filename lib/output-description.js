// just a dummy at this point
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let Bn = require('yours-bitcoin/lib/bn')
let HtlcSecret = require('./scrts/htlc-secret')
let RevocationSecret = require('./scrts/revocation-secret')

class OutputDescription extends Struct {
  constructor (intermediateDestId, finalDestId, htlcSecret, revocationSecret, amount) {
    super()
    this.fromObject({intermediateDestId, finalDestId, htlcSecret, revocationSecret, amount})
  }

  fromJSON (json) {
    this.intermediateDestId = json.intermediateDestId
    this.finalDestId = json.finalDestId
    this.amount = json.amount ? new Bn().fromJSON(json.amount) : undefined
    this.htlcSecret = json.htlcSecret ? new HtlcSecret().fromJSON(json.htlcSecret) : undefined
    this.revocationSecret = json.revocationSecret ? new RevocationSecret().fromJSON(json.revocationSecret) : undefined
    return this
  }

  toPublic () {
    let outputDescription = new OutputDescription()
    outputDescription.intermediateDestId = this.intermediateDestId
    outputDescription.finalDestId = this.finalDestId
    outputDescription.amount = this.amount
    outputDescription.htlcSecret = this.htlcSecret ? this.htlcSecret.toPublic() : undefined
    outputDescription.revocationSecret = this.revocationSecret ? this.revocationSecret.toPublic() : undefined
    return outputDescription
  }
}

module.exports = OutputDescription
