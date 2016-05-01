'use strict'
let Struct = require('fullnode/lib/struct')
let asink = require('asink')

let BN = require('fullnode/lib/bn')
let Keypair = require('fullnode/lib/keypair')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Txbuilder = require('fullnode/lib/txbuilder')

let Multisig = require('./multisig.js')
let Secret = require('./secret.js')
let Scripts = require('./scripts.js')
let Wallet = require('./wallet.js')

function Agent (name, privkey, pubkey, address, keypair, other, remoteAgent, multisig, initialized,
                balance, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret) {
  if (!(this instanceof Agent)) {
    return new Agent(name, privkey, pubkey, address, keypair, other, remoteAgent, multisig, initialized,
                    balance, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret)
  }
  this.fromObject({name, privkey, pubkey, address, keypair, other, remoteAgent, multisig, initialized,
                  balance, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret})
}

Agent.prototype = Object.create(Struct.prototype)
Agent.prototype.constructor = Agent

/* ---- open & fund a channel ---- */

Agent.prototype.asyncInitialize = function (privkey, msPrivkey) {
  return asink(function *() {
    if (!privkey || !msPrivkey) {
      throw new Error('privkey and msPrivkey required in asyncInitialize')
    }

    // the agents private address
    this.privkey = privkey
    this.pubkey = yield Pubkey().asyncFromPrivkey(this.privkey)
    this.address = yield Address().asyncFromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // the shared multisig address
    this.msPrivkey = msPrivkey
    this.msPubkey = yield Pubkey().asyncFromPrivkey(this.msPrivkey)

    // the wallet
    this.wallet = Wallet()

    this.initialized = true
  }, this)
}

Agent.prototype.asyncInitializeOther = function (otherPubkey, otherMsPubkey) {
  return asink(function *() {
    if (!otherPubkey || !otherMsPubkey) {
      throw new Error('otherPubkey and otherMsPubkey required in asyncInitializeOther')
    }

    this.other = {}
    this.other.revocationSecrets = []
    this.other.pubkey = otherPubkey
    this.other.address = yield Address().asyncFromPubkey(this.other.pubkey)

    this.other.msPubkey = otherMsPubkey

    this.other.initialized = true
  }, this)
}

/*
 * Stores the other agents public keys and creats a shared multisig address.
 */
Agent.prototype.asyncBuildMultisig = function () {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('agent must be initialized before multisig can be built')
    }
    if (!this.other || !this.other.initialized) {
      throw new Error('other agent must be initialized before multisig can be built')
    }
    this.multisig = new Multisig()
    yield this.multisig.asyncInitialize(this.msPrivkey, this.other.msPubkey)
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
    this.balance = amount

    this.fundingTx = txb.tx
    this.fundingTxhashbuf = yield txb.tx.asyncHash()
    this.fundingTxout = yield txb.tx.txouts[0]

    return txb.tx
  }, this)
}

/*
 * The party not funding the channel will need to know the transaction hashes in
 * order to be able to build the refund transaction and then send it to the funder.
 */
Agent.prototype.storeOtherFundingTxHash = function (fundingTxhashbuf, fundingTxout) {
  this.fundingTxhashbuf = fundingTxhashbuf
  this.fundingTxout = fundingTxout
}

/* ---- send a payment ---- */

/*
 * Agent generates a secret a htlc secret and and revocation secret.
 */
Agent.prototype.asyncGenerateSecrets = function () {
  return asink(function *() {
    this.revocationSecret = Secret()
    this.revocationSecret.generateBuf()
    yield this.revocationSecret.asyncGenerateHash()

    this.htlcSecret = Secret()
    this.htlcSecret.generateBuf()
    yield this.htlcSecret.asyncGenerateHash()
  }, this)
}

/*
 * Agent stores the hash of other agent's revocation secret. This will allow her
 * to build a commitment transaction that other agent can later revoke.
 */
Agent.prototype.storeOtherSecrets = function (htlcSecret, revocationSecret) {
  if (!this.other) {
    throw new Error('asyncInitializeOther must be called before storeOtherSecrets')
  }
  if (!htlcSecret || !revocationSecret) {
    throw new Error('htlcSecret, revocationSecret required when calling storeOtherSecrets')
  }
  if (htlcSecret.buf || revocationSecret.buf) {
    throw new Error('WARNING: secrets should be shared hidden.')
  }
  this.other.htlcSecret = htlcSecret
  this.other.revocationSecret = revocationSecret
}

/*
 * Agent builds and signs a commitment transaction that she later sends to other agent.
 * This is a transaction that other agent will be able to revoke.
 */
Agent.prototype.asyncBuildCommitmentTxb = function (amount, amountToOther) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before payment transaction can be built')
    }
    if (!this.multisig) {
      throw new Error('Multisig address must be created before payment transaction can be built')
    }

    let script = Scripts.htlc(this)
    let scriptToOther = Scripts.rhtlc(this)
    let txb = Txbuilder()
    txb.fromScripthashMultisig(this.fundingTxhashbuf, 0, this.fundingTxout, this.multisig.script)
    txb.toScript(amount, script)
    txb.toScript(amountToOther, scriptToOther)
    txb.setChangeAddress(this.address)
    txb.build()
    this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keypair)

    return this.commitmentTxb
  }, this)
}

/*
 * Checks if a commitment trasnaction is built and signed correctly.
 * If so this function signes it so that it can be sent to the other party.
 */
Agent.prototype.checkCommitmentTx = function (txb) {
  return asink(function *() {
    // TODO check txb
    return true
  }, this)
}

/*
 * Checks if a commitment trasnaction is built and signed correctly.
 * If so this function signes it so that it can be sent to the other party.
 */
Agent.prototype.asyncAcceptCommitmentTx = function (txb) {
  return asink(function *() {
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
    let txb = yield this.asyncBuildCommitmentTxb(BN(0), this.balance)
    return txb
  }, this)
}

/* ---- PROTOCOL ---- */

Agent.prototype.asyncOpenChannel = function (amount, otherPubkey, otherMsPubkey) {
  return asink(function *() {
    if (!amount || !otherPubkey || !otherMsPubkey) {
      throw new Error('amount, otherPubkey, otherMsPubkey required in asyncOpenChannel')
    }

    yield this.asyncInitializeOther(otherPubkey, otherMsPubkey)
    yield this.asyncBuildMultisig()

    if (!this.funder) {
      yield this.remoteAgent.asyncOpenChannel(amount, this.pubkey, this.msPubkey)
    } else {
      let output = this.wallet.getUnspentOutput(amount, this.address)
      yield this.asyncBuildFundingTx(amount, output.txhashbuf, output.txoutnum, output.txout, output.pubkey)
      this.remoteAgent.storeOtherFundingTxHash(this.fundingTxhashbuf, this.fundingTxout)
    }
  }, this)
}

// we assume that both agents have already created fresh secrets
Agent.prototype.asyncInitPayment = function (revocationSecret, htlcSecret, amount, amountToOther) {
  return asink(function *() {
    this.other.revocationSecret = revocationSecret
    this.other.htlcSecret = htlcSecret
    // build a new commitme transaction and store locally
    yield this.asyncBuildCommitmentTxb(amount, amountToOther)

    if (!this.sender) {
      yield this.remoteAgent.asyncInitPayment(this.revocationSecret.hidden(), this.htlcSecret.hidden(), amount, amountToOther)
    } else {
      yield this.remoteAgent.asyncSendTxb(this.commitmentTxb)
    }
  }, this)
}

Agent.prototype.asyncSendTxb = function (txb) {
  return asink(function *() {
    let tx = yield txb.asyncSign(0, this.multisig.keypair)
    let bool = yield this.checkCommitmentTx(tx)

    if (bool) {
      this.commitmentTx = tx
      if (!this.sender) {
        yield this.remoteAgent.asyncSendTxb(this.commitmentTxb)
      } else {
        yield this.remoteAgent.asyncSendRevocationSecret(this.revocationSecret)
      }
    }
  }, this)
}

Agent.prototype.asyncSendRevocationSecret = function (revocationSecret) {
  return asink(function *() {
    this.other.revocationSecrets.push(revocationSecret)
    if (!this.sender) {
      yield this.remoteAgent.asyncSendRevocationSecret(this.revocationSecret)
    }
  }, this)
}
/* ---- STATIC METHODS ---- */

/*
 * Computes the sum of unspent outputs of a transaction that go to a given address.
 */
/*
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
*/
module.exports = Agent
