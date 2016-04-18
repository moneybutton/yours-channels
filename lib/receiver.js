'use strict'
let Struct = require('fullnode/lib/struct')

function Receiver (privkey, msPrivkey, otherMsPubkey, otherAddress) {
  if (!(this instanceof Receiver)) {
    return new Receiver(privkey, msPrivkey, otherMsPubkey, otherAddress)
  }
  this.fromObject({privkey, msPrivkey, otherMsPubkey, otherAddress})
}

Receiver.prototype = Object.create(Struct.prototype)
Receiver.prototype.constructor = Receiver

module.exports = Receiver
