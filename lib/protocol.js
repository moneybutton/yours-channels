'use strict'
let Struct = require('fullnode/lib/struct')
// let asink = require('asink')
// let Script = require('fullnode/lib/script')
// let Pubkey = require('fullnode/lib/pubkey')
// let Address = require('fullnode/lib/address')
// let Keypair = require('fullnode/lib/keypair')

function Protocol (privkey, pubkey, otherPubkey, script, address, keypair) {
  if (!(this instanceof Protocol)) {
    return new Protocol(privkey, pubkey, otherPubkey, script, address, keypair)
  }
  this.fromObject({privkey, pubkey, otherPubkey, script, address, keypair})
}

Protocol.prototype = Object.create(Struct.prototype)
Protocol.prototype.constructor = Protocol

module.exports = Protocol
