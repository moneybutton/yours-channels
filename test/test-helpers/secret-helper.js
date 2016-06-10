'use strict'
let should = require('should')
let Struct = require('yours-bitcoin/lib/struct')

class SecretsHelper extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  static checkSecretNotHidden (secret) {
    should.exist(secret)
    should.exist(secret.buf)
    should.exist(secret.hash)
  }

  static checkSecretHidden (secret) {
    should.exist(secret)
    should.not.exist(secret.buf)
    should.exist(secret.hash)
  }
}

module.exports = SecretsHelper
