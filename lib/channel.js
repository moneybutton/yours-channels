// TODO: All channel properties need to be saved in a database, not in memory,
// so that the state is consistent across tabs and can be synced across
// devices.
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let MsgUpdate = require('./msgs/msg-update')
let RevSecret = require('./scrts/rev-secret')
let Random = require('yours-bitcoin/lib/random')
let Script = require('yours-bitcoin/lib/script')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let Output = require('../lib/output')
let Spending = require('../lib/txs/spending.js')
let Commitment = require('../lib/txs/commitment')
let TxOut = require('yours-bitcoin/lib/tx-out')
let MsgSecrets = require('./msgs/msg-secrets')
let asink = require('asink')

class Channel extends Struct {
  constructor (
    fundingAmount,
    myXPrv,
    theirXPub,
    chanPath,
    myChanXPrv,
    theirChanXPub,
    myId,
    theirId,
    state = Channel.STATE_INITIAL,
    multiSigScript,
    multiSigAddr,
    id,
    secretMap = new Map(),
    funder = false,
    fundingTx,
    fundingTxHash,
    funded = false,
    myCommitments = [],
    theirCommitments = [],
    errStr = ''
  ) {
    super({
      fundingAmount,
      myXPrv,
      theirXPub,
      chanPath,
      myChanXPrv,
      theirChanXPub,
      myId,
      theirId,
      state,
      multiSigScript,
      multiSigAddr,
      id,
      secretMap,
      funder,
      fundingTx,
      fundingTxHash,
      funded,
      myCommitments,
      theirCommitments,
      errStr
    })
  }

  /**
   * Initializes the channel by deriving the channel keys and id's and by
   * building and storing the multisig address
   */
  asyncInitialize () {
    return asink(function * () {
      if (!this.chanPath) {
        this.randomChanPath()
      }
      this.myChanXPrv = yield this.myXPrv.asyncDerive(this.chanPath)
      this.theirChanXPub = yield this.theirXPub.asyncDerive(this.chanPath)
      this.myId = yield this.myXPrv.toPublic().asyncToString()
      this.theirId = yield this.theirXPub.asyncToString()
      return this.asyncBuildMultiSigAddr()
    }, this)
  }

  /**
   * Returns a random number between 0 and 0x7fffffff
   */
  static randomIndex () {
    // non-hardened bip 32 path indices can be any 31 bit integer. (the 32nd
    // bit is used to specify the hardening, which is not used here).
    return Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
  }

  /**
   * Return a random channel path
   */
  static randomChanPath () {
    let x = Channel.randomIndex()
    let y = Channel.randomIndex()
    return `m/${x}/${y}`
  }

  /**
   * Initializes the channel path to a random one
   */
  randomChanPath () {
    this.chanPath = Channel.randomChanPath()
    return this
  }

  /**
   * Builds the multisig address from the agents public keys
   */
  asyncBuildMultiSigAddr () {
    return asink(function * () {
      let pubKey1 = this.myChanXPrv.pubKey
      let pubKey2 = this.theirChanXPub.pubKey
      let script = Script.fromPubKeys(2, [pubKey1, pubKey2])
      this.multiSigScript = script
      this.multiSigAddr = yield Address.asyncFromRedeemScript(this.multiSigScript)
      this.id = yield this.multiSigAddr.asyncToString()
      return this
    }, this)
  }

  /**
   * Returns the channel id, which is the multisig address
   */
  asyncGetId () {
    return this.multiSigAddr.asyncToString()
  }

  /**
   * Generates a new secret and stores it in this.secretMap
   */
  asyncNewRevSecret () {
    return asink(function * () {
      let revSecret = new RevSecret()
      yield revSecret.asyncInitialize()
      this.secretMap.set(revSecret.hash.toString('hex'), revSecret.buf)
      return revSecret
    }, this)
  }

  /**
   * Returns the pre-image of a stored secret
   */
  getSecret (hash) {
    return this.secretMap.get(hash.toString('hex'))
  }

  /**
   * Opens a channel. Sets the funding tx and returns the "update" message
   * for the refund tx.
   */
  asyncOpen (fundingTx, channelSourceIndex = Channel.randomIndex(), channelDestIndex = Channel.randomIndex()) {
    return asink(function * () {
      this.funder = true
      this.fundingTx = fundingTx // TODO: Validate that funding tx spends to multisig
      this.fundingTxHash = yield fundingTx.asyncHash()
      let revSecret = yield this.asyncNewRevSecret()
      let output = new Output().fromObject({
        kind: 'pubKey',
        networkSourceId: this.theirId,
        channelSourceId: this.theirId,
        channelDestId: this.myId,
        networkDestId: this.myId,
        channelSourcePath: `m/0/${channelSourceIndex}`,
        channelDestPath: `m/0/${channelDestIndex}`,
        // htlcSecret, // Not used in refund tx
        revSecret: revSecret.toPublic()
        // amount // Left undefined because this is the change output
      })
      let outputs = [output]
      return this.asyncUpdate(outputs)
    }, this)
  }

  /**
   * When the funding transaction is confirmed on the blockchain, call this
   * method.
   */
  asyncConfirmFundingTx (fundingTx) {
    return asink(function * () {
      this.fundingTx = fundingTx
      this.fundingTxHash = yield fundingTx.asyncHash()
      this.funded = true
    }, this)
  }

  /**
   * Returns a new commitment transaction for a given output description list
   */
  asyncBuildCommitment (outputs, fundingTxHash, fundingTxOut) {
    return asink(function * () {
      let commitment = new Commitment()
      commitment.outputs = outputs
      let xPubs = {
        [this.myId]: this.myChanXPrv.toPublic(),
        [this.theirId]: this.theirChanXPub
      }
      let keyPair = new KeyPair(this.myChanXPrv.privKey, this.myChanXPrv.pubKey)
      // TODO: can this be a default parameter?
      if (fundingTxHash === undefined) {
        fundingTxHash = yield this.fundingTx.asyncHash()
      }
      fundingTxOut = fundingTxOut || this.fundingTx.txOuts[0]

      return commitment.asyncBuild(fundingTxHash, fundingTxOut, {script: this.multiSigScript, keyPair}, this.myId, xPubs)
    }, this)
  }

  asyncBuildSpending (address, commitment, commitmentTxDepth) {
    return asink(function * () {
      // TODO: filter secretMap to contain only secrets relevant to this spending
      let spending = new Spending()
      yield spending.asyncBuild(
        address,
        commitment,
        this.myChanXPrv,
        this.myId,
        commitmentTxDepth,
        this.secretMap)
      return spending
    }, this)
  }

  /**
   * Convenience method to add an additional output to the output description list
   * Returns a message of type "update" with an commitment tx for the list.
   * HtlcSecret is optional.
   */
  asyncPay (amount, htlcSecret, pathIndex = Channel.randomIndex()) {
    return asink(function * () {
      let outputs = this.myCommitments[this.myCommitments.length - 1].outputs
      outputs = outputs.map((output) => output.clone())
      // TODO: Validate that last output spends to me and is change, i.e.
      // TODO: check sufficient balance
      let revSecret = yield this.asyncNewRevSecret()
      let output = new Output().fromObject({
        kind: htlcSecret ? 'htlc' : 'pubKey',
        networkSourceId: this.myId,
        channelSourceId: this.myId,
        channelDestId: this.theirId,
        networkDestId: this.theirId,
        channelSourcePath: `m/0/${pathIndex}`,
        channelDestPath: `m/0/${pathIndex}`,
        htlcSecret: htlcSecret ? htlcSecret.toPublic() : undefined,
        revSecret: revSecret.toPublic(),
        amount: amount
      })
      outputs = yield this.asyncAddPubKeyOutput(output, outputs)
      outputs = yield this.asyncReduceOutputs(outputs)
      return this.asyncUpdate(outputs)
    }, this)
  }

  /**
   * Add output description to outputlist immediately before the change output
   */
  asyncAddPubKeyOutput (output, outputs) {
    outputs = outputs.map((output) => output.clone())
    let change = outputs.pop()
    outputs.push(output)
    outputs.push(change)
    return outputs
  }

  /**
   * Merges outputs whenever possible
   */
  asyncReduceOutputs (outputs) {
    return Promise.resolve(outputs)
  }

  /**
   * Generates a new "update" message for a given output description list.
   * This method is used to activate the protocol for a new payment.
   * TODO: check that channel is funded.
   */
  asyncUpdate (outputs) {
    return asink(function * () {
      if (this.state !== Channel.STATE_INITIAL) {
        throw new Error(`Cannot update during ${this.state} state`)
      }
      let commitment = yield this.asyncBuildCommitment(outputs)
      this.theirCommitments.push(commitment)

      let msg = new MsgUpdate()
        .setChanId(this.id)
        .setChanPath(this.chanPath)
        .setCommitment(commitment)
        .setFundingAmount(this.fundingAmount)
      this.state = Channel.STATE_BUILT
      return msg
    }, this)
  }

  /**
   * Called when a new message of type "update" is received. Signs the tx in the
   * message, stores it in myCommitments. Then builds a commitment tx for the
   * other agent, packs it into a message of type "update" and returns this message
   */
  asyncHandleMsgUpdate (msgUpdate) {
    return asink(function * () {
      if (this.state === Channel.STATE_INITIAL) {
        // TODO: Check validity
        this.state = Channel.STATE_BUILT_AND_STORED
        let myCommitment = msgUpdate.getCommitment()
        let keyPair = new KeyPair(this.myChanXPrv.privKey, this.myChanXPrv.pubKey)
        let script = this.multiSigAddr.toScript()
        let txOut = TxOut.fromProperties(this.fundingAmount, script)
        yield myCommitment.txb.asyncSign(0, keyPair, txOut)
        this.myCommitments.push(myCommitment)

        let outputs = myCommitment.outputs.map((output) => Output.fromJSON(output.toJSON()))
        this.fundingTxHash = myCommitment.txb.tx.txIns[0].txHashBuf
        let fundingTxOut = TxOut.fromProperties(this.fundingAmount, this.multiSigAddr.toScript())
        let theirCommitment = yield this.asyncBuildCommitment(outputs, this.fundingTxHash, fundingTxOut)
        this.theirCommitments.push(theirCommitment)

        let msg = new MsgUpdate()
          .setChanId(this.id)
          .setChanPath(this.chanPath)
          .setCommitment(theirCommitment)
          .setFundingAmount(this.fundingAmount)
        return msg
      } else if (this.state === Channel.STATE_BUILT) {
        // TODO: Check validity
        this.state = Channel.STATE_STORED
        this.myCommitments.push(msgUpdate.getCommitment())
        return this.asyncGetMsgSecrets()
      } else {
        return this.asyncError(`Cannot receive msgUpdate in ${this.state} state`)
      }
    }, this)
  }

  /**
   * Generates a new message of type "secret" containing the revocation secret
   */
  asyncGetMsgSecrets () {
    return asink(function * () {
      // Suppose you have 10 commitment txs.
      // You don't want to revoke the 10th one, but you want to revoke the 9th one.
      // Get revocation hash from 9th commitment tx output description list.
      let msg = new MsgSecrets()
        .setChanId(this.id)
        .setChanPath(this.chanPath)
      if (this.myCommitments.length > 1) {
        let commitment = this.myCommitments[this.myCommitments.length - 2]
        let outputs = commitment.outputs
        let revSecrets = []
        for (let index in outputs) {
          let secret = outputs[index].revSecret
          let buf = this.getSecret(secret.hash)
          if (buf) {
            secret.buf = buf
          }
          revSecrets.push(secret)
        }
        msg.setSecrets(revSecrets)
      }
      return msg
    }, this)
  }

  /**
   * Called when a new message of type "secret" is received
   */
  asyncHandleMsgSecrets (msgSecrets) {
    if (this.state === Channel.STATE_BUILT_AND_STORED) {
      // TODO: Check validity
      this.state = Channel.STATE_INITIAL
      let secrets = msgSecrets.getSecrets()
      if (this.myCommitments.length > 1) {
        // set secrets on commitment
        let commitment = this.myCommitments[this.myCommitments.length - 2]
        commitment.outputs = commitment.outputs.map((output, index) => {
          output.revSecret.buf = output.revSecret.buf || secrets[index].buf
          return output
        })
      }
      return this.asyncGetMsgSecrets()
    } else if (this.state === Channel.STATE_STORED) {
      // TODO: Check validity
      this.state = Channel.STATE_INITIAL
      return null
    } else {
      return this.asyncError(`Cannot receive msgSecret in ${this.state} state`)
    }
  }

  asyncError (errStr) {
    this.state = Channel.STATE_ERROR
    this.errStr = errStr
    // TODO: What now? Close channel?
  }
}

Channel.STATE_INITIAL = 'initial'
Channel.STATE_ERROR = 'error'
Channel.STATE_BUILT_AND_STORED = 'built-and-stored'
Channel.STATE_BUILT = 'built'
Channel.STATE_STORED = 'stored'
Channel.STATE_CLOSED = 'closed'

module.exports = Channel
