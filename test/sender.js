/* global describe,it */
'use strict'
let should = require('should')
let Sender = require('../lib/sender.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
let Txout = require('fullnode/lib/txout')
let Tx = require('fullnode/lib/tx')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

describe('Sender', function () {
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
    refundTx: '0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d6700000000920047304402201bc994b5ab51348c3434c87188d1896a27d17e5f8a1432c102b6cf3785624c6b022043263aceb06517af466bff679528f5f633b9ce0c4a491a6c09b512269aa1998a01004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff01706f9800000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac00000000',
    paymentTx: '0100000001dd5dd76ec7dff96a32cd6f7b51e724f17f3f972e79edd56dbf57c4d98bda8d67000000009300483045022100cfdcda30c0a8fd2d3af31e5b48764c09c04bc0c3bf3fe3e326e258a89806a6a40220718aff5ac0c90261969f520703ed63cacb47f52309601ed685caf4b2d923ae2901004752210391de2f6bb67b11139f0e21203041bf080eacf59a33d99cd9f1929141bb0b4d0b210229757774cc6f3be1d5f1774aefa8f02e50bc64404230e7a67e8fde79bd559a9a52aeffffffff03d0dd0600000000001976a914896007cb039c6648498ba434b2d0ed00837c1a3588ac50c30000000000001976a914687b4cd0cd3ddcc611aac541bf3ab6dc0b7ecb9588ac50ce9000000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000'
  }

  it('should exist', function () {
    should.exist(Sender)
    should.exist(new Sender())
    should.exist(Sender())
  })

  describe('#setupMultisigScript', function () {
    it('setupMultisigScript should exist', function () {
      let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
      should.exist(sender.setupMsScript)
    })

    it('setupMultisigScript should setup a multisig script', function () {
      let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
      let address = sender.setupMsScript()
      address.toString().should.equal(consts.multiSigScript)
    })
  })

  describe('#setupMultisigAddress', function () {
    it('setupMultisigAddress should exist', function () {
      let sender = Sender()
      should.exist(sender.setupMsAddress)
    })

    it('setupMultisigAddress should setup a multisig address', function () {
      let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
      sender.setupMsScript()
      let address = sender.setupMsAddress()
      address.toString().should.equal(consts.multiSigAddress)
    })
  })

  describe('#asyncCreateAndSignFundingTx', function () {
    it('asyncCreateAndSignFundingTx should setup a multisig address', function () {
      return asink(function *() {
        // initialize sender
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        sender.setupMsScript()
        sender.setupMsAddress()

        // make an unspent output
        let txhashbuf = new Buffer(32)
        txhashbuf.fill(0)
        let txoutnum = 0
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + fundingAddress.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let txout = Txout(BN(1e8), scriptout)

        let tx = yield sender.asyncCreateAndSignFundingTx(BN(1e7), changeAddress, txhashbuf, txoutnum, txout, fundingPubkey)

        tx.toString().should.equal(consts.fundingTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(2)
      }, this)
    })
  })

  describe('#asyncCreateAndSignRefundTx', function () {
    it('asyncCreateAndSignRefundTx should create and sign a payment tx', function () {
      return asink(function *() {
        // initialize sender
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        sender.initialize()
        sender.balance = BN(500000)
        sender.amountFunded = BN(500000)
        sender.fundingTx = Tx().fromString(consts.fundingTx)

        // create output to spend
        let txhashbuf = new Buffer(32)
        txhashbuf.fill(0)
        let txoutnum = 0
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + sender.msAddress.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let txout = Txout(BN(1e8), scriptout)

        let refundTx = yield sender.asyncCreateAndSignRefundTx(txhashbuf, txoutnum, txout)

        refundTx.toString().should.equal(consts.refundTx)
        refundTx.toJSON().txins.length.should.equal(1)
        refundTx.toJSON().txouts.length.should.equal(1)
      }, this)
    })
  })

  describe('#createAndSignPaymentTx', function () {
    it('createAndSignPaymentTx should create and sign a payment tx', function () {
      return asink(function *() {
        // initialize sender
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        sender.initialize()
        sender.balance = BN(500000)
        sender.amountFunded = BN(500000)
        sender.fundingTx = Tx().fromString(consts.fundingTx)

        let amountToSend = BN(50000)

        // create output to spend
        let txhashbuf = new Buffer(32)
        txhashbuf.fill(0)
        let txoutnum = 0
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + sender.msAddress.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let txout = Txout(BN(1e8), scriptout)

        let tx = yield sender.asyncCreateAndSignPaymentTx(amountToSend, changeAddress, txhashbuf, txoutnum, txout)

        tx.toString().should.equal(consts.paymentTx)
        tx.toJSON().txins.length.should.equal(1)
        tx.toJSON().txouts.length.should.equal(3)
      }, this)
    })
  })

  describe('#closeChannel', function () {
    it('closeChannel should exist', function () {
      let sender = Sender()
      should.exist(sender.closeChannel)
    })
  })
})
