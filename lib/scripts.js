'use strict'
let Struct = require('fullnode/lib/struct')
// let asink = require('asink')
// let Hash = require('fullnode/lib/hash')
// let Random = require('fullnode/lib/random')

function Scripts (buf, hash) {
  if (!(this instanceof Scripts)) {
    return new Scripts(buf, hash)
  }
  this.fromObject({buf, hash})
}

Scripts.prototype = Object.create(Struct.prototype)
Scripts.prototype.constructor = Scripts

module.exports = Scripts
