'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let Bn = require('yours-bitcoin/lib/bn')
let TxVerifier = require('yours-bitcoin/lib/tx-verifier')
let Interp = require('yours-bitcoin/lib/interp')
let TxOutMap = require('yours-bitcoin/lib/tx-out-map')

let Multisig = require('./multisig.js')
let Secret = require('./secret.js')
let Wallet = require('./wallet.js')
let KeyPairAddress = require('./key-pair-address.js')
let FundingTxo = require('./txs/funding-txo.js')
let CommitmentTxo = require('./txs/commitment-txo.js')

class Agent extends Struct {
  constructor (name, // name of the agent

              funding, // information about to input of the funding transaction
              spending, // information about to output of the commitment transaction
              multisig,  // information about to input of multisig address

              htlcSecret,  // the most recent htlc secret
              revocationSecret, // the most recent revocation secret

              fundingTxo, // the funding Tx or it's hash
              commitmentTxo, // the most recent commitmentTxo

              wallet, // the wallet (dummy for now)

              remoteAgent, // temporarily used to similate a communication channel with the other agent (will go away)
              other, // information about the other agent

              htlcOutNum, // output number of the htlc script in commitmentTxo
              rhtlcOutNum, // output number of the rhtlc script in commitmentTxo
              htlcRedeemScript, // used to build the tx spending from htlc
              rtlcRedeemScript, // used to build the tx spending from rhtlc

              initialized, // true if agent is initialized
              funder, // true if the agent is fundign the channel
              sender // true if the agent has sent the last transaction
            ) {
    super()
    this.fromObject({name,
                    funding,
                    spending,
                    multisig,
                    htlcSecret,
                    revocationSecret,
                    commitmentTxo,
                    wallet,
                    initialized,
                    remoteAgent,
                    other,
                    funder,
                    sender,
                    htlcOutNum,
                    rhtlcOutNum}
              )
  }

  /* ---- initialization ---- */

  asyncInitialize (fundingPrivKey, multisigPrivKey, spendingPrivKey) {
    return asink(function *() {
      if (!fundingPrivKey || !multisigPrivKey || !spendingPrivKey || fundingPrivKey.constructor.name !== 'PrivKey' || multisigPrivKey.constructor.name !== 'PrivKey' || spendingPrivKey.constructor.name !== 'PrivKey') {
        throw new Error('privKey and msPrivKey must be PrivKeys and are required in asyncInitialize')
      }

      // the address that's the input to the funding trasnaction
      this.funding = new KeyPairAddress()
      yield this.funding.asyncInitialize(fundingPrivKey)

      // the shared multisig address
      this.multisig = new Multisig()
      yield this.multisig.initializePrivKey(multisigPrivKey)

      // the address that's the output to a commitment trasnaction
      this.spending = new KeyPairAddress()
      yield this.spending.asyncInitialize(spendingPrivKey)

      // generate htlc secret (this will be fixed for the duration of the channel)
      this.htlcSecret = new Secret()
      yield this.htlcSecret.asyncInitialize()

      // generate revocation secret (this will be regenerated for every new transaction)
      this.nextRevocationSecret = new Secret()
      yield this.nextRevocationSecret.asyncInitialize()

      // list of past CommitmentTxos
      this.commitmentTxos = []

      // the wallet
      this.wallet = new Wallet()

      this.initialized = true
    }, this)
  }

  /*
   * Stores the other agents public keys and creats a shared multisig address.
   */
  asyncInitializeMultisig () {
    return asink(function *() {
      if (!this.initialized) {
        throw new Error('agent must be initialized before multisig can be built')
      }

      if (!this.other || !this.other.multisig || !this.other.multisig.pubKey) {
        throw new Error('other agent must be initialized before multisig can be built')
      }
      yield this.multisig.asyncInitialize(this.other.multisig.pubKey)
    }, this)
  }

  /* ---- setters ---- */

  /*
   * Checks if a commitment transaction obtained from the other agent is built
   * and signed correctly. If so, sign and stores it.
   * TODO: check redeemScripts
   * TODO: check that outputs are spendale
   */
  asyncCheckCommitmentTxo (commitmentTxo) {
    return asink(function *() {
      yield commitmentTxo.txb.asyncSign(0, this.multisig.keyPair, this.fundingTxo.txb.tx.txOuts[0])

      // check that there is only one input
      if (commitmentTxo.txb.tx.txIns.length !== 1) {
        throw new Error('Commitment transaction can only have one input')
      }

      // check that txOutNum == 0
      if (commitmentTxo.txb.tx.txIns[0].txOutNum !== 0) {
        throw new Error('Commitment transaction spends from non-existing output')
      }

      // check that the right htlc secret has been used
      let commitmentHtlcSecret = commitmentTxo.htlcSecret.hash.toString('hex')
      let myHtlcSecret = this.htlcSecret.hash.toString('hex')
      if (commitmentHtlcSecret !== myHtlcSecret) {
        throw new Error('Invalid htlc secret')
      }

      // check that the right revocation secret has been used
      let commitmentRevocationSecret = commitmentTxo.revocationSecret.hash.toString('hex')
      let myNextRevocationSecret = this.nextRevocationSecret.hash.toString('hex')
      if (commitmentRevocationSecret !== myNextRevocationSecret) {
        throw new Error('Invalid revocation secret')
      }

      // check that the commitment transaction spends from the funding transaction
      let fundingTxHash = this.fundingTxo.txb.tx.hash().toString('hex')
      let commitmentTxInputHash = commitmentTxo.txb.tx.txIns[0].txHashBuf.toString('hex')
      if (fundingTxHash !== commitmentTxInputHash) {
        throw new Error('Commitment transaction does not spend from funding transaction')
      }

      // verify commitment transaction against the funding transaction
      let txOutMap = new TxOutMap()
      txOutMap.addTx(this.fundingTxo.txb.tx)
      let txVerifier = new TxVerifier(commitmentTxo.txb.tx, txOutMap)
      let error = txVerifier.verifyStr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)
      if (error) {
        throw new Error('Commitment transaction does not spend from the funding transaction')
      }

      // if no error was thrown, we return true
      return true
    }, this)
  }

  /*
   * Checks that a revocation secret solution obtained by the other party
   * is an actual solution and stores if so
   */
  checkRevocationSecret (secret) {
    return asink(function *() {
      // check that the provided solution validates
      if (!(yield secret.asyncCheck())) {
        throw new Error('Provided secret does not validate')
      }

      // check that the provided solution matches the stored secret
      let storedRevocationSecret = this.other.commitmentTxos[this.other.commitmentTxos.length - 2].revocationSecret
      if (!secret.hash || secret.hash.toString('hex') !== storedRevocationSecret.hash.toString('hex')) {
        throw new Error('Provided secret does not match local secret')
      }
      return true
    }, this)
  }

  /* ---- protocol ---- */

  asyncOpenChannel (amount, other) {
    return asink(function *() {
      // initialize information about other agent
      this.other = other

      // initialize multisig
      yield this.asyncInitializeMultisig()

      if (this.funder) {
        // the funder will build the funding transaction and cache it's hashbuf
        // and txout
        let fee = Bn(20000)
        let output = this.wallet.getUnspentOutput(amount.add(fee), this.funding.keyPair.pubKey)

        this.fundingTxo = new FundingTxo()
        this.fundingTxo.asyncInitialize(amount, this.funding, this.multisig,
          output.txhashbuf, output.txoutnum, output.txout, output.pubKey)

        // send the funding tx hash to the other agent
        this.remoteAgent.fundingTxo = yield this.fundingTxo.asyncToPublic()
      } else {
        // send your information to the other agent
        let publicThis = yield this.asyncToPublic()
        yield this.remoteAgent.asyncOpenChannel(amount, publicThis)
      }
    }, this)
  }

  /*
   * This will build and sign a commitment transaction over the specified amount.
   * The commitment transaction is then sent to the other party to sign and
   * store. Note that both agents have already created fresh secrets.
   */
  asyncSend (amount, amountToOther, otherRevocationSecret) {
    return asink(function *() {
      // build the commitment tx for the other agent
      let otherCommitmentTxo = new CommitmentTxo()
      yield otherCommitmentTxo.asyncInitialize(amount, amountToOther,
        this.fundingTxo, this.multisig,
        this.spending, this.other.spending,
        this.htlcSecret.toPublic(), this.other.htlcSecret.toPublic(),
        otherRevocationSecret, this.funder)
      this.other.commitmentTxos.push(otherCommitmentTxo)

      if (!this.sender) {
        // ask the other agent to send you a partially signed commitment transaction
        yield this.remoteAgent.asyncSend(amountToOther, amount, this.nextRevocationSecret.toPublic())
      } else {
        // send your partially signed transaction to other agent
        yield this.remoteAgent.asyncSendTxb(this.other.commitmentTxos[this.other.commitmentTxos.length - 1])
      }
    }, this)
  }

  asyncSendTxb (commitmentTxo) {
    return asink(function *() {
      // check the other parties commitment transaction and store it
      if (yield this.asyncCheckCommitmentTxo(commitmentTxo)) {
        // store the solutions to the secrets with the transaction
        commitmentTxo.revocationSecret = this.nextRevocationSecret
        commitmentTxo.htlcSecret = this.htlcSecret
        this.commitmentTxos.push(commitmentTxo)
      }

      // generate revocation secret (this will be regenerated for every new transaction)
      this.nextRevocationSecret = new Secret()
      yield this.nextRevocationSecret.asyncInitialize()

      if (!this.sender) {
        // send your partially signed commitment transaction to the other party
        yield this.remoteAgent.asyncSendTxb(this.other.commitmentTxos[this.other.commitmentTxos.length - 1])
      } else {
        // revoke your last transaction if there was one
        if (this.commitmentTxos.length > 1) {
          let lastCommitmentTxo = this.commitmentTxos[this.commitmentTxos.length - 2]
          yield this.remoteAgent.asyncSendRevocationSecret(lastCommitmentTxo.revocationSecret)
        }
      }
    }, this)
  }

  asyncSendRevocationSecret (revocationSecret) {
    return asink(function *() {
      if (yield this.checkRevocationSecret(revocationSecret)) {
        this.other.commitmentTxos[this.other.commitmentTxos.length - 1].revocationSecret = revocationSecret
      }

      if (!this.sender) {
        // revoke your last transaction
        if (this.commitmentTxos.length > 1) {
          let lastCommitmentTxo = this.commitmentTxos[this.commitmentTxos.length - 2]
          yield this.remoteAgent.asyncSendRevocationSecret(lastCommitmentTxo.revocationSecret)
        }
      }
    }, this)
  }

  /* ---- helpers ---- */

  toJson () {
    let json = {}
    if (this.name && this.name !== undefined) {
      json.name = this.name
    }
    if (this.funding && this.funding !== undefined) {
      json.funding = this.funding.toJson()
    }
    if (this.multisig && this.multisig !== undefined) {
      json.multisig = this.multisig.toJson()
    }
    if (this.spending && this.spending !== undefined) {
      json.spending = this.spending.toJson()
    }
    if (this.htlcSecret && this.htlcSecret !== undefined) {
      json.htlcSecret = this.htlcSecret.toJson()
    }
    if (this.nextRevocationSecret && this.nextRevocationSecret !== undefined) {
      json.nextRevocationSecret = this.nextRevocationSecret.toJson()
    }
    if (this.commitmentTxos && this.commitmentTxos !== undefined) {
      let commitmentTxos = []
      this.commitmentTxos.forEach(function (tx) {
        commitmentTxos.push(tx.toJson())
      })
      json.commitmentTxos = commitmentTxos
    }
    if (this.wallet && this.wallet !== undefined) {
      json.wallet = this.wallet.toJson()
    }
    if (typeof this.initialized !== undefined && this.initialized !== undefined) {
      json.initialized = this.initialized
    }
    if (typeof this.funder !== undefined && this.funder !== undefined) {
      json.funder = this.funder
    }
    if (typeof this.sender !== undefined && this.sender !== undefined) {
      json.sender = this.sender
    }
    if (this.fundingTxo && this.fundingTxo !== 'undefined') {
      json.fundingTxo = this.fundingTxo.toJson()
    }
    // other is omited to prevent an infinite loop
    return json
  }

  fromJson (json) {
    if (json.name) {
      this.name = json.name
    }
    if (json.funding) {
      this.funding = new KeyPairAddress().fromJson(json.funding)
    }
    if (json.multisig) {
      this.multisig = new Multisig().fromJson(json.multisig)
    }
    if (json.spending) {
      this.spending = new KeyPairAddress().fromJson(json.spending)
    }
    if (json.htlcSecret) {
      this.htlcSecret = new Secret().fromJson(json.htlcSecret)
    }
    if (json.nextRevocationSecret) {
      this.nextRevocationSecret = new Secret().fromJson(json.nextRevocationSecret)
    }
    if (typeof json.funder !== undefined) {
      this.funder = json.funder
    }
    if (json.wallet) {
      this.wallet = new Wallet().fromJson(json.wallet)
    }
    if (typeof json.initialized !== undefined) {
      this.initialized = json.initialized
    }
    if (typeof json.sender !== undefined) {
      this.sender = json.sender
    }
    if (json.fundingTxo) {
      this.fundingTxo = new FundingTxo().fromJson(json.fundingTxo)
    }
    if (json.commitmentTxos) {
      let commitmentTxos = []
      json.commitmentTxos.forEach(function (tx) {
        commitmentTxos.push(new FundingTxo().fromJson(tx))
      })
      this.commitmentTxos = commitmentTxos
    }
    return this
  }

  asyncToPublic () {
    return asink(function *() {
      let agent = new Agent().fromObject(this)
      if (this.funding) {
        agent.funding = this.funding.toPublic()
      }
      if (this.multisig) {
        agent.multisig = this.multisig.toPublic()
      }
      if (this.spending) {
        agent.spending = this.spending.toPublic()
      }
      if (this.htlcSecret) {
        agent.htlcSecret = this.htlcSecret.toPublic()
      }
      if (this.nextRevocationSecret) {
        agent.nextRevocationSecret = this.nextRevocationSecret.toPublic()
      }
      if (this.wallet) {
        agent.wallet = this.wallet.toPublic()
      }
      if (this.fundingTxo) {
        agent.fundingTxo = yield this.fundingTxo.asyncToPublic()
      }
      if (this.commitmentTxos) {
        let commitmentTxos = []
        this.commitmentTxos.forEach(function (tx) {
          commitmentTxos.push(tx.toPublic())
        })
        agent.commitmentTxos = commitmentTxos
      }
      return agent
    }, this)
  }

  /* ---- static methods ---- */

  /*
   * Computes the sum of unspent outputs of a transaction that go to a given address.
   */

  static amountSpentToAddress (tx, address) {
    let amount = Bn(0)
    tx.txouts.forEach((el, index) => {
      if (el.script.isScripthashOut()) {
        let scriptbuf = el.script.chunks[1].buf
        let addressbuf = address.hashbuf
        if (!Buffer.compare(scriptbuf, addressbuf)) {
          amount = amount.add(Bn(el.valueBn.toString()))
        }
      } else if (el.script.isPubKeyhashOut()) {
        let scriptbuf = el.script.chunks[2].buf
        let addressbuf = address.hashbuf
        if (!Buffer.compare(scriptbuf, addressbuf)) {
          amount = amount.add(Bn(el.valueBn.toString()))
        }
      }
    })
    return amount
  }
}
module.exports = Agent
