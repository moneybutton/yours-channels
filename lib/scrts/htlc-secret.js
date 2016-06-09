'use strict'
let Secret = require('./secret.js')
let asink = require('asink')

class HtlcSecret extends Secret {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncCheck (otherSecret) {
    return asink(function *() {
      return yield this.asyncSuperCheck()
    }, this)
  }

  toPublic () {
    let secret = new HtlcSecret().fromObject()
    if (this.hash) {
      secret.hash = this.hash
    }
    return secret
  }
}

module.exports = HtlcSecret
