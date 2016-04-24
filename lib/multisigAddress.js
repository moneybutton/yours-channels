'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')
let Script = require('fullnode/lib/script')
let Address = require('fullnode/lib/address')
let Keypair = require('fullnode/lib/keypair')

function MultisigAddress (privkey, pubkey, otherPubkey, script, address, keypair) {
  if (!(this instanceof MultisigAddress)) {
    return new MultisigAddress(privkey, pubkey, otherPubkey, script, address, keypair)
  }
  this.fromObject({privkey, pubkey, otherPubkey, script, address, keypair})
}

MultisigAddress.prototype = Object.create(Struct.prototype)
MultisigAddress.prototype.constructor = MultisigAddress

MultisigAddress.prototype.asyncInitialize = function (privkey, pubkey, otherPubkey) {
  return asink(function *() {
    // the multisig address used in the agent
    this.privkey = privkey
    this.pubkeys = [pubkey, otherPubkey]
    this.pubkeys.sort()
    this.script = Script().fromPubkeys(2, this.pubkeys)
    this.address = yield Address().asyncFromRedeemScript(this.script)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // this.otherPubkey = otherPubkey
    // this.otherAddress = yield Address().asyncFromPubkey(this.otherPubkey)

    this.initialized = true
  }, this)
}

module.exports = MultisigAddress
