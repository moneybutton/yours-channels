// TODO: All channel properties need to be saved in a database, not in memory,
// so that the state is consistent across tabs and can be synced across
// devices.
'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let MsgUpdate = require('./msgs/msg-update')
let RevSecret = require('./scrts/revocation-secret')
let Random = require('yours-bitcoin/lib/random')
let Script = require('yours-bitcoin/lib/script')
let Address = require('yours-bitcoin/lib/address')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let OutputDescription = require('../lib/output-description')
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
    secrets = [],
    funder = false,
    fundingTx,
    fundingTxHash,
    fundingTxConfirmations = 0,
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
      secrets,
      funder,
      fundingTx,
      fundingTxHash,
      fundingTxConfirmations,
      myCommitments,
      theirCommitments,
      errStr
    })
  }

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

  static randomIndex () {
    // non-hardened bip 32 path indices can be any 31 bit integer. (the 32nd
    // bit is used to specify the hardening, which is not used here).
    return Random.getRandomBuffer(4).readInt32BE(0) & 0x7fffffff
  }

  static randomChanPath () {
    let x = Channel.randomIndex()
    let y = Channel.randomIndex()
    return `m/${x}/${y}`
  }

  randomChanPath () {
    this.chanPath = Channel.randomChanPath()
    return this
  }

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

  asyncGetId () {
    return this.multiSigAddr.asyncToString()
  }

  asyncNewRevSecret () {
    return asink(function * () {
      let revSecret = new RevSecret()
      yield revSecret.asyncInitialize()
      this.secrets.push(revSecret)
      return revSecret
    }, this)
  }

  asyncGetSecret (hash) {
    return asink(function * () {
      let hashHex = hash.toString('hex')
      // TODO: This is a very inefficient algorithm. It is assumed we will
      // replace this with a database with an index on the hashes before launch.
      for (let i in this.secrets) {
        let secret = this.secrets[i]
        if (hashHex === secret.hash.toString('hex')) {
          return secret
        }
      }
    }, this)
  }

  asyncOpen (fundingTx, channelSourceIndex = Channel.randomIndex(), channelDestIndex = Channel.randomIndex()) {
    return asink(function * () {
      this.funder = true
      this.fundingTx = fundingTx // TODO: Validate that funding tx spends to multisig
      this.fundingTxHash = yield fundingTx.asyncHash()
      let revSecret = yield this.asyncNewRevSecret()
      let outputDescription = new OutputDescription().fromObject({
        kind: 'pubKey',
        networkSourceId: this.theirId,
        channelSourceId: this.theirId,
        channelDestId: this.myId,
        networkDestId: this.myId,
        channelSourcePath: `m/0/${channelSourceIndex}`,
        channelDestPath: `m/0/${channelDestIndex}`,
        // htlcSecret, // Not used in refund tx
        revocationSecret: revSecret.toPublic()
        // amount // Left undefined because this is the change output
      })
      let outputDescriptions = [outputDescription]
      return this.asyncUpdate(outputDescriptions)
    }, this)
  }

  /**
   * When the funding transaction is confirmed on the blockchain, call this
   * method.
   */
  asyncConfirmFundingTx (nConfirmations, fundingTx) {
    return asink(function * () {
      if (typeof nConfirmations !== 'number') {
        throw new Error('nConfirmations must be a number')
      }
      this.fundingTx = fundingTx
      this.fundingTxHash = yield fundingTx.asyncHash()
      this.fundingTxConfirmations = nConfirmations
      // TODO: What else?
    }, this)
  }

  asyncBuildCommitment (outputDescriptions, fundingTxHash, fundingTxOut) {
    return asink(function * () {
      let commitment = new Commitment()
      commitment.outputList = outputDescriptions
      let xPubs = {
        [this.myId]: this.myChanXPrv.toPublic(),
        [this.theirId]: this.theirChanXPub.toPublic()
      }
      let keyPair = new KeyPair(this.myChanXPrv.privKey, this.myChanXPrv.pubKey)
      if (fundingTxHash === undefined) {
        fundingTxHash = yield this.fundingTx.asyncHash()
      }
      fundingTxOut = fundingTxOut || this.fundingTx.txOuts[0]
      return commitment.asyncBuild(fundingTxHash, fundingTxOut, {script: this.multiSigScript, keyPair}, this.myId, xPubs)
    }, this)
  }

  asyncPay (amount, channelSourceIndex = Channel.randomIndex(), channelDestIndex = Channel.randomIndex()) {
    return asink(function * () {
      let outputDescriptions = this.myCommitments[this.myCommitments.length - 1].outputList
      outputDescriptions = outputDescriptions.map((outputDescription) => new OutputDescription().fromJSON(outputDescription.toJSON()))
      // TODO: Validate that last output spends to me and is change, i.e.
      if (this.funder) {
        // TODO: check sufficient balance
        let revSecret = yield this.asyncNewRevSecret()
        let outputDescription = new OutputDescription().fromObject({
          kind: 'pubKey',
          networkSourceId: this.theirId,
          channelSourceId: this.theirId,
          channelDestId: this.myId,
          networkDestId: this.myId,
          channelSourcePath: `m/0/${channelSourceIndex}`,
          channelDestPath: `m/0/${channelDestIndex}`,
          // htlcSecret, // Not used in refund tx
          revocationSecret: revSecret.toPublic(),
          amount: amount
        })
        outputDescriptions = yield this.asyncAddPubKeyOutput(outputDescription, outputDescriptions)
        outputDescriptions = yield this.asyncReduceOutputs(outputDescriptions)
        return this.asyncUpdate(outputDescriptions)
      } else {
        // TODO: Finish later.
      }
    }, this)
  }

  asyncAddPubKeyOutput (outputDescription, outputDescriptions) {
    outputDescriptions = outputDescriptions.map((outputDescription) => new OutputDescription().fromJSON(outputDescription.toJSON()))
    let change = outputDescriptions.pop()
    outputDescriptions.push(outputDescription)
    outputDescriptions.push(change)
    return outputDescriptions
  }

  asyncReduceOutputs (outputDescriptions) {
    return Promise.resolve(outputDescriptions)
  }

  asyncUpdate (outputDescriptions) {
    return asink(function * () {
      if (this.state !== Channel.STATE_INITIAL) {
        throw new Error(`Cannot update during ${this.state} state`)
      }
      let commitment = yield this.asyncBuildCommitment(outputDescriptions)
      this.myCommitments.push(commitment)

      let msg = new MsgUpdate()
        .setChanId(this.id)
        .setChanPath(this.chanPath)
        .setCommitment(commitment)
        .setFundingAmount(this.fundingAmount)
      this.state = Channel.STATE_BUILT
      return msg
    }, this)
  }

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

        let outputDescriptions = myCommitment.outputList
        this.fundingTxHash = myCommitment.txb.tx.txIns[0].txHashBuf
        let fundingTxOut = TxOut.fromProperties(this.fundingAmount, this.multiSigAddr.toScript())
        let theirCommitment = yield this.asyncBuildCommitment(outputDescriptions, this.fundingTxHash, fundingTxOut)
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
        return this.getMsgSecrets()
      } else {
        return this.asyncError(`Cannot receive msgUpdate in ${this.state} state`)
      }
    }, this)
  }

  getMsgSecrets () {
    // Suppose you have 10 commitment txs.
    // You don't want to revoke the 10th one, but you want to revoke the 9th one.
    // Get revocation hash from 9th commitment tx output description list.
    let msg = new MsgSecrets()
      .setChanId(this.id)
      .setChanPath(this.chanPath)
    if (this.myCommitments.length > 1) {
      let commitment = this.myCommitments[this.myCommitments.length - 1]
      let outputDescriptions = commitment.outputList
      let revSecrets = outputDescriptions.map((outputDescription) => outputDescription.revocationSecret)
      msg.setSecrets(revSecrets)
    }
    return msg
  }

  asyncHandleMsgSecrets (msgSecrets) {
    if (this.state === Channel.STATE_BUILT_AND_STORED) {
      // TODO: Check validity
      this.state = Channel.STATE_INITIAL
      return this.getMsgSecrets()
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
