'use strict'

let should = require('should')
let Sender = require('../lib/sender.js')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Keypair = require('fullnode/lib/keypair')
let Address = require('fullnode/lib/address')
let Script = require('fullnode/lib/script')
let Txout = require('fullnode/lib/txout')
let Tx = require('fullnode/lib/tx')
let BN = require('fullnode/lib/bn')
let asink = require('asink')

// TODO add #

describe('Sender', function () {
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
    multiSigScript: 'OP_2 33 0x02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5 33 0x02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9 OP_2 OP_CHECKMULTISIG',
    multiSigAddress: '3FpT85kUpAxhL7jKW3trvb4KLhj6j1121R',
    fundingTx: '01000000010000000000000000000000000000000000000000000000000000000000000000000000006a47304402200d4b8ab538542f844a3e5f417a7ee9d1811e745cd093b0a8513a0aec043409fd022077e58ecf722e335232c29231ca156b2efae843ba9a3b809cd6aff5f2bd1726a8012103774ae7f858a9411e5ef4246b70c65aac5649980be5c17891bbec17895da008cbffffffff02809698000000000017a9149af9b52da033d663b8eef59d586c7a4e01cf02168770235d05000000001976a914185140bb54704a9e735016faa7a8dbee4449bddc88ac00000000',
    paymentTx: '0100000001b806dccfc74a52092ffd075daf46449380066aef95202d7f1b9ba00a22dc032e00000000920047304402203d5e0bb5de1f08f72a4c1c787a779ae835106cae95955681a2ff560d9b08ce9b022031f7a93014f5cb252225cfef87e2cc7c8bdb23205368051c1559243d261d060b010047522102c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee52102f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f952aeffffffff03d0dd0600000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac50c30000000000001976a914c42e7ef92fdb603af844d064faad95db9bcdfd3d88ac50ce9000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000'
  }

  it('should exist', function () {
    should.exist(Sender)
    should.exist(new Sender())
    should.exist(Sender())
  })

  describe('setupMultisigScript', function () {
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

  describe('setupMultisigAddress', function () {
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

  describe('asyncCreateAndSignFundingTx', function () {
    it('asyncCreateAndSignFundingTx should setup a multisig address', function () {
      return asink(function *() {

        // initialize sender
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        sender.setupMsScript()
        sender.setupMsAddress()

        // make change address
        let privkey = Privkey().fromBN(BN(10))
        let keypair = Keypair().fromPrivkey(privkey)
        let changeaddr = Address().fromPubkey(keypair.pubkey)

        // make addresses to send from
        let privkey1 = Privkey().fromBN(BN(11))
        let keypair1 = Keypair().fromPrivkey(privkey1)
        let addr1 = Address().fromPubkey(keypair1.pubkey)

        // make addresses to send to
        let saddr1 = addr1
        let saddr2 = Address().fromRedeemScript(Script().fromString('OP_RETURN')) // fake, unredeemable p2sh address

        let txhashbuf = new Buffer(32)
        txhashbuf.fill(0)

        let txoutnum = 0
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + addr1.hashbuf.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let txout = Txout(BN(1e8), scriptout)

        let tx = yield sender.asyncCreateAndSignFundingTx(BN(1e7), changeaddr, txhashbuf, txoutnum, txout, keypair1.pubkey)
        let txJson = tx.toJSON()

        tx.toString().should.equal(consts.fundingTx)
        txJson.txins.length.should.equal(1)
        txJson.txouts.length.should.equal(2)
      }, this)
    })
  })

  describe('createAndSignPaymentTx', function () {
    it('createAndSignPaymentTx should create and sign a payment tx', function () {
      return asink(function *() {

        // initialize sender
        let sender = Sender(senderAddress, senderMsPrivkey, receiverMsPubkey, receiverAddress)
        sender.setupMsScript()
        sender.setupMsAddress()
        sender.balance = BN(500000)
        sender.amountFunded = BN(500000)
        sender.fundingTx = Tx().fromString(consts.fundingTx)

        let amountToSend = BN(50000)

        // make change address
        let changePrivkey = Privkey().fromBN(BN(1))
        let changeKeypair = Keypair().fromPrivkey(changePrivkey)
        let changeaddr = Address().fromPubkey(changeKeypair.pubkey)

        // create output to spend
        let txhashbuf = new Buffer(32)
        txhashbuf.fill(0)
        let txoutnum = 0
        let scriptout = Script().fromString('OP_DUP OP_HASH160 20 0x' + sender.msAddress.toString('hex') + ' OP_EQUALVERIFY OP_CHECKSIG')
        let txout = Txout(BN(1e8), scriptout)

        let tx = yield sender.asyncCreateAndSignPaymentTx(amountToSend, changeaddr, txhashbuf, txoutnum, txout)
        let txJson = tx.toJSON()

        tx.toString().should.equal(consts.paymentTx)
        txJson.txins.length.should.equal(1)
        txJson.txouts.length.should.equal(3)

      }, this)
    })
  })

  describe('closeChannel', function () {
    it('closeChannel should exist', function () {
      let sender = Sender()
      should.exist(sender.closeChannel)
    })
  })

})
