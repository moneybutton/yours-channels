'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')
let Keypair = require('fullnode/lib/keypair')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
// let BN = require('fullnode/lib/bn')

function Sender (privkey, msPrivkey, otherMsPubkey, otherAddress) {
  if (!(this instanceof Sender)) {
    return new Sender(privkey, msPrivkey, otherMsPubkey, otherAddress)
  }
  this.fromObject({privkey, msPrivkey, otherMsPubkey, otherAddress})
}

Sender.prototype = Object.create(Struct.prototype)
Sender.prototype.constructor = Sender

Sender.prototype.asyncInitialize = function () {
  return asink(function *() {
    // the senders private address
    this.pubkey = Pubkey().fromPrivkey(this.privkey)
    this.address = Address().fromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // the multisig address used in the sender
    this.msPubkey = Pubkey().fromPrivkey(this.msPrivkey)
    let pubkeys = [this.msPubkey, this.otherMsPubkey]
    pubkeys.sort()
    this.msScript = Script().fromPubkeys(2, pubkeys)
    this.msAddress = Address().fromRedeemScript(this.msScript)
    this.msKeypair = yield Keypair().asyncFromPrivkey(this.msPrivkey)
    this.initialized = true
  }, this)
}

module.exports = Sender
