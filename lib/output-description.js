// just a dummy at this point
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let Bn = require('yours-bitcoin/lib/bn')
let HtlcSecret = require('./scrts/htlc-secret.js')
let RevocationSecret = require('./scrts/revocation-secret.js')

class OutputDescription extends Struct {
  constructor (intermediateDestId, finalDestId, amount, htlcSecret, revocationSecret) {
    super()
    this.fromObject({intermediateDestId, finalDestId, amount, htlcSecret, revocationSecret})
  }

  fromJSON (json) {
    if (json.intermediateDestId) {
      this.intermediateDestId = json.intermediateDestId
    }
    if (json.finalDestId) {
      this.finalDestId = json.finalDestId
    }
    if (json.amount) {
      this.amount = new Bn().fromJSON(json.amount)
    }
    if (json.htlcSecret) {
      this.htlcSecret = new HtlcSecret().fromJSON(json.htlcSecret)
    }
    if (json.revocationSecret) {
      this.revocationSecret = new RevocationSecret().fromJSON(json.revocationSecret)
    }

    return this
  }

  toPublic () {
    let outputDescription = new OutputDescription().fromObject()
    if (this.intermediateDestId) {
      outputDescription.intermediateDestId = this.intermediateDestId
    }
    if (this.finalDestId) {
      outputDescription.finalDestId = this.finalDestId
    }
    if (this.amount) {
      outputDescription.amount = this.amount
    }
    if (this.htlcSecret) {
      outputDescription.htlcSecret = this.htlcSecret.toPublic()
    }
    if (this.revocationSecret) {
      outputDescription.revocationSecret = this.revocationSecret.toPublic()
    }
    return outputDescription
  }
}

module.exports = OutputDescription
