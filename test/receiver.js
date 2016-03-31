/* global describe,it */
'use strict'

let should = require('should')
let Receiver = require('../lib/receiver.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Tx = require('fullnode/lib/tx')
let Txoutmap = require('fullnode/lib/txoutmap')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

describe('Receiver', function () {
  // the receiver's pub key used to create the multisig
  let receiverMsPrivkey = Privkey().fromBN(BN(50))

  // the receivers private address
  let receiverPrivKey = Privkey().fromBN(BN(60))
  let receiverPubkey = Pubkey().fromPrivkey(receiverPrivKey)

  let consts = {
    multiSigScript: 'OP_2 33 0x0391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b 33 0x0229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a OP_2 OP_CHECKMULTISIG',
    multiSigAddress: '3NSKWKu7RzEUqR1J2HUWoNDumorEUPPnAZ',
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b483045022100c31d180dd8f64bc977deef813044469cae966dc8b9c31d1c40f82456e8453f3702204f8838640179298b21f10e9210ef15abefa3156ac9c88b4ae54c751f9b3ab1890121024ce119c96e2fa357200b559b2f7dd5a5f02d5290aff74b03f3e471b273211c97ffffffff02809698000000000017a914e3931442220bb453a95150725a4e45c456b2c6198770235d05000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000',
    refundTx: '0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000920047304402201bc994b5ab51348c3434c87188d1896a27d17e5f8a1432c102b6cf3785624c6b022043263aceb06517af466bff679528f5f633b9ce0c4a491a6c09b512269aa1998a01004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff01706f9800000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    partialPaymentTx: '0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d67000000009300483045022100cfdcda30c0a8fd2d3af31e5b48764c09c04bc0c3bf3fe3e326e258a89806a6a40220718aff5ac0c90261969f520703ed63cacb47f52309601ed685caf4b2d923ae2901004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03d0dd0600000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac50c30000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000',
    completelySignedTx: '0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000db00483045022100cfdcda30c0a8fd2d3af31e5b48764c09c04bc0c3bf3fe3e326e258a89806a6a40220718aff5ac0c90261969f520703ed63cacb47f52309601ed685caf4b2d923ae2901483045022100f6b31c3cc9808758b7232f2307f5512e8cd94eb7bcb83b4ddfff04b3e2a5020102206a04bb905ff0c0d7a2ebb103aa2c0039d317b54b8c9766c6601275f481485119014752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03d0dd0600000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac50c30000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000'
  }

  it('should exist', function () {
    should.exist(Receiver)
    should.exist(new Receiver())
    should.exist(Receiver())
  })

  describe('#asyncSignPaymentTx', function () {
    it('asyncSignPaymentTx signs a tx', function () {
      return asink(function *() {
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let partialPaymentTx = Tx().fromString(consts.partialPaymentTx)
        let completelySignedTx = yield receiver.asyncSignPaymentTx(partialPaymentTx)
        completelySignedTx.toString().should.equal(consts.completelySignedTx)
      }, this)
    })
  })

  describe('#verifyTx', function () {
    it('verifyTx should verify a tx', function () {
      let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
      let fundingTx = Tx().fromString(consts.fundingTx)
      let completelySignedTx = Tx().fromString(consts.completelySignedTx)

      let txoutmap = Txoutmap()
      txoutmap.addTx(fundingTx)

      let verification = receiver.verifyTx(completelySignedTx, txoutmap)
      verification.should.equal(true)
    })
  })

/* TODO debug
  describe('asyncCheckAndSignRefundTx', function () {
    it.only('asyncCheckAndSignRefundTx check and sign a refund tx', function () {
      return asink(function *() {
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let fundingTx = Tx().fromString(consts.fundingTx)
        let partialPaymentTx = Tx().fromString(consts.partialPaymentTx)

        let txoutmap = Txoutmap()
        txoutmap.addTx(fundingTx)

        let verification = yield receiver.asyncCheckAndSignRefundTx(partialPaymentTx, txoutmap)
        verification.should.equal(true)
      })
    })
  })
*/

  describe('#asyncAcceptPayment', function () {
    it('asyncAcceptPayment should accept a payment if he can sign it and it is verifyable', function () {
      return asink(function *() {
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let fundingTx = Tx().fromString(consts.fundingTx)
        let partialPaymentTx = Tx().fromString(consts.partialPaymentTx) // this is the difference to asyncVerifyTx
        let txoutmap = Txoutmap()
        txoutmap.addTx(fundingTx)
        receiver.fundingTxOutputmap = txoutmap
        let acceptance = yield receiver.asyncAcceptPayment(partialPaymentTx)
        acceptance.should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000db00483045022100cfdcda30c0a8fd2d3af31e5b48764c09c04bc0c3bf3fe3e326e258a89806a6a40220718aff5ac0c90261969f520703ed63cacb47f52309601ed685caf4b2d923ae2901483045022100f6b31c3cc9808758b7232f2307f5512e8cd94eb7bcb83b4ddfff04b3e2a5020102206a04bb905ff0c0d7a2ebb103aa2c0039d317b54b8c9766c6601275f481485119014752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03d0dd0600000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac50c30000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000')
      }, this)
    })
  })

  describe('#closeChannel', function () {
    it('closeChannel should exist', function () {
      let receiver = Receiver()
      should.exist(receiver.closeChannel)
    })
  })
})
