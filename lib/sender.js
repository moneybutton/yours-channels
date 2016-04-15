'use strict'
let Struct = require('fullnode/lib/struct')

function Sender (privkey, msPrivkey, otherMsPubkey, otherAddress) {
  if (!(this instanceof Sender)) {
    return new Sender(privkey, msPrivkey, otherMsPubkey, otherAddress);
  }
  this.fromObject({privkey, msPrivkey, otherMsPubkey, otherAddress})
}

Sender.prototype = Object.create(Struct.prototype)
Sender.prototype.constructor = Sender

module.exports = Sender
