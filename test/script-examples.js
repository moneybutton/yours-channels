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
    it('should enable spending funds when sig and value that hashes correctly is in input', function () {
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

    it('should enable spending funds when sig and value that hashes correctly is in input with a p2sh transaction', function () {
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
      let txout = Txout(BN(500000)).setScript(scriptPubkey)
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      txb.build()
      let sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.setChunkBuffer(0, sig.toTxFormat())
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
    })
  })

  describe('Yours Lightning Network', function () {
    // Based on Clemens' document: yours-lightning.md
    it('should send payments from alice to bob', function () {
      this.timeout(10000)
      let alice = {}
      let bob = {}

      // Creating addresses to receive payments.
      alice.paymentKeypair = Keypair().fromRandom()
      alice.paymentAddress = Address().fromPubkey(alice.paymentKeypair.pubkey)
      bob.paymentKeypair = Keypair().fromRandom()
      bob.paymentAddress = Address().fromPubkey(alice.paymentKeypair.pubkey)
      alice.otherPaymentPubkey = bob.paymentKeypair.pubkey
      bob.otherPaymentPubkey = alice.paymentKeypair.pubkey

      // Creating the multisig address.
      alice.msKeypair = Keypair().fromRandom()
      bob.msKeypair = Keypair().fromRandom()
      alice.otherMsPubkey = bob.msKeypair.pubkey
      bob.otherMsPubkey = alice.msKeypair.pubkey
      alice.msRedeemScript = Script().fromPubkeys(2, [alice.msKeypair.pubkey, alice.otherMsPubkey])
      alice.msAddress = Address().fromRedeemScript(alice.msRedeemScript)
      bob.msRedeemScript = Script().fromPubkeys(2, [bob.msKeypair.pubkey, bob.otherMsPubkey])
      bob.msAddress = Address().fromRedeemScript(bob.msRedeemScript)

      // Confirm that Alice and Bob have created the same address.
      bob.msAddress.toString().should.equal(alice.msAddress.toString())

      // Building, signing, and verifying the funding tx. We assume the payment
      // is made from a normal pubkeyhash address.
      alice.fundingTxInputKeypair = Keypair().fromRandom()
      alice.fundingTxInputAddress = Address().fromPubkey(alice.fundingTxInputKeypair.pubkey)
      alice.fundingTxChangeKeypair = Keypair().fromRandom()
      alice.fundingTxChangeAddress = Address().fromPubkey(alice.fundingTxChangeKeypair.pubkey)
      alice.fundingScriptPubkey = alice.fundingTxInputAddress.toScript()
      alice.fundingTxb = Txbuilder()
      alice.fundingInputTxHashbuf = new Buffer(32)
      alice.fundingInputTxHashbuf.fill(0)
      alice.fundingInputTxoutnum = 0
      alice.fundingInputTxout = Txout(BN(500000)).setScript(alice.fundingScriptPubkey)
      alice.fundingTxb.fromPubkeyhash(alice.fundingInputTxHashbuf, alice.fundingInputTxoutnum, alice.fundingInputTxout, alice.fundingTxInputKeypair.pubkey)
      alice.fundingTxb.setChangeAddress(alice.fundingTxChangeAddress)
      alice.fundingTxb.toAddress(BN(100000), alice.msAddress)
      alice.fundingTxb.build()
      alice.fundingTxb.sign(0, alice.fundingTxInputKeypair, alice.fundingInputTxout)
      Txverifier(alice.fundingTxb.tx, alice.fundingTxb.utxoutmap).verifystr(Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY).should.equal(false) // verifystr returns a string on error, or false if the tx is valid

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
      alice.fundingTxHashbuf = alice.fundingTxb.tx.hash()
      alice.fundingTxOutnum = 0
      alice.fundingTxAmount = BN(100000)
      alice.revokeSecret1 = Random.getRandomBuffer(32)
      alice.revokeHash1 = Hash.sha256ripemd160(alice.revokeSecret1)
      alice.commitmentTxb1 = Txbuilder()
      alice.commitmentTxb1.fromScripthashMultisig(alice.fundingTxHashbuf, alice.fundingTxOutnum, alice.fundingTxb.tx.txouts[0], alice.msRedeemScript)

      // Alice needs the hash of Bob's secrets to continue building the tx.
      // Alice and bob generate revoke secrets and HTLC secrets and share their
      // hashes.
      alice.revokeSecret1 = Random.getRandomBuffer(32)
      alice.revokeHash1 = Hash.sha256ripemd160(alice.revokeSecret1)
      bob.revokeSecret1 = Random.getRandomBuffer(32)
      bob.revokeHash1 = Hash.sha256ripemd160(alice.revokeSecret1)
      alice.htlcSecret1 = Random.getRandomBuffer(32)
      alice.htlcHash1 = Hash.sha256ripemd160(alice.htlcSecret1)
      bob.htlcSecret1 = Random.getRandomBuffer(32)
      bob.htlcHash1 = Hash.sha256ripemd160(alice.htlcSecret1)
      alice.otherRevokeHash1 = bob.revokeHash1
      alice.otherHtlcHash1 = bob.htlcHash1
      bob.otherRevokeHash1 = alice.revokeHash1
      bob.otherHtlcHash1 = alice.htlcHash1

      // Alice creates the RHTLC output to herself.
      alice.refundOutputScript = Script()
        .writeOpcode(Opcode.OP_IF)
          .writeBuffer(alice.otherPaymentPubkey.toBuffer())
          .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
          .writeOpcode(Opcode.OP_HASH160)
          .writeBuffer(alice.revokeHash1)
          .writeOpcode(Opcode.OP_EQUALVERIFY)
        .writeOpcode(Opcode.OP_ELSE)
          .writeOpcode(Opcode.OP_IF)
            .writeBN(BN(6 * 24)) // one day = six blocks per hour for 24 hours
            .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
            .writeOpcode(Opcode.OP_DROP)
            .writeBuffer(alice.otherPaymentPubkey.toBuffer())
            .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
            .writeOpcode(Opcode.OP_HASH160)
            .writeBuffer(alice.otherHtlcHash1)
            .writeOpcode(Opcode.OP_EQUALVERIFY)
          .writeOpcode(Opcode.OP_ELSE)
            .writeBN(BN(6 * 48)) // two days = six blocks per hour for 48 hours
            .writeOpcode(Opcode.OP_CHECKSEQUENCEVERIFY)
            .writeOpcode(Opcode.OP_DROP)
            .writeBuffer(alice.paymentKeypair.pubkey.toBuffer())
            .writeOpcode(Opcode.OP_CHECKSIGVERIFY)
          .writeOpcode(Opcode.OP_ENDIF)
        .writeOpcode(Opcode.OP_ENDIF)

      // Alice does NOT create an HTLC output to Bob yet - since that would
      // only send 0 bitcoins at this point.

      // Alice sets the RHTLC output to herself as the change of the txbuilder
      // - that is, the total amount sent back to herself will be everything
      // not sent in one of the other outputs minus the fee. Since there will
      // be no other outputs, it's just the total input amount minus the fee.
      alice.commitmentTxb1.setChangeScript(alice.refundOutputScript)

      // Alice now builds the tx. It has only one output - the RHTLC output
      // going back to Alice.
      alice.commitmentTxb1.build()

      // Alice does not yet sign the commitment tx. She sends it to Bob.
      bob.commitmentTx = Txbuilder().fromJSON(alice.commitmentTxb1.toJSON())

      // TODO: Not finished!!!
    })
  })
})
