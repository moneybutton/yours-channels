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
                amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret) {
  if (!(this instanceof Agent)) {
    return new Agent(name, privkey, pubkey, address, keypair, other, remoteAgent, multisig, initialized,
                    amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret)
  }
  this.fromObject({name, privkey, pubkey, address, keypair, other, remoteAgent, multisig, initialized,
                  amountFunded, fundingTxhashbuf, fundingTxout, revocationSecret, htlcSecret})
}

Agent.prototype = Object.create(Struct.prototype)
Agent.prototype.constructor = Agent

/* ---- open & fund a channel ---- */

Agent.prototype.asyncInitialize = function (privkey, msPrivkey) {
  return asink(function *() {
    if (!privkey || !msPrivkey || privkey.constructor.name !== 'Privkey' || msPrivkey.constructor.name !== 'Privkey') {
      throw new Error('privkey and msPrivkey must be Privkeys and are required in asyncInitialize')
    }

    // the agents private address
    this.privkey = privkey
    this.pubkey = yield Pubkey().asyncFromPrivkey(this.privkey)
    this.address = yield Address().asyncFromPubkey(this.pubkey)
    this.keypair = yield Keypair().asyncFromPrivkey(this.privkey)

    // the shared multisig address
    this.msPrivkey = msPrivkey
    this.msPubkey = yield Pubkey().asyncFromPrivkey(this.msPrivkey)

    // generate htlc secret
    this.htlcSecret = Secret()
    this.htlcSecret.generateBuf()
    yield this.htlcSecret.asyncGenerateHash()

    // the wallet
    this.wallet = Wallet()

    this.initialized = true
  }, this)
}

Agent.prototype.asyncInitializeOther = function (otherPubkey, otherMsPubkey, otherHtlcSecret) {
  return asink(function *() {
    if (!otherPubkey || !otherMsPubkey || otherPubkey.constructor.name !== 'Pubkey' || otherMsPubkey.constructor.name !== 'Pubkey') {
      throw new Error('otherPubkey and otherMsPubkey must be pubkeys and are required in asyncInitializeOther')
    }
    if (!otherHtlcSecret || otherHtlcSecret.constructor.name !== 'Secret' || otherHtlcSecret.buf) {
      throw new Error('otherHtlcSecret must be a hidden secret in asyncInitializeOther')
    }

    this.other = {}
    this.other.revocationSecrets = []
    this.other.htlcSecret = otherHtlcSecret
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
Agent.prototype.asyncBuildFundingTx = function (amount, inputTxHashbuf, inputTxoutnum, inputTxout, pubkey) {
  return asink(function *() {
    if (!this.initialized) {
      throw new Error('Agent must me initialized before funding transaction can be built')
    }
    if (!this.multisig) {
      throw new Error('Multisig address must be created before funding transaction can be built')
    }

    let txb = Txbuilder()
    txb.fromPubkeyhash(inputTxHashbuf, inputTxoutnum, inputTxout, pubkey)
    txb.setChangeAddress(this.address)
    txb.toAddress(amount, this.multisig.address)
    txb.build()
    txb.sign(0, this.keypair, inputTxout)

    this.amountFunded = amount

    this.fundingTx = txb.tx
    this.fundingTxhashbuf = yield txb.tx.asyncHash()
    this.fundingTxout = yield txb.tx.txouts[0]

    return txb
  }, this)
}

/*
 * The party not funding the channel will need to know the transaction hashes in
 * order to be able to build the refund transaction and then send it to the funder.
 */
Agent.prototype.storeOtherFundingTxHash = function (amount, fundingTxhashbuf, fundingTxout) {
  this.fundingTxhashbuf = fundingTxhashbuf
  this.fundingTxout = fundingTxout
  this.amountFunded = amount
}

/* ---- send a payment ---- */

/*
 * Agent generates a secret a htlc secret and and revocation secret.
 */
Agent.prototype.asyncGenerateRevocationSecret = function () {
  return asink(function *() {
    this.revocationSecret = Secret()
    this.revocationSecret.generateBuf()
    yield this.revocationSecret.asyncGenerateHash()
  }, this)
}

/*
 * Agent stores the hash of other agent's revocation secret. This will allow her
 * to build a commitment transaction that other agent can later revoke.
 */
Agent.prototype.storeOtherRevocationSecret = function (revocationSecret) {
  if (!this.other) {
    throw new Error('asyncInitializeOther must be called before storeOtherSecrets')
  }
  if (!revocationSecret) {
    throw new Error('revocationSecret required when calling storeOtherSecrets')
  }
  if (revocationSecret.buf) {
    throw new Error('revocationSecret should be shared hidden.')
  }
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
    if (!amount.add(amountToOther).eq(this.amountFunded)) {
      throw new Error('amount plus amountToOther should equal amountFunded')
    }

    let script = Scripts.htlc(this)
    let scriptToOther = Scripts.rhtlc(this)
    let txb = Txbuilder()
    txb.fromScripthashMultisig(this.fundingTxhashbuf, 0, this.fundingTxout, this.multisig.script)
    // funder pays the transaction fee
    if (this.funder) {
      txb.setChangeScript(script)
      txb.toScript(amountToOther, scriptToOther)
    } else {
      txb.toScript(amount, script)
      txb.setChangeScript(scriptToOther)
    }
    txb.build()

    this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keypair, this.fundingTx.txouts[0])

    return this.commitmentTxb
  }, this)
}

/*
 * Checks if a commitment trasnaction is built and signed correctly.
 * If so this function signes it so that it can be sent to the other party.
 */
Agent.prototype.asyncAcceptCommitmentTx = function (txb) {
  return asink(function *() {
    this.commitmentTxb = yield txb.asyncSign(0, this.multisig.keypair, this.fundingTxout)
    return this.commitmentTxb
  }, this)
}

/* ---- BUILDING A REFUND TRANSACTION ---- */

/*
 * Builds a refund transaction.
 */
Agent.prototype.asyncBuildRefundTxb = function () {
  return asink(function *() {
    if (!this.amountFunded) {
      throw new Error('asyncBuildFundingTx must be called before asyncBuildRefundTxb')
    }
    let txb = yield this.asyncBuildCommitmentTxb(BN(0), this.amountFunded)
    return txb
  }, this)
}

/* ---- PROTOCOL ---- */

Agent.prototype.asyncOpenChannel = function (amount, otherPubkey, otherMsPubkey, otherHtlcSecret) {
  return asink(function *() {
    if (!amount || !otherPubkey || !otherMsPubkey) {
      throw new Error('amount, otherPubkey, otherMsPubkey required in asyncOpenChannel')
    }

    yield this.asyncInitializeOther(otherPubkey, otherMsPubkey, otherHtlcSecret)
    yield this.asyncBuildMultisig()

    if (!this.funder) {
      yield this.remoteAgent.asyncOpenChannel(amount, this.pubkey, this.msPubkey, this.htlcSecret.hidden())
    } else {
      let fee = BN(20000)
      let output = this.wallet.getUnspentOutput(amount.add(fee), this.pubkey)
      yield this.asyncBuildFundingTx(amount, output.txhashbuf, output.txoutnum, output.txout, output.pubkey, output.inputTxout)
      this.remoteAgent.storeOtherFundingTxHash(amount, this.fundingTxhashbuf, this.fundingTxout)
    }
  }, this)
}

// we assume that both agents have already created fresh secrets
Agent.prototype.asyncSend = function (amount, amountToOther, revocationSecret, txb) {
  return asink(function *() {
    this.other.revocationSecret = revocationSecret
    // build a new commitment transaction and store locally
    yield this.asyncBuildCommitmentTxb(amount, amountToOther)

    if (!this.sender) {
      yield this.remoteAgent.asyncSend(amountToOther, amount, this.revocationSecret.hidden())
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
