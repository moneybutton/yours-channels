/* global describe,it */
'use strict'
let Address = require('fullnode/lib/address')
let BN = require('fullnode/lib/bn')
let Hash = require('fullnode/lib/hash')
let Interp = require('fullnode/lib/interp')
let Keypair = require('fullnode/lib/keypair')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Script = require('fullnode/lib/script')
let Sig = require('fullnode/lib/sig')
let Txbuilder = require('fullnode/lib/txbuilder')
let Txout = require('fullnode/lib/txout')
let Txverifier = require('fullnode/lib/txverifier')
let Opcode = require('fullnode/lib/opcode')
require('should')

describe('Script Examples', function () {
  describe('CHECKLOCKTIMEVERIFY (CLTV)', function () {
    it('should lock up funds until block 100', function () {
      // This example spends to an output that requires a normal signature and
      // also for the transaction locktime to be at least 100. The sequence
      // number seqnum is set to an arbitrary value less than 0xffffffff, which
      // is necessary to enable CLTV.
      //
      // scriptPubkey: OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
      // scriptSig: <sig> <nlocktime>

      let scriptnlocktime = 100
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)
      let scriptPubkey = Script()
        .writeOpcode(Opcode.OP_CHECKLOCKTIMEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
        .writeBN(BN(scriptnlocktime))
      let txb = Txbuilder()
      let txhashbuf = new Buffer(32)
      txhashbuf.fill(0)
      let txoutnum = 0
      let txout = Txout(BN(500000)).setScript(scriptPubkey)
      let seqnum = 0xf0f0f0f0
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, seqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      let sig, txnlocktime

      // tx lock time too low - tx invalid
      txnlocktime = 99
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(false)

      // tx lock time high enough - tx valid
      txnlocktime = 100
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
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
      // scriptSig: <sig> <nlocktime> <redeemScript>
      // redeemScript: OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG

      let scriptnlocktime = 100
      let privkey = Privkey().fromRandom()
      let pubkey = Pubkey().fromPrivkey(privkey)
      let keypair = Keypair(privkey, pubkey)
      let redeemScript = Script()
        .writeOpcode(Opcode.OP_CHECKLOCKTIMEVERIFY)
        .writeOpcode(Opcode.OP_DROP)
        .writeBuffer(pubkey.toBuffer())
        .writeOpcode(Opcode.OP_CHECKSIG)
      let scriptSig = Script()
        .writeOpcode(Opcode.OP_0) // signature - will be replaced with actual signature
        .writeBN(BN(scriptnlocktime))
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
      let seqnum = 0xf0f0f0f0
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, seqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      let sig, txnlocktime

      // tx lock time too low - tx invalid
      txnlocktime = 99
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(false)

      // tx lock time high enough - tx valid
      txnlocktime = 100
      txb.setNLocktime(txnlocktime)
      txb.build()
      sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, redeemScript)
      scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
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
      let seqnum = 0xf0f0f0f0
      txb.fromScript(txhashbuf, txoutnum, txout, scriptSig, seqnum)
      txb.setChangeAddress(Address().fromPrivkey(Privkey().fromRandom()))
      txb.toAddress(BN(100000), Address().fromPrivkey(Privkey().fromRandom()))

      txb.build()
      let sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
      scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
      txb.tx.txins[0].setScript(scriptSig)
      Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)
    })
  })
})
