/* global describe,it */
'use strict'
let Address = require('fullnode/lib/address')
let BN = require('fullnode/lib/bn')
let Hash = require('fullnode/lib/hash')
let Interp = require('fullnode/lib/interp')
let Keypair = require('fullnode/lib/keypair')
let Opcode = require('fullnode/lib/opcode')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Random = require('fullnode/lib/random')
let Script = require('fullnode/lib/script')
let Sig = require('fullnode/lib/sig')
let Txbuilder = require('fullnode/lib/txbuilder')
let Txout = require('fullnode/lib/txout')
let Txverifier = require('fullnode/lib/txverifier')
require('should')

describe('Script Examples', function () {
  describe('CHECKLOCKTIMEVERIFY (CLTV)', function () {
    it('should lock up funds until block 100', function () {
      // This example spends to an output that requires a normal signature and
      // also for the transaction locktime to be at least 100. The sequence
      // number seqnum is set to an arbitrary value less than 0xffffffff, which
      // is necessary to enable CLTV.
      //
      // scriptPubkey: <nlocktime> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
      // scriptSig: <sig>

      let scriptnlocktime = 100
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)
      let scriptPubkey = Script()
        .writeBN(BN(scriptnlocktime))
        .writeOpcode(Opcode.OP_CHECKLOCKTIMEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
      let txb = Txbuilder()
      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(500000)).setScript(scriptPubkey)
      let seqnum = 0xf0f0f0f0 // must be less than 0xffffffff for CLTV to work
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, seqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      let sig, txnlocktime

      // tx lock time too low - tx invalid
      txnlocktime = 99
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(false)

      // tx lock time high enough - tx valid
      txnlocktime = 100
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
    })

    it('should lock up funds until block 100 with a p2sh transaction', function () {
      // This example is almost the same as the previous example - it spends to
      // an output that requires a normal signature and also for the
      // transaction locktime to be at least 100. The sequence number seqnum is
      // set to an arbitrary value less than 0xffffffff, which is necessary to
      // enable CLTV. The difference is that it is a p2sh transaction, so much
      // of the logic is in the redeemScript. Also note that the subscript
      // changes when doing tx sign - in the p2sh case, the subscript is the
      // redeemScript, not the scriptPubkey.
      //
      // scriptPubkey: OP_HASH160 <p2shaddress> OP_EQUAL
      // scriptSig: <sig> <redeemScript>
      // redeemScript: <nlocktime> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG

      let scriptnlocktime = 100
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)
      let redeemScript = Script()
        .writeBN(BN(scriptnlocktime))
        .writeOpcode(Opcode.OP_CHECKLOCKTIMEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
        .writeBuffer(redeemScript.toBuffer())
      let scriptPubkey = Script()
        .writeOpcode(Opcode.OP_HASH160)
        .writeBuffer(Hash.sha256ripemd160(redeemScript.toBuffer()))
        .writeOpcode(Opcode.OP_EQUAL)

      let txb = Txbuilder()
      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(500000)).setScript(scriptPubkey)
      let seqnum = 0xf0f0f0f0 // must be less than 0xffffffff for CLTV to work
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, seqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      let sig, txnlocktime

      // tx lock time too low - tx invalid
      txnlocktime = 99
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(false)

      // tx lock time high enough - tx valid
      txnlocktime = 100
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
    })
  })

  describe('CHECKSEQUENCEVERIFY (CSV)', function () {
    it('should lock up funds for 100 blocks (relative lock time)', function () {
      // This example spends to an output that requires a normal signature and
      // also for the transaction seqnum to be at least 100 (enforcing relative
      // locktime - the spend tx must be 100 blocks after the funding tx was
      // confirmed).
      //
      // scriptPubkey: <seqnum> OP_CHECKSEQUENCEVERIFY OP_DROP <pubkey> OP_CHECKSIG
      // scriptSig: <sig>

      let scriptseqnum = 100
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)
      let scriptPubkey = Script()
        .writeBN(BN(scriptseqnum))
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(500000)).setScript(scriptPubkey)

      let txb, sig, txseqnum

      // tx seqnum too low - tx invalid
      txseqnum = 99
      txb = Txbuilder()
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))
      txb.setVersion(2)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false)

      // tx seqnum high enough - tx valid
      txseqnum = 100
      txb = Txbuilder()
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))
      txb.setVersion(2)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(true)
    })

    it('should lock up funds for 100 blocks (relative lock time) - p2sh version', function () {
      // This example spends to a redeemScript that requires a normal signature
      // and also for the transaction seqnum to be at least 100 (enforcing
      // relative locktime - the spend tx must be 100 blocks after the funding
      // tx was confirmed).
      //
      // scriptPubkey: OP_HASH160 <p2shaddress> OP_EQUAL
      // scriptSig: <sig> <redeemScript>
      // redeemScript: <seqnum> OP_CHECKSEQUENCEVERIFY OP_DROP <pubkey> OP_CHECKSIG

      let scriptseqnum = 100
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)
      let redeemScript = Script()
        .writeBN(BN(scriptseqnum))
        .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
        .writeBuffer(redeemScript.toBuffer())
      let scriptPubkey = Script()
        .writeOpcode(Opcode.OP_HASH160)
        .writeBuffer(Hash.sha256ripemd160(redeemScript.toBuffer()))
        .writeOpcode(Opcode.OP_EQUAL)

      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(500000)).setScript(scriptPubkey)

      let txb, sig, txseqnum

      // tx seqnum too low - tx invalid
      txseqnum = 99
      txb = Txbuilder()
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))
      txb.setVersion(2)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false)

      // tx seqnum high enough - tx valid
      txseqnum = 100
      txb = Txbuilder()
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, txseqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))
      txb.setVersion(2)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(true)
    })
  })

  describe('Hash Time Lock (HTL)', function () {
    it('should enable destination funds when sig and value that hashes correctly is in input', function () {
      // This example spends to an output that requires both a signature and some
      // secret value secretbuf which correctly hashes to hashbuf
      //
      // scriptPubkey: OP_SHA256 <hash> OP_EQUALVERIFY <pubkey> OP_CHECKSIG
      // scriptSig: <sig> <secret>

      let secretbuf = new Buffer('this is a secret string')
      let hashbuf = Hash.sha256(secretbuf)

      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)

      let scriptPubkey = Script()
        .writeOpcode(Opcode.OP_SHA256)
        .writeBuffer(hashbuf)
        .writeOpcode(Opcode.OP_EQUALVERIFY)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
        .writeBuffer(secretbuf) // secret value

      let txb = Txbuilder()
      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(500000)).setScript(scriptPubkey)
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      txb.build()
      let sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
    })

    it('should enable destination funds when sig and value that hashes correctly is in input with a p2sh transaction', function () {
      // This example is almost the same as the previous one, except that the
      // funding transaction is p2sh. It spends to an output that requires both
      // a signature and some secret value secretbuf which correctly hashes to
      // hashbuf. What was the scriptPubkey of the previous example becomes the
      // redeemScript in this one. And the subscripts in the tx sign are the
      // redeemScript.
      //
      // scriptPubkey: OP_SHA256 <hash> OP_EQUALVERIFY <pubkey> OP_CHECKSIG
      // scriptSig: <sig> <secret>

      let secretbuf = new Buffer('this is a secret string')
      let hashbuf = Hash.sha256(secretbuf)

      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)

      let redeemScript = Script()
        .writeOpcode(Opcode.OP_SHA256)
        .writeBuffer(hashbuf)
        .writeOpcode(Opcode.OP_EQUALVERIFY)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
        .writeBuffer(secretbuf) // secret value
        .writeBuffer(redeemScript.toBuffer())
      let scriptPubkey = Script()
        .writeOpcode(Opcode.OP_HASH160)
        .writeBuffer(Hash.sha256ripemd160(redeemScript.toBuffer()))
        .writeOpcode(Opcode.OP_EQUAL)

      let txb = Txbuilder()
      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(5000000)).setScript(scriptPubkey)
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(1000000), Address().fromPrivkey(Privkey().fromRandom()))

      txb.build()
      let sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
    })
  })

  describe('Yours Lightning Network', function () {
    // Based on Clemens' document: yours-lightning.md
    function makeAgent () {
      let agent = {}
      agent.paymentKeys = undefined
      agent.otherPaymentKeys = undefined
      agent.msKeys = undefined
      agent.otherMsKeys = undefined
      agent.msRedeemScript = undefined
      agent.msAddress = undefined
      agent.fundingTxObj = {}
      agent.RHTLCOutputScripts = []
      agent.HTLCOutputScripts = []
      agent.commitmentTxbs = []
      agent.otherCommitmentTxbs = []
      agent.RHTLCSecrets = []
      agent.HTLCSecrets = []
      agent.otherRHTLCSecrets = []
      agent.otherHTLCSecrets = []
      agent.settlementTx = undefined
      agent.settlementHTLCSecret = undefined
      return agent
    }

    function makeRHTLCOutputScript (bobPaymentPubkey, aliceRefundPubkey, aliceRHTLCHash, carolHTLCHash) {
      return Script()
        .writeOpcode(Opcode.OP_IF)
          .writeBuffer(bobPaymentPubkey.toBuffer())
          .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
          .writeOpcode(Opcode.OP_HASH160)
          .writeBuffer(aliceRHTLCHash)
          .writeOpcode(Opcode.OP_EQUAL)
        .writeOpcode(Opcode.OP_ELSE)
          .writeOpcode(Opcode.OP_IF)
            .writeBN(BN(6 * 24)) // one day = six blocks per hour for 24 hours
            .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
            .writeOpcode(Opcode.OP_DROP)
            .writeBuffer(bobPaymentPubkey.toBuffer())
            .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
            .writeOpcode(Opcode.OP_HASH160)
            .writeBuffer(carolHTLCHash)
            .writeOpcode(Opcode.OP_EQUAL)
          .writeOpcode(Opcode.OP_ELSE)
            .writeBN(BN(6 * 48)) // two days = six blocks per hour for 48 hours
            .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
            .writeOpcode(Opcode.OP_DROP)
            .writeBuffer(aliceRefundPubkey.toBuffer())
            .writeOpcode(Opcode.OP_CHECKSIG)
          .writeOpcode(Opcode.OP_ENDIF)
        .writeOpcode(Opcode.OP_ENDIF)
    }

    function makeHTLCOutputScript (bobPubkey, aliceRefundPubkey, carolHTLCHash) {
      return Script()
        .writeOpcode(Opcode.OP_IF)
          .writeBuffer(bobPubkey.toBuffer())
          .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
          .writeOpcode(Opcode.OP_HASH160)
          .writeBuffer(carolHTLCHash)
          .writeOpcode(Opcode.OP_EQUAL)
        .writeOpcode(Opcode.OP_ELSE)
          .writeBN(BN(6 * 48)) // two days = six blocks per hour for 48 hours
          .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
          .writeOpcode(Opcode.OP_DROP)
          .writeBuffer(aliceRefundPubkey.toBuffer())
          .writeOpcode(Opcode.OP_CHECKSIG)
        .writeOpcode(Opcode.OP_ENDIF)
    }

    function makeKeysObj () {
      let keypair = Keypair().fromRandom()
      let privkey = keypair.privkey
      let pubkey = keypair.pubkey
      let address = Address().fromPubkey(pubkey)
      return {keypair, privkey, pubkey, address}
    }

    function keysObj2Public (obj) {
      return {
        pubkey: obj.pubkey,
        address: obj.address
      }
    }

    function makeHTLCObj () {
      let secret = Random.getRandomBuffer(32)
      let hash = Hash.sha256ripemd160(secret)
      return {secret, hash}
    }

    function HTLCObj2Public (obj) {
      return {
        hash: obj.hash
      }
    }

    function makeFundingTxObj (inputAmountBn, outputAmountBN, msAddress) {
      let inputTxKeypair = Keypair().fromRandom()
      let inputTxAddress = Address().fromPubkey(inputTxKeypair.pubkey)
      let txChangeKeypair = Keypair().fromRandom()
      let txChangeAddress = Address().fromPubkey(txChangeKeypair.pubkey)
      let scriptPubkey = inputTxAddress.toScript()
      let txb = Txbuilder()
      let inputTxHashbuf = new Buffer(32)
      inputTxHashbuf.fill(0) // a fake, non-existent input transaction
      let inputTxoutnum = 0
      let inputTxout = Txout(inputAmountBn).setScript(scriptPubkey)
      txb.fromPubkeyhash(inputTxHashbuf, inputTxoutnum, inputTxout, inputTxKeypair.pubkey)
      txb.setChangeAddress(txChangeAddress)
      txb.toAddress(outputAmountBN, msAddress)
      txb.build()
      txb.sign(0, inputTxKeypair, inputTxout)
      return {
        txb,
        tx: txb.tx,
        txhashbuf: txb.tx.hash(),
        txoutnum: 0,
        txout: txb.tx.txouts[0],
        hash: txb.tx.hash()
      }
    }

    it('should send payments from alice to bob', function () {
      this.timeout(10000)
      let alice = makeAgent()
      let bob = makeAgent()

      // Creating addresses to receive payments and refunds.
      alice.paymentKeys = makeKeysObj()
      bob.paymentKeys = makeKeysObj()
      alice.otherPaymentKeys = keysObj2Public(bob.paymentKeys)
      bob.otherPaymentKeys = keysObj2Public(alice.paymentKeys)

      // Creating the multisig address.
      alice.msKeys = makeKeysObj()
      bob.msKeys = makeKeysObj()
      alice.otherMsKeys = keysObj2Public(bob.msKeys)
      bob.otherMsKeys = keysObj2Public(alice.msKeys)
      alice.msRedeemScript = Script().fromPubkeys(2, [alice.msKeys.pubkey, alice.otherMsKeys.pubkey])
      alice.msAddress = Address().fromRedeemScript(alice.msRedeemScript)
      bob.msRedeemScript = Script().fromPubkeys(2, [bob.msKeys.pubkey, bob.otherMsKeys.pubkey])
      bob.msAddress = Address().fromRedeemScript(bob.msRedeemScript)

      // Confirm that Alice and Bob have created the same address.
      bob.msAddress.toString().should.equal(alice.msAddress.toString())

      // Building, signing, and verifying the funding tx. We assume the payment
      // is made from a normal pubkeyhash address.
      alice.fundingTxObj = makeFundingTxObj(BN(50000000), BN(10000000), alice.msAddress)
      Txverifier(alice.fundingTxObj.tx, alice.fundingTxObj.txb.utxoutmap).verifystr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

      // Alice now has the funding transaction, but does not yet broadcast it.
      // She wants to confirm that she gets a signed refund transaction from
      // Bob first. The refund transaction is simply the first payment
      // transaction, sending 0 to Bob and the full amount (100000) back to
      // Alice. This transaction needs to be revokable, like all subsequent
      // payments, to Alice can't send the full amount back to herself after
      // sending payments to Bob. Alice builds this transaction, but doesn't
      // sign it, and requests that Bob signs it and sends it back.

      // Alice begins creating the commitment tx by first specifying that it
      // comes from the funding tx.
      alice.commitmentTxbs[0] = Txbuilder()
      alice.commitmentTxbs[0].fromScripthashMultisig(alice.fundingTxObj.hash, alice.fundingTxObj.txoutnum, alice.fundingTxObj.txout, alice.msRedeemScript)

      // Alice needs the hash of Bob's secrets to continue building the tx.
      // Alice and bob generate revoke secrets and HTLC secrets and share their
      // hashes.
      alice.RHTLCSecrets[0] = makeHTLCObj()
      alice.HTLCSecrets[0] = makeHTLCObj()
      bob.RHTLCSecrets[0] = makeHTLCObj()
      bob.HTLCSecrets[0] = makeHTLCObj()
      alice.otherRHTLCSecrets[0] = HTLCObj2Public(bob.RHTLCSecrets[0])
      alice.otherHTLCSecrets[0] = HTLCObj2Public(bob.HTLCSecrets[0])
      bob.otherRHTLCSecrets[0] = HTLCObj2Public(alice.RHTLCSecrets[0])
      bob.otherHTLCSecrets[0] = HTLCObj2Public(alice.HTLCSecrets[0])

      // Alice creates the RHTLC output to herself.
      alice.RHTLCOutputScripts[0] = makeRHTLCOutputScript(alice.otherPaymentKeys.pubkey, alice.paymentKeys.pubkey, alice.RHTLCSecrets[0].hash, alice.otherHTLCSecrets[0].hash)

      // Alice does NOT create an HTLC output to Bob yet - since that would
      // only send 0 bitcoins at this point.

      // Alice sets the RHTLC output to herself as the change of the txbuilder
      // - that is, the total amount sent back to herself will be everything
      // not sent in one of the other outputs minus the fee. Since there will
      // be no other outputs, it's just the total input amount minus the fee.
      alice.commitmentTxbs[0].setChangeScript(alice.RHTLCOutputScripts[0])

      // Alice now builds the tx. It has only one output - the RHTLC output
      // going back to Alice.
      alice.commitmentTxbs[0].build()

      // Alice does not yet sign the commitment tx. She sends it to Bob.
      bob.otherCommitmentTxbs[0] = Txbuilder().fromJSON(alice.commitmentTxbs[0].toJSON())

      // Here Bob needs to check that the transaction is something he is really
      // willing to accept. We will skip the checking for now and assume it
      // correct. TODO: Perform all the necessary checks so Bob knows and
      // agrees with what he is signing.

      // Alice shares the fundingTxTxout because Bob needs this to be able to
      // sign the transaction.
      bob.fundingTxObj = {
        txout: alice.fundingTxObj.txout,
        hash: alice.fundingTxObj.hash,
        txoutnum: alice.fundingTxObj.txoutnum
      }

      // Bob signs the transaction.
      bob.otherCommitmentTxbs[0].sign(0, bob.msKeys.keypair, bob.fundingTxObj.txout)

      // The transaction is not fully signed yet - only Bob has signed. Bob
      // sends the transaction back to Alice so she can finish signing it.
      alice.commitmentTxbs[0] = Txbuilder().fromJSON(bob.otherCommitmentTxbs[0].toJSON())

      // TODO: Alice performs checks to make sure that the transaction builder
      // is the same as before, but also signed by Bob.

      // Now that Alice has the refund transaction back, and is signed by Bob,
      // she signs it herself, making it fully valid.
      alice.commitmentTxbs[0].sign(0, alice.msKeys.keypair, alice.fundingTxObj.txout)
      Txverifier(alice.commitmentTxbs[0].tx, alice.commitmentTxbs[0].utxoutmap).verifystr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

      // Now that Alice has a fully-signed and valid refund transaction, it is
      // safe for her to broadcast the fundingTx. After she has broadcast the
      // fundingTx, Alice and Bob need to wait for that tranaction to get in a
      // block before continuing.

      // Pause ~ 10 minutes for the fundingTx to get in a block.

      // Now that the fundingTx is in a block, Alice can start making actual
      // payments to Bob. Alice has funded the channel with 50,000,000
      // satoshis.  She decides she wishes to pay Bob 100,000 satoshis. She
      // will need to create a new transaction with a 100,000 HTLC output to
      // Bob and a RHTLC change output back to herself.

      // Alice and both both generate new secrets, and exchange their hashes
      // with each other.
      alice.RHTLCSecrets[1] = makeHTLCObj()
      alice.HTLCSecrets[1] = makeHTLCObj()
      bob.RHTLCSecrets[1] = makeHTLCObj()
      bob.HTLCSecrets[1] = makeHTLCObj()
      alice.otherRHTLCSecrets[1] = HTLCObj2Public(bob.RHTLCSecrets[1])
      alice.otherHTLCSecrets[1] = HTLCObj2Public(bob.HTLCSecrets[1])
      bob.otherRHTLCSecrets[1] = HTLCObj2Public(alice.RHTLCSecrets[1])
      bob.otherHTLCSecrets[1] = HTLCObj2Public(alice.HTLCSecrets[1])

      // Alice makes the revokable output script for herself
      alice.RHTLCOutputScripts[1] = makeRHTLCOutputScript(alice.otherPaymentKeys.pubkey, alice.paymentKeys.pubkey, alice.RHTLCSecrets[1].hash, alice.otherHTLCSecrets[1].hash)

      // Alice makes the HTLC output for paying to Bob
      alice.HTLCOutputScripts[1] = makeHTLCOutputScript(alice.otherPaymentKeys.pubkey, alice.paymentKeys.pubkey, alice.otherHTLCSecrets[1].hash)

      // Now Alice can assemble her commitment tx
      alice.commitmentTxbs[1] = Txbuilder()
      alice.commitmentTxbs[1].fromScripthashMultisig(alice.fundingTxObj.hash, alice.fundingTxObj.txoutnum, alice.fundingTxObj.txout, alice.msRedeemScript)
      alice.commitmentTxbs[1].toScript(BN(100000), alice.HTLCOutputScripts[1])
      alice.commitmentTxbs[1].setChangeScript(alice.RHTLCOutputScripts[1])
      alice.commitmentTxbs[1].build()

      // Alice does not yet sign the commitment tx. She sends it to Bob.
      bob.otherCommitmentTxbs[1] = Txbuilder().fromJSON(alice.commitmentTxbs[1].toJSON())

      // Here Bob needs to check that the transaction is something he is really
      // willing to accept. We will skip the checking for now and assume it
      // correct. TODO: Perform all the necessary checks so Bob knows and
      // agrees with what he is signing.

      // Bob signs the transaction.
      bob.otherCommitmentTxbs[1].sign(0, bob.msKeys.keypair, bob.fundingTxObj.txout)

      // The transaction is not fully signed yet - only Bob has signed. Bob
      // sends the transaction back to Alice so she can finish signing it.
      alice.commitmentTxbs[1] = Txbuilder().fromJSON(bob.otherCommitmentTxbs[1].toJSON())

      // TODO: Alice performs checks to make sure that the transaction builder
      // is the same as before, but also signed by Bob.

      // Now that Alice has the commitment transaction back, and is signed by
      // Bob, she signs it herself, making it fully valid.
      alice.commitmentTxbs[1].sign(0, alice.msKeys.keypair, alice.fundingTxObj.txout)
      Txverifier(alice.commitmentTxbs[1].tx, alice.commitmentTxbs[1].utxoutmap).verifystr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

      // Only Alice has her fully signed commitment tx. Alice can revoke the
      // output destination to herself. Bob also needs a fully signed commitment
      // tx, where he can revoke the output destination to himself.

      // Bob makes the revokable output script for herself
      bob.RHTLCOutputScripts[1] = makeRHTLCOutputScript(bob.otherPaymentKeys.pubkey, bob.paymentKeys.pubkey, bob.RHTLCSecrets[1].hash, bob.otherHTLCSecrets[1].hash)

      // Bob makes the HTLC output for paying to Bob
      bob.HTLCOutputScripts[1] = makeHTLCOutputScript(bob.otherPaymentKeys.pubkey, bob.paymentKeys.pubkey, bob.otherHTLCSecrets[1].hash)

      // Bob assembles his commitment tx. The outputs are different that
      // Alice's commitment tx. Bob spends the money to his revokable output
      // script, and the change to an HTLC output script spendable by Alice.
      bob.commitmentTxbs[1] = Txbuilder()
      bob.commitmentTxbs[1].fromScripthashMultisig(bob.fundingTxObj.hash, bob.fundingTxObj.txoutnum, bob.fundingTxObj.txout, bob.msRedeemScript)
      bob.commitmentTxbs[1].toScript(BN(100000), bob.RHTLCOutputScripts[1])
      bob.commitmentTxbs[1].setChangeScript(bob.HTLCOutputScripts[1])
      bob.commitmentTxbs[1].build()

      // Bob does not yet sign the commitment tx. He sends it to Alice.
      alice.otherCommitmentTxbs[1] = Txbuilder().fromJSON(bob.commitmentTxbs[1].toJSON())

      // Here Alice needs to check that the transaction is something she is
      // really willing to accept. We will skip the checking for now and assume
      // it correct. TODO: Perform all the necessary checks so Alice knows and
      // agrees with what she is signing.

      // Alice signs the transaction.
      alice.otherCommitmentTxbs[1].sign(0, alice.msKeys.keypair, alice.fundingTxObj.txout)

      // Alice sends it back to Bob.
      bob.commitmentTxbs[1] = Txbuilder().fromJSON(alice.otherCommitmentTxbs[1].toJSON())

      // TODO: Bob performs checks to make sure that the transaction builder is
      // the same as before, but also signed by Alice.

      // Bob now signs it, making his commitment tx fully signed and valid.
      bob.commitmentTxbs[1].sign(0, bob.msKeys.keypair, bob.fundingTxObj.txout)
      Txverifier(bob.commitmentTxbs[1].tx, alice.commitmentTxbs[1].utxoutmap).verifystr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

      // Alice and Bob now both have their versions of the first payment
      // commitment tx. Normally they would not broadcast their transactions,
      // because they would like to keep the channel open. However, in order to
      // test the various scenarios, let's assume that Alice and Bob mutually
      // agree to settle.

      // First, assume Alice has broadcast her fully signed transaction
      // alice.commitmentTxbs[1].tx. Both Alice and Bob, therefore, share the
      // same settlement tx.
      alice.settlementTx = alice.commitmentTxbs[1].tx
      bob.settlementTx = alice.commitmentTxbs[1].tx

      // To spend his output, Bob has managed to acquire the HTLC secret. Since
      // this payment is being made to Bob, the HTLC secret is the one he
      // generated. He also must wait 1 day for the CSV lock to expire.
      bob.settlementHTLCSecret = bob.HTLCSecrets[1].secret

      // First, Bob spends because he (somehow) found the RHTLC secret.
      bob.settlementSpendTxb = Txbuilder()
      let inputScript = Script()
        .writeBuffer(bob.settlementHTLCSecret)
        .writeOpcode(Opcode.OP_0) // to be replaced with signature
        .writeOpcode(Opcode.OP_TRUE)
      bob.settlementSpendTxb.fromScript(bob.settlementTx.hash(), 0, bob.settlementTx.txouts[0], inputScript)
      bob.settlementSpendTxb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      bob.settlementSpendTxb.build()
      let sig = bob.settlementSpendTxb.getSig(bob.paymentKeys.keypair, Sig.SIGHASH_ALL, 0, bob.settlementTx.txouts[0].script)
      inputScript.setChunkBuffer(1, sig.toTxFormat()) // insert sig into script
      bob.settlementSpendTxb.tx.txins[0].setScript(inputScript)
      Txverifier(bob.settlementSpendTxb.tx, bob.settlementSpendTxb.utxoutmap).verifystr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

      // TODO: Not finished!!!
    })
  })
})
