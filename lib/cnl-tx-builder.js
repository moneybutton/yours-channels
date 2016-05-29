'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Sig = require('yours-bitcoin/lib/sig')
// let Hash = require('yours-bitcoin/lib/hash')

let Scripts = require('./scripts.js')

class CnlTxBuilder extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  static asyncBuildFundingTx (amount, source, multisig, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
    return asink(function *() {
      if (!amount || !source || !multisig || !inputTxHashbuf || typeof inputTxoutnum !== 'number' || !inputTxout || !pubKey) {
        throw new Error('Insuficient arguments for asyncBuildFundingTx')
      }

      let txb = new TxBuilder()
      txb.inputFromPubKeyHash(inputTxHashbuf, inputTxoutnum, inputTxout, pubKey)
      txb.setChangeAddress(source.address)
      txb.outputToAddress(amount, multisig.address)
      txb.build()
      txb.sign(0, source.keyPair, inputTxout)

      return txb
    }, this)
  }

  /*
   * Agent builds and signs a commitment transaction that she later sends to other agent.
   * This is a transaction that other agent will be able to revoke.
   */
  static asyncBuildCommitmentTxo (amount, amountToOther, spending, fundingTx, multisig, otherAgent, htlcSecret, funder) {
    return asink(function *() {
      if (!amount || !amountToOther || !spending || !fundingTx || !multisig || !otherAgent || !htlcSecret) {
        throw new Error('Insuficient arguments for asyncBuildCommitmentTxo')
      }

      let htlcRedeemScript = Scripts.htlc(spending.keyPair.pubKey, otherAgent.pubKey, htlcSecret)
      let htlcScriptPubkey = yield Scripts.asyncToP2shOutput(htlcRedeemScript)

      let rhtlcRedeemScript = Scripts.rhtlc(spending.keyPair.pubKey, otherAgent.pubKey, otherAgent.htlcSecret, otherAgent.revocationSecrets)
      let rhtlcScriptPubkey = yield Scripts.asyncToP2shOutput(rhtlcRedeemScript)

      let txb = new TxBuilder()

      txb.inputFromScriptHashMultiSig(fundingTx.txb.tx.hash(), 0, fundingTx.txb.tx.txOuts[0], multisig.script)
      // funder pays the transaction fee
      // note that the changeScript will always be on the last output
      let htlcOutNum, rhtlcOutNum
      if (funder) {
        txb.outputToScript(amountToOther, rhtlcScriptPubkey)
        txb.setChangeScript(htlcScriptPubkey)
        htlcOutNum = 1
        rhtlcOutNum = 0
      } else {
        txb.outputToScript(amount, htlcScriptPubkey)
        txb.setChangeScript(rhtlcScriptPubkey)
        htlcOutNum = 0
        rhtlcOutNum = 1
      }
      txb.build()
      let commitmentTxb = yield txb.asyncSign(0, multisig.keyPair, fundingTx.txb.tx.txOuts[0])

      return {
        txb: commitmentTxb,
        htlcOutNum: htlcOutNum,
        rhtlcOutNum: rhtlcOutNum,
        htlcRedeemScript: htlcRedeemScript,
        rhtlcRedeemScript: rhtlcRedeemScript
      }
    }, this)
  }

/*
  static asyncBuildRefundTxb () {
    return asink(function *() {
      return yield CnlTxBuilder
        .asyncBuildCommitmentTxo(Bn(0), this.source.amount, this.spending, this.source, this.multisig, this.other, this.htlcSecret, this.funder)
    }, this)
  }
*/
  /*
   * Builds a transaction that spends from the commitment transaction.
   * Requires payee to present their htlc secret.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncBuildSpendingTx (commitmentTx, redeemScript, spending, htlcSecret, rhtlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder
        .asyncBuild(spending, commitmentTx, Scripts.spendFromRhtlc(htlcSecret), redeemScript, 1, rhtlcOutNum)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Requires payee to present their htlc secret.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncBuildOtherSpendingTx (commitmentTx, redeemScript, spending, htlcSecret, htlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder
        .asyncBuild(spending, commitmentTx, Scripts.spendFromHtlc(htlcSecret), redeemScript, 1, htlcOutNum)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction,
   * in case that the othere party did not present his htlc secret on time.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncBuildHtlcEnforcementTx (commitmentTx, redeemScript, spending, htlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder.asyncBuild(spending, commitmentTx, Scripts.enforceFromHtlc(), redeemScript, 0, htlcOutNum)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction,
   * in case that the othere party did not present his htlc secret on time.
   * Used if the other agent published the commitment transaction
   * This is branch 2.2.2 in the picture
   */
  static asyncBuildOtherHtlcEnforcementTx (commitmentTx, spending, rhtlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder
        .asyncBuild(spending, commitmentTx, Scripts.enforceFromRhtlc(), 0, rhtlcOutNum)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Requires payee to present their htlc secret.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncSpendRevokedCommitmentTx (commitmentTx, otherAgent, spending, revocationSecret, rhtlcOutNum) {
    return asink(function *() {
      let revocationSecrets = otherAgent.revocationSecrets
      let revocationSecret = revocationSecrets[revocationSecrets.length - 1]
      return yield CnlTxBuilder
        .asyncBuild(spending, commitmentTx, Scripts.revokeRhtlc(revocationSecret), 1, rhtlcOutNum)
    }, this)
  }

  /*
   * Used to build spending transactions in which spend from non-standard outputs
   * like htlc or rhtlc. Conveniance function that all spending transactions call
   */
  static asyncBuild (spending, commitmentTx, partialScriptSig, redeemScript, sigPos, txoutnum) {
    return asink(function *() {
      let txhashbuf = commitmentTx.hash()
      let txb = new TxBuilder()
      let txout = commitmentTx.txOuts[txoutnum]

      txb.setVersion(2)
      let txseqnum = 100

      // build the input script
      let scriptSig = Scripts.toP2shInput(partialScriptSig, redeemScript)
      txb.inputFromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      txb.setChangeAddress(spending.address)
      txb.build()

      // console.log('input script signed with pubKey', spending.keyPair.pubKey.toString('hex'))

      // sign the input script
      let subScript = commitmentTx.txOuts[txoutnum].script
      let sig = txb.getSig(spending.keyPair, Sig.SIGHASH_ALL, 0, subScript)
      scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
      txb.tx.txIns[0].setScript(scriptSig)

      // console.log()
      // console.log('input script:', scriptSig.toString());

      // console.log();
      // console.log('output script:', subScript.toString());

      // redeemScript = Script.fromBuffer(scriptSig.chunks[2].buf)
      // let redeemScriptHash = yield Hash.asyncSha256Ripemd160(redeemScript.toBuffer())

      // console.log();
      // console.log('redeem script:', redeemScript.toString());

      // console.log();
      // console.log('redeem script hash:', redeemScriptHash.toString('hex'));

      return txb
    }, this)
  }
}

module.exports = CnlTxBuilder
