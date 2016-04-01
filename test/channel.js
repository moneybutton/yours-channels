/* global describe,it */
'use strict'
let Sender = require('../lib/sender.js')
let Receiver = require('../lib/receiver.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
let Txout = require('fullnode/lib/txout')
let Tx = require('fullnode/lib/tx')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

// TODO add #

describe('Channel', function () {
  // make change address
  let changePrivkey = Privkey().fromBN(BN(10))
  let changePubkey = Pubkey().fromPrivkey(changePrivkey)
  let changeAddress = Address().fromPubkey(changePubkey)

  // make addresses to send from
  let fundingPrivkey = Privkey().fromBN(BN(20))
  let fundingPubkey = Pubkey().fromPrivkey(fundingPrivkey)
  let fundingAddress = Address().fromPubkey(fundingPubkey)

  // the private address of sender
  let senderPrivkey = Privkey().fromBN(BN(30))
  let senderPubkey = Pubkey().fromPrivkey(senderPrivkey)
  let senderAddress = Address().fromPubkey(senderPubkey)

  // the private key used to create the multig addr
  let senderMsPrivkey = Privkey().fromBN(BN(40))

  // the receiver's pub key used to create the multisig
  let receiverMsPrivkey = Privkey().fromBN(BN(50))
  let receiverMsPubkey = Pubkey().fromPrivkey(receiverMsPrivkey)

  // the receivers private address
  let receiverPrivKey = Privkey().fromBN(BN(60))
  let receiverPubkey = Pubkey().fromPrivkey(receiverPrivKey)
  let receiverAddress = Address().fromPubkey(receiverPubkey)

  let consts = {
    multiSigScript: 'OP_2 33 0x0391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b 33 0x0229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a OP_2 OP_CHECKMULTISIG',
    multiSigAddress: '3NSKWKu7RzEUqR1J2HUWoNDumorEUPPnAZ',
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006b483045022100c31d180dd8f64bc977deef813044469cae966dc8b9c31d1c40f82456e8453f3702204f8838640179298b21f10e9210ef15abefa3156ac9c88b4ae54c751f9b3ab1890121024ce119c96e2fa357200b559b2f7dd5a5f02d5290aff74b03f3e471b273211c97ffffffff02809698000000000017a914e3931442220bb453a95150725a4e45c456b2c6198770235d05000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000',
    paymentTx: '0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d67000000009300483045022100cfdcda30c0a8fd2d3af31e5b48764c09c04bc0c3bf3fe3e326e258a89806a6a40220718aff5ac0c90261969f520703ed63cacb47f52309601ed685caf4b2d923ae2901004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03d0dd0600000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac50c30000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000'
  }

  let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
  sender.initialize()
  let receiver = Receiver(receiverMsPrivkey, receiverPubkey)

  // build data structure that represents and unspent output,
  // the sender would look that up in her wallet
  let txhashbuf = new Buffer(32)
  txhashbuf.fill(0)
  let txoutnum = 0
  let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + fundingAddress.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
  let txout = Txout(BN(1e8), scriptout)

  it('setup a payment channel and send two payments', function () {
    return asink(function *() {

      // sender funds the channel with 1e7 satoshi
      // the funding transaction is not broadcast to the bictoin network yet
      // be at this point the receiver coult withhold the senders funds locked in the channel
      let amountToFund = BN(1e7)
      let fundingTx = yield sender.asyncCreateAndSignFundingTx(amountToFund, changeAddress, txhashbuf, txoutnum, txout, fundingPubkey)
      fundingTx.toString().should.equal(consts.fundingTx)

      let refundTx = yield sender.asyncCreateAndSignRefundTx()
      refundTx.toString().should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000920047304402201bc994b5ab51348c3434c87188d1896a27d17e5f8a1432c102b6cf3785624c6b022043263aceb06517af466bff679528f5f633b9ce0c4a491a6c09b512269aa1998a01004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff01706f9800000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000')

      // the refund transaction is then set to the receiver who signes it but does not broadcast
      let signedRefundTx = yield receiver.asyncCheckAndSignRefundTx(refundTx, fundingTx)
      signedRefundTx.toString().should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000da0047304402201bc994b5ab51348c3434c87188d1896a27d17e5f8a1432c102b6cf3785624c6b022043263aceb06517af466bff679528f5f633b9ce0c4a491a6c09b512269aa1998a01483045022100879c42efc1550f06b935392cc31ef14607cd8e4226e401ed14570b9496c24ba1022074e4f449f5468f7940c759e6ddeae8ae3650b2dc45fd1bb3e26c068d472dac03014752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff01706f9800000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000')

      // the refund transaction is now completely signed
      // the receiver sends it back to the sender
      // at this point the sender can safely broadcast the funding transaction to the blockchain
      // the receiver now monitors the blockchain to see when the funding transaction has one conf

      // next the sender sends the first micropayemt to the receiver
      sender.balance = BN(500000)
      sender.amountFunded = BN(500000)
      sender.fundingTx = Tx().fromString(consts.fundingTx)

      // send first micropayemt
      let amountToSend1 = BN(100)
      let payment1partialTx = yield sender.asyncCreateAndSignPaymentTx(amountToSend1, changeAddress)
      payment1partialTx.toString().should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000920047304402207f2237bcbd20d5cde3d7cf70cb2a608806cfc0accdd0c8134915795fc520c24402201756a2b6a602a57647196c75d0827a6250ac5e6a0f79bc9beca13bb2e83bf7e901004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03bca00700000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac64000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000')

      let completePayment1 = yield receiver.asyncAcceptPayment(payment1partialTx)
      completePayment1.toString().should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000d90047304402207f2237bcbd20d5cde3d7cf70cb2a608806cfc0accdd0c8134915795fc520c24402201756a2b6a602a57647196c75d0827a6250ac5e6a0f79bc9beca13bb2e83bf7e901473044022053c4168db667b366b56736ea4efe0cbc469b6eb53dbacdd0309e2c7c60dcd87702204c576a8772e7bb264c07b5ccd8d864827935c78bee659e33be1314de01234a65014752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03bca00700000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac64000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000')

      // send second micropayemt
      let amountToSend2 = BN(200)
      let payment2partialTx = yield sender.asyncCreateAndSignPaymentTx(amountToSend2, changeAddress)
      payment2partialTx.toString().should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000920047304402206b17321713611b64574ba4cf8fdb18455e0b8df5c51df41e4c12e5799f44b0a402207dfa1969186dd62ce8c9fb8ab89b15de137bb52f7f3434cfe40a7f302efa21fc01004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff0358a00700000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588acc8000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000')

      let completePayment2 = yield receiver.asyncAcceptPayment(payment2partialTx)
      completePayment2.toString().should.equal('0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000d90047304402206b17321713611b64574ba4cf8fdb18455e0b8df5c51df41e4c12e5799f44b0a402207dfa1969186dd62ce8c9fb8ab89b15de137bb52f7f3434cfe40a7f302efa21fc01473044022009970e218e496f8da5b28692a88e8757422882b8496408eaa3d2394d6ee3b04d02200a4249c2e3ab043c623da1b610efcc40505178ba5ce424519b9d820d745104b8014752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff0358a00700000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588acc8000000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000')
    }, this)
  })
})
