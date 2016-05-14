'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')

let TxBuilder = require('yours-bitcoin/lib/tx-builder')
let Sig = require('yours-bitcoin/lib/sig')
let Bn = require('yours-bitcoin/lib/bn')

let Scripts = require('./scripts.js')

class CnlTxBuilder extends Struct {
  constructor () {
    super()
    this.fromObject({})
  }

  static asyncBuildFundingTx (amount, funding, multisig, inputTxHashbuf, inputTxoutnum, inputTxout, pubKey) {
    return asink(function *() {
      if (!amount || !funding || !multisig || !inputTxHashbuf || typeof inputTxoutnum !== 'number' || !inputTxout || !pubKey) {
        throw new Error('Insuficient arguments for asyncBuildFundingTx')
      }

      let txb = new TxBuilder()
      txb.inputFromPubKeyHash(inputTxHashbuf, inputTxoutnum, inputTxout, pubKey)
      txb.setChangeAddress(funding.address)
      txb.outputToAddress(amount, multisig.address)
      txb.build()
      txb.sign(0, funding.keyPair, inputTxout)

      return txb
    }, this)
  }

  /*
   * Agent builds and signs a commitment transaction that she later sends to other agent.
   * This is a transaction that other agent will be able to revoke.
   */
  static asyncBuildCommitmentTxb (amount, amountToOther, spending, funding, multisig, otherAgent, htlcSecret, funder) {
    return asink(function *() {
      if (!amount || !amountToOther || !spending || !funding || !multisig || !otherAgent || !htlcSecret) {
        throw new Error('Insuficient arguments for asyncBuildCommitmentTxb')
      }

      let htlcScript = Scripts.htlc(spending.keyPair.pubKey, otherAgent.pubKey, htlcSecret)
      let rhtlcScript = Scripts.rhtlc(spending.keyPair.pubKey, otherAgent.pubKey, otherAgent.htlcSecret, otherAgent.revocationSecrets)

      let txb = new TxBuilder()

      txb.inputFromScriptHashMultiSig(funding.txb.tx.hashbuf, 0, funding.txb.tx.txOuts[0], multisig.script)
      // funder pays the transaction fee
      // note that the changeScript will always be on the last output
      let htlcOutNum, rhtlcOutNum
      if (funder) {
        txb.outputToScript(amountToOther, rhtlcScript)
        txb.setChangeScript(htlcScript)
        htlcOutNum = 1
        rhtlcOutNum = 0
      } else {
        txb.outputToScript(amount, htlcScript)
        txb.setChangeScript(rhtlcScript)
        htlcOutNum = 0
        rhtlcOutNum = 1
      }
      txb.build()
      let commitmentTxb = yield txb.asyncSign(0, multisig.keyPair, funding.txb.tx.txOuts[0])

      return {txb: commitmentTxb, htlcOutNum: htlcOutNum, rhtlcOutNum: rhtlcOutNum}
    }, this)
  }

  static asyncBuildRefundTxb () {
    return asink(function *() {
      return yield CnlTxBuilder.asyncBuildCommitmentTxb(Bn(0), this.amountFunded, this.spending, this.funding, this.multisig, this.other, this.htlcSecret, this.funder)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Requires payee to present their htlc secret.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncBuildSpendingTx (commitmentTx, spending, htlcSecret, rhtlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder.buildNonStandardTx(spending, commitmentTx, Scripts.spendFromRhtlc(htlcSecret), 1, rhtlcOutNum)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction.
   * Requires payee to present their htlc secret.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncBuildOtherSpendingTx (commitmentTx, spending, htlcSecret, htlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder.buildNonStandardTx(spending, commitmentTx, Scripts.spendFromHtlc(htlcSecret), 1, htlcOutNum)
    }, this)
  }

  /*
   * Builds a transaction that spends from the commitment transaction,
   * in case that the othere party did not present his htlc secret on time.
   * Used if the agent himself published the commitment transaction.
   * This is branch 1.1.2 in the picture
   */
  static asyncBuildHtlcEnforcementTx (commitmentTx, spending, htlcOutNum) {
    return asink(function *() {
      return yield CnlTxBuilder.buildNonStandardTx(spending, commitmentTx, Scripts.enforceFromHtlc(), 0, htlcOutNum)
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
      return yield CnlTxBuilder.buildNonStandardTx(spending, commitmentTx, Scripts.enforceFromRhtlc(), 0, rhtlcOutNum)
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
      return yield CnlTxBuilder.buildNonStandardTx(spending, commitmentTx, Scripts.revokeRhtlc(revocationSecret), 1, rhtlcOutNum)
    }, this)
  }

  /* Used to build spending transactions in which spend from non-standard outputs
   * like htlc or rhtlc. Conveniance function that all spending transactions call
   */
  static buildNonStandardTx (spending, commitmentTx, scriptSig, sigPos, txoutnum) {
    return asink(function *() {
      let txhashbuf = commitmentTx.hash()
      let txb = new TxBuilder()
      // txoutnum should be 0 if this.funder and 1 otherwise
      // let txoutnum = this.funder ? 0 : 1
      let txout = commitmentTx.txOuts[txoutnum]

      txb.setVersion(2)
      let txseqnum = 100

      txb.inputFromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      txb.setChangeAddress(spending.address)
      txb.build()

      let subScript = commitmentTx.txOuts[txoutnum].script
      let sig = txb.getSig(spending.keyPair, Sig.SIGHASH_ALL, 0, subScript)

      scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
      txb.tx.txIns[0].setScript(scriptSig)
      return txb
    }, this)
  }

}

module.exports = CnlTxBuilder
