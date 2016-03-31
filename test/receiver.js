'use strict'

let should = require('should')
let Receiver = require('../lib/receiver.js')
let Sender = require('../lib/sender.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Keypair = require('fullnode/lib/keypair')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
let Tx = require('fullnode/lib/tx')
let Txout = require('fullnode/lib/txout')
let Txbuilder = require('fullnode/lib/txbuilder')
let Txverifier = require('fullnode/lib/txverifier')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

describe('Receiver', function () {
  // the private address of sender
  let senderPrivkey = Privkey().fromBN(BN(1))
  let senderPubkey = Pubkey().fromPrivkey(senderPrivkey)
  let senderAddress = Address().fromPubkey(senderPubkey)

  // the private key used to create the multig addr
  let senderMsPrivkey = Privkey().fromBN(BN(2))

  // the receiver's pub key used to create the multisig
  let receiverMsPrivkey = Privkey().fromBN(BN(3))
  let receiverMsPubkey = Pubkey().fromPrivkey(receiverMsPrivkey)

  // the receivers private address
  let receiverPrivKey = Privkey().fromBN(BN(4))
  let receiverPubkey = Pubkey().fromPrivkey(receiverPrivKey)
  let receiverAddress = Address().fromPubkey(receiverPubkey)

  let consts = {
    partialPaymentTx: '0100000001ad2208aeb1993e405f41c54287092b8317204a7e9f8a38182e76a4c7223b952a000000009200473044022030a4fa6518d94d158686bffcd8206f8350ad51e82419977512187fed0f0b5d4302204b15818763992bdf5b7d44c52cc32e0530b66e59961b59cddbcbaa988f62c860010047522102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee52102f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f952aeffffffff03d0dd0600000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac50c30000000000001976a914c42e7ef92fdb603af844d064faad95db9bcdfd3d88ac50ce9000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000',
    completelySignedTx: '0100000001ad2208aeb1993e405f41c54287092b8317204a7e9f8a38182e76a4c7223b952a00000000da00473044022030a4fa6518d94d158686bffcd8206f8350ad51e82419977512187fed0f0b5d4302204b15818763992bdf5b7d44c52cc32e0530b66e59961b59cddbcbaa988f62c86001483045022100d4bca42fde4982180497bc0079e10b4762f255ae57eadebbcbb28b0a92ac7e9102207e91f584ac06ca074cd96eeb57f541f5393b27c5888267e30358292b108a5fc40147522102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee52102f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f952aeffffffff03d0dd0600000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac50c30000000000001976a914c42e7ef92fdb603af844d064faad95db9bcdfd3d88ac50ce9000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000'
  }

  it('should exist', function () {
    should.exist(Receiver)
    should.exist(new Receiver())
    should.exist(Receiver())
  })

  describe('signPaymentTx', function () {
    it('asyncSignPaymentTx signs a tx', function () {
      return asink(function *() {
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let partialPaymentTx = Tx().fromString(consts.partialPaymentTx)
        let completelySignedTx = yield receiver.asyncSignPaymentTx(partialPaymentTx)

        completelySignedTx.toString().should.equal(consts.completelySignedTx)
      }, this)
    })
  })


  describe('verifyTx', function () {
/*
    it('verifyTx should verify a tx', function () {
      return asink(function *() {
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let fundingTx = Tx().fromString(consts.fundingTx)
        let paymentTx = Tx().fromString(consts.completelySignedTx)
        receiver.txoutmap = fundingTx.txouts
        let verification = receiver.asyncVerifyTx(paymentTx)
      }, this)
    })
*/
  })

  describe('acceptPayment', function () {
    it('acceptPayment should exist', function () {
      let receiver = Receiver()
      should.exist(receiver.acceptPayment)
    })
  })

  describe('closeChannel', function () {
    it('closeChannel should exist', function () {
      let receiver = Receiver()
      should.exist(receiver.closeChannel)
    })
  })

})
