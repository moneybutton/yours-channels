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
}

module.exports = HtlcSecret
