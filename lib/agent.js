'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')
let BN = require('fullnode/lib/bn')
let Keypair = require('fullnode/lib/keypair')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
let Txbuilder = require('fullnode/lib/txbuilder')
let Opcode = require('fullnode/lib/opcode')
let Hash = require('fullnode/lib/hash')
// let BN = require('fullnode/lib/bn')

function Agent (privkey, msPrivkey, otherAddress) {
  if (!(this instanceof Agent)) {
    return new Agent(privkey, msPrivkey, otherAddress)
  }
  this.fromObject({privkey, msPrivkey, otherAddress})
}

Agent.prototype = Object.create(Struct.prototype)
Agent.prototype.constructor = Agent

Agent.prototype.asyncInitialize = function () {
  return asink(function *() {
    // the agents private address
    this.pubkey = Pubkey().fromPrivkey(this.privkey)
    this.address = Address().fromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    this.initialized = true
  }, this)
}

/* funding the channel */

Agent.prototype.asyncBuildMultisig = function (otherMsPubkey, otherPubkey) {
  return asink(function *() {
    // the multisig address used in the agent
    this.msPubkey = Pubkey().fromPrivkey(this.msPrivkey)
    let pubkeys = [this.msPubkey, otherMsPubkey]
    pubkeys.sort()
    this.msScript = Script().fromPubkeys(2, pubkeys)
    this.msAddress = Address().fromRedeemScript(this.msScript)
    this.msKeypair = yield Keypair().asyncFromPrivkey(this.msPrivkey)

    this.otherPubkey = otherPubkey

    this.multiSigInitialized = true
  }, this)
}

Agent.prototype.asyncBuildFundingTx = function (amount, txhashbuf, txoutnum, txout, pubkey) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before partial funding transaction can be built')
    }
    if (!this.multiSigInitialized) {
      throw new Error('Multisig address must be created before partial funding transaction can be built')
    }

    // build and sign transaction
    let txb = Txbuilder()
    txb.fromPubkeyhash(txhashbuf, txoutnum, txout, pubkey)
    txb.toAddress(amount, this.msAddress)
    txb.setChangeAddress(this.address)
    txb.build()
    yield txb.asyncSign(0, this.keypair)
    this.fundingTx = txb.tx
    this.balance = amount

    return txb
  }, this)
}

Agent.prototype.asyncBuildRefundTx = function () {
  // TODO
}

/* building a payment */

Agent.prototype.generateRevocationSecret = function () {
  // TODO use better source of randomness that works in node & browser
  this.revocationSecret = Math.random()
  return this.revocationSecret
}

Agent.prototype.storeRevocationSecret = function (secret) {
  // TODO use better source of randomness that works in node & browser
  this.otherRevocationSecret = secret
}

Agent.prototype.asyncBuildCommitmentTx = function (amountToOther, script) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before payment transaction can be built')
    }
    if (!this.multiSigInitialized) {
      throw new Error('Multisig address must be created before payment transaction can be built')
    }

    let fundingTxhashbuf = yield this.fundingTx.asyncHash()
    let fundingTxout = yield this.fundingTx.txouts[0]

    // build the transaction
    let txb = Txbuilder()
    txb.fromScripthashMultisig(fundingTxhashbuf, 0, fundingTxout, this.msScript)

    txb.toScript(amountToOther, script)
    txb.setChangeAddress(this.address)
    txb.build()

    yield txb.asyncSign(0, this.msKeypair)

    return txb
  }, this)
}

Agent.prototype.asyncBuildHtlcTx = function (amountToOther) {
  return asink(function *() {
    // TODO use otherRevocationSecret here
    let script = this.htlcScript('this is a secret')
    let txb = yield this.asyncBuildCommitmentTx(amountToOther, script)
    return txb
  }, this)
}

Agent.prototype.asyncAcceptCommitmentTx = function (txb) {
  return asink(function *() {
    // TODO check txb
    yield txb.asyncSign(0, this.msKeypair)
    return txb.tx
  }, this)
}

Agent.prototype.htlcScript = function (secret) {
  let hashbuf = Hash.sha256ripemd160(new Buffer(secret))
  let script = Script()
    .writeOpcode(Opcode.OP_IF)
      .writeBuffer(this.otherPubkey.toBuffer())
      .writeOpcode(Opcode.CHECKSIGVERIFY)
      .writeOpcode(Opcode.OP_HASH160)
      .writeBuffer(hashbuf)
      .writeOpcode(Opcode.OP_EQUALVERIFY)
    .writeOpcode(Opcode.OP_ELSE)
      .writeBN(BN(100))
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_DROP)
      .writeBuffer(this.pubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
    .writeOpcode(Opcode.OP_ENDIF)
  return script
}

/* static methods */

/*
 * compute the sum of unspent outputs of a transaction that
 * go to address
 */
Agent.amountSpentToAddress = function (tx, address) {
  let amount = BN(0)
  tx.txouts.forEach((el, index) => {
    if (el.script.isScripthashOut()) {
      let scriptbuf = el.script.chunks[1].buf
      let addressbuf = address.hashbuf
      if (!Buffer.compare(scriptbuf, addressbuf)) {
        amount = amount.add(BN(el.valuebn.toString()))
      }
    } else if (el.script.isPubkeyhashOut()) {
      let scriptbuf = el.script.chunks[2].buf
      let addressbuf = address.hashbuf
      if (!Buffer.compare(scriptbuf, addressbuf)) {
        amount = amount.add(BN(el.valuebn.toString()))
      }
    }
  })
  return amount
}

module.exports = Agent
