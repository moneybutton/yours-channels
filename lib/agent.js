'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')
let BN = require('fullnode/lib/bn')
let Keypair = require('fullnode/lib/keypair')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
// let Script = require('fullnode/lib/script')
let Txbuilder = require('fullnode/lib/txbuilder')
// let Opcode = require('fullnode/lib/opcode')
// let Random = require('fullnode/lib/random')
// let Hash = require('fullnode/lib/hash')
// let BN = require('fullnode/lib/bn')

let Multisig = require('./multisig.js')
let Secret = require('./secret.js')
let Scripts = require('./scripts.js')

function Agent (privkey, pubkey, address, keypair,
                other, multisig, initialized,
                balance, fundingTxhashbuf, fundingTxout,
                revocationSecret, htlcSecret) {
  if (!(this instanceof Agent)) {
    return new Agent(privkey, pubkey, address, keypair,
                    other, multisig, initialized,
                    balance, fundingTxhashbuf, fundingTxout,
                    revocationSecret, htlcSecret)
  }
  this.fromObject({privkey, pubkey, address, keypair,
                  other, multisig, initialized,
                  balance, fundingTxhashbuf, fundingTxout,
                  revocationSecret, htlcSecret})
}

Agent.prototype = Object.create(Struct.prototype)
Agent.prototype.constructor = Agent

Agent.prototype.asyncInitialize = function (privkey, otherPubkey) {
  return asink(function *() {
    // the agents private address
    this.privkey = privkey
    this.pubkey = yield Pubkey().asyncFromPrivkey(this.privkey)
    this.address = yield Address().asyncFromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // the other agents private Address
    this.other = {}
    this.other.pubkey = otherPubkey
    this.other.address = yield Address().asyncFromPubkey(this.other.pubkey)

    this.initialized = true
  }, this)
}

/* ---- FUNDING THE CHANNEL ---- */

/*
 * Stores the other agents public keys and creats a shared multisig address.
 */
Agent.prototype.asyncBuildMultisig = function (msPrivkey, otherMsPubkey) {
  return asink(function *() {
    this.multisig = new Multisig()
    yield this.multisig.asyncInitialize(msPrivkey, otherMsPubkey)
  }, this)
}

/*
 * Creates the funding transaction.
 */
Agent.prototype.asyncBuildFundingTx = function (amount, txhashbuf, txoutnum, txout, pubkey) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before funding transaction can be built')
    }
    if (!this.multisig) {
      throw new Error('Multisig address must be created before funding transaction can be built')
    }

    // build and sign transaction
    let txb = Txbuilder()
    txb.fromPubkeyhash(txhashbuf, txoutnum, txout, pubkey)
    txb.toAddress(amount, this.multisig.address)
    txb.setChangeAddress(this.address)
    txb.build()
    yield txb.asyncSign(0, this.keypair)
//    this.fundingTx = txb.tx
    this.balance = amount

    this.fundingTxhashbuf = yield txb.tx.asyncHash()
    this.fundingTxout = yield txb.tx.txouts[0]

    return txb.tx
  }, this)
}

/*
 * The party not funding the channel will need to know the transaction hashes in
 * order to be able to build the refund transaction and then send it to the funder.
 */
Agent.prototype.asyncStoreOtherFundingTxHash = function (fundingTxhashbuf, fundingTxout) {
  this.fundingTxhashbuf = fundingTxhashbuf
  this.fundingTxout = fundingTxout
}

/* ---- BUILDING A PAYMENT ---- */

/*
 * Agent generates a secret that allows her to revoke the transaction later.
 */
Agent.prototype.generateRevocationSecret = function () {
  this.revocationSecret = Secret()
  this.revocationSecret.generateBuf()
}

/*
 * Agent stores the hash of other agent's revocation secret. This will allow her
 * to build a commitment transaction that other agent can later revoke.
 */
Agent.prototype.storeOtherRevocationSecret = function (secret) {
  if (!this.other) {
    throw new Error('Agent must be initialized before otherRevocationSecretHash can be stored')
  }
  this.other.revocationSecret = secret
}

/*
 * Agent generates a HTLC secret that allows her to securly accept payments
 * routed through the hub.
 */
Agent.prototype.generateHtlcSecret = function () {
  this.htlcSecret = Secret()
  this.htlcSecret.generateBuf()
}

/*
 * Agent stores the hash of other agent's HTLC secret.
 * She will use this to build a commitment transaction that
 * forces other agent to reveil this secret when he spends it.
 */
Agent.prototype.storeOtherHTLCSecret = function (secret) {
  if (!this.other) {
    throw new Error('Agent must be initialized before otherHTLCSecretHashs can be stored')
  }
  this.other.htlcSecret = secret
}

/*
 * Agent builds and signs a commitment transaction that she later sends to other agent.
 * This is a transaction that other agent will be able to revoke.
 */
Agent.prototype.asyncBuildCommitmentTxb = function (amount, script, amountToOther, scriptToOther) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before payment transaction can be built')
    }
    if (!this.multisig) {
      throw new Error('Multisig address must be created before payment transaction can be built')
    }

    let txb = Txbuilder()
    txb.fromScripthashMultisig(this.fundingTxhashbuf, 0, this.fundingTxout, this.multisig.script)
    txb.toScript(amount, script)
    txb.toScript(amountToOther, scriptToOther)
    txb.setChangeAddress(this.address)
    txb.build()
    yield txb.asyncSign(0, this.multisig.keypair)

    return txb
  }, this)
}

/*
 * Builds a HTLC trasnaction, that is a spechial commitment transaction that
 * requires receiver to know a secret to spend the fundingTxhashbuf.
 */
Agent.prototype.asyncBuildHtlcTxb = function (amount, amountToOther) {
  return asink(function *() {
    let script = Scripts.htlc(this)
    let scriptToOther = Scripts.rhtlc(this)
    let txb = yield this.asyncBuildCommitmentTxb(amount, script, amountToOther, scriptToOther)
    return txb
  }, this)
}

/*
 * Checks if a commitment trasnaction is built and signed correctly.
 * If so this function signes it so that it can be sent to the other party.
 */
Agent.prototype.asyncAcceptCommitmentTx = function (txb) {
  return asink(function *() {
    // TODO check txb
    yield txb.asyncSign(0, this.multisig.keypair)
    return txb.tx
  }, this)
}

/* ---- BUILDING A REFUND TRANSACTION ---- */

/*
 * Builds a refund transaction.
 */
Agent.prototype.asyncBuildRefundTxb = function () {
  return asink(function *() {
    if (!this.balance) {
      throw new Error('asyncBuildFundingTx must be called before asyncBuildRefundTxb')
    }
    let txb = yield this.asyncBuildHtlcTxb(BN(0), this.balance)
    return txb
  }, this)
}

/* ---- STATIC METHODS ---- */

/*
 * Computes the sum of unspent outputs of a transaction that go to a given address.
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
