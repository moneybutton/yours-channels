'use strict'
let Secret = require('./secret.js')
let asink = require('asink')

class RevocationSecret extends Secret {
  constructor () {
    super()
    this.fromObject({})
  }

  asyncCheck (otherSecret) {
    return asink(function *() {
      if (otherSecret) {
        if (!otherSecret.hash || otherSecret.hash.toString('hex') !== this.hash.toString('hex')) {

          //console.log('asyncCheck otherSecret', otherSecret.hash.toString('hex'));
          //console.log('asyncCheck this.hash', this.hash.toString('hex'));
          throw new Error('Provided secret does not match local secret')
        }
      }
      return yield this.asyncSuperCheck()
    }, this)
  }

  toPublic () {
    let secret = new RevocationSecret().fromObject(this)
    secret.buf = undefined
    return secret
  }
}

module.exports = RevocationSecret
