'use strict'

let Struct = require('fullnode/lib/struct')

function Sender (privkey) {
  if (!(this instanceof Sender)) {
    return new Sender(privkey)
  }
  this.fromObject({privkey})
}

Sender.prototype = Object.create(Struct.prototype)
Sender.prototype.constructor = Sender

module.exports = Sender
