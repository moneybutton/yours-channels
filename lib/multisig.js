'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')
let Script = require('fullnode/lib/script')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Keypair = require('fullnode/lib/keypair')

function Multisig (privkey, pubkey, otherPubkey, script, address, keypair) {
  if (!(this instanceof Multisig)) {
    return new Multisig(privkey, pubkey, otherPubkey, script, address, keypair)
  }
  this.fromObject({privkey, pubkey, otherPubkey, script, address, keypair})
}

Multisig.prototype = Object.create(Struct.prototype)
Multisig.prototype.constructor = Multisig

Multisig.prototype.asyncInitialize = function (privkey, otherPubkey) {
  return asink(function *() {
    if (!privkey || !otherPubkey || privkey.constructor.name !== 'Privkey' || otherPubkey.constructor.name !== 'Pubkey') {
      throw new Error('privkey and otherPubkey required to build a multisig')
    }
    this.privkey = privkey
    this.otherPubkey = otherPubkey
    this.pubkey = yield Pubkey().asyncFromPrivkey(this.privkey)
    this.pubkeys = [this.pubkey, this.otherPubkey]
    this.pubkeys.sort()

    this.script = Script().fromPubkeys(2, this.pubkeys)
    this.address = yield Address().asyncFromRedeemScript(this.script)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    this.initialized = true
  }, this)
}

module.exports = Multisig
