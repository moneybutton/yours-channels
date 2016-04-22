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
// let Hash = require('fullnode/lib/hash')
// let BN = require('fullnode/lib/bn')

function Agent (privkey, msPrivkey) {
  if (!(this instanceof Agent)) {
    return new Agent(privkey, msPrivkey)
  }
  this.fromObject({privkey, msPrivkey})
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

/*
 * Stores the other agents public keys and creats a shared multisig address
 */
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
    this.otherAddress = Address().fromPubkey(this.otherPubkey)

    this.multiSigInitialized = true
  }, this)
}

/*
 * The party funding the channel creates the funding transaction
 */
Agent.prototype.asyncBuildFundingTxb = function (amount, txhashbuf, txoutnum, txout, pubkey) {
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

Agent.prototype.asyncBuildRefundTxb = function () {
  return asink(function *() {
    let txb = yield this.asyncBuildHtlcTxb(BN(0), this.balance)
    return txb
  }, this)
}

/* building a payment */

/*
 * Agent generates a secret that allows her to revoke the transaction later
 */
Agent.prototype.generateRevocationSecret = function () {
  // TODO use better source of randomness that works in node & browser
  this.revocationSecret = new Buffer(Math.random())
  return this.revocationSecret
}

/*
 * Agent stores the hash of other agent's revocation secret.
 * This will allow her to build a commitment transaction that
 * other agent can later revoke.
 */
Agent.prototype.storeOtherRevocationSecretHash = function (hash) {
  this.otherRevocationSecretHash = hash
}

/*
 * Agent generates a HTLC secret that allows her to securly accept payments
 * routed through the hub
 */
Agent.prototype.generateHtlcSecret = function () {
  // TODO use better source of randomness that works in node & browser
  this.htlcSecret = new Buffer(Math.random())
  return this.htlcSecret
}

/*
 * Agent stores the hash of other agent's HTLC secret.
 * She will use this to build a commitment transaction that
 * forces other agent to reveil this secret when he spends it.
 */
Agent.prototype.storeOtherHTLCSecretHash = function (hash) {
  this.otherOtherHTLCSecretHash = hash
}

/*
 * Agent builds and signs a commitment transaction that she later sends to other agent.
 * This is a transaction that other agent will be able to revoke
 */
Agent.prototype.asyncBuildCommitmentTxb = function (amount, script, amountToOther, scriptToOther) {
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

    txb.toScript(amount, script)
    txb.toScript(amountToOther, scriptToOther)
    txb.setChangeAddress(this.address)
    txb.build()

    yield txb.asyncSign(0, this.msKeypair)

    return txb
  }, this)
}

Agent.prototype.asyncBuildHtlcTxb = function (amount, amountToOther) {
  return asink(function *() {
    let script = this.htlcScript()
    let scriptToOther = this.rhtlcScript()
    let txb = yield this.asyncBuildCommitmentTxb(amount, script, amountToOther, scriptToOther)
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

/*
 * this constructs a HTLC where agent can get a payment if she knows the secret
 */
Agent.prototype.htlcScript = function () {
  let script = Script()
    .writeOpcode(Opcode.OP_IF)
      // agent's sig & agent's HTLC secret needed to spend
      .writeBuffer(this.otherPubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_HASH160)
      .writeBuffer(this.otherOtherHTLCSecretHash)
      .writeOpcode(Opcode.OP_EQUALVERIFY)
    .writeOpcode(Opcode.OP_ELSE)
      // otherAgent's sig needed to spend, subject to SVC lock
      .writeBN(BN(100))
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_DROP)
      .writeBuffer(this.pubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
    .writeOpcode(Opcode.OP_ENDIF)
  return script
}

/*
 * this constructs a revocable HTLC to otherAgent can get money if he knows the secret
 */
Agent.prototype.rhtlcScript = function (secret) {
  let script = Script()
    .writeOpcode(Opcode.OP_IF)
      // otherAgent's sig & otherAgent's HTLC secret needed to spend
      .writeBuffer(this.otherPubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_HASH160)
      .writeBuffer(this.otherOtherHTLCSecretHash)
      .writeOpcode(Opcode.OP_EQUALVERIFY)
    .writeOpcode(Opcode.OP_ELSE)
      .writeOpcode(Opcode.OP_IF)
        // agent's sig needed to spend, subject to CSV lock
        .writeBN(BN(100))
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(this.pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
      .writeOpcode(Opcode.OP_ELSE)
        // agents sig & otherAgent's revocation secret needed to spend
        .writeBuffer(this.pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
        .writeOpcode(Opcode.OP_HASH160)
        .writeBuffer(this.otherRevocationSecretHash)
        .writeOpcode(Opcode.OP_EQUALVERIFY)
      .writeOpcode(Opcode.OP_ENDIF)
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
