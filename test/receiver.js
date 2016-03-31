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
  let receiverMsPrivkey = Privkey().fromBN(BN(3))

  // the receivers private address
  let receiverPrivKey = Privkey().fromBN(BN(4))
  let receiverPubkey = Pubkey().fromPrivkey(receiverPrivKey)

  let consts = {
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006a47304402200d4b8ab538542f844a3e5f417a7ee9d1811e745cd093b0a8513a0aec043409fd022077e58ecf722e335232c29231ca156b2efae843ba9a3b809cd6aff5f2bd1726a8012103774ae7f858a9411e5ef4246b70c65aac5649980be5c17891bbec17895da008cbffffffff02809698000000000017a9149af9b52da033d663b8eef59d586c7a4e01cf02168770235d05000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000',
    partialPaymentTx: '0100000001b806dccfc74a52092ffd075daf46449380066aef95202d7f1b9ba00a22dc032e00000000920047304402203d5e0bb5de1f08f72a4c1c787a779ae835106cae95955681a2ff560d9b08ce9b022031f7a93014f5cb252225cfef87e2cc7c8bdb23205368051c1559243d261d060b010047522102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee52102f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f952aeffffffff03d0dd0600000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac50c30000000000001976a914c42e7ef92fdb603af844d064faad95db9bcdfd3d88ac50ce9000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000',
    completelySignedTx: '0100000001b806dccfc74a52092ffd075daf46449380066aef95202d7f1b9ba00a22dc032e00000000da0047304402203d5e0bb5de1f08f72a4c1c787a779ae835106cae95955681a2ff560d9b08ce9b022031f7a93014f5cb252225cfef87e2cc7c8bdb23205368051c1559243d261d060b01483045022100e7b8f02307f30001f21049eac5a5a4d7a25c789f1d8383fb84fc8bae2095e3f602202e08017f2d906efc800b8cc883cff26a5c4824f645a0450b072bfe09d662188f0147522102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee52102f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f952aeffffffff03d0dd0600000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac50c30000000000001976a914c42e7ef92fdb603af844d064faad95db9bcdfd3d88ac50ce9000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000'
  }

  it('should exist', function () {
    should.exist(Receiver)
    should.exist(new Receiver())
    should.exist(Receiver())
  })

  describe('asyncSignPaymentTx', function () {
    it('asyncSignPaymentTx signs a tx', function () {
      return asink(function *() {
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let partialPaymentTx = Tx().fromString(consts.partialPaymentTx)
        let completelySignedTx = yield receiver.asyncSignPaymentTx(partialPaymentTx)

        completelySignedTx.toString().should.equal(consts.completelySignedTx)
      }, this)
    })
  })

  describe('verifyTx', function () {
    it('verifyTx should verify a tx', function () {
      let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
      let fundingTx = Tx().fromString(consts.fundingTx)
      let paymentTx = Tx().fromString(consts.completelySignedTx)
      let txoutmap = Txoutmap()
      txoutmap.addTx(fundingTx)
      receiver.txoutmap = txoutmap
      let verification = receiver.verifyTx(paymentTx)
      verification.should.equal(true)
    })
  })

  describe('asyncAcceptPayment', function () {
    it('asyncAcceptPayment should accept a payment if he can sign it and it is verifyable', function () {
      return asink(function *() {
        let receiver = Receiver(receiverMsPrivkey, receiverPubkey)
        let fundingTx = Tx().fromString(consts.fundingTx)
        let partialPaymentTx = Tx().fromString(consts.partialPaymentTx) // this is the difference to asyncVerifyTx
        let txoutmap = Txoutmap()
        txoutmap.addTx(fundingTx)
        receiver.txoutmap = txoutmap
        let acceptance = yield receiver.asyncAcceptPayment(partialPaymentTx)
        acceptance.should.equal(true)
      }, this)
    })
  })

  describe('closeChannel', function () {
    it('closeChannel should exist', function () {
      let receiver = Receiver()
      should.exist(receiver.closeChannel)
    })
  })
})
