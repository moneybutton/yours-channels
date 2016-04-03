/* global describe,it */
'use strict'
let Address = require('fullnode/lib/address')
let BN = require('fullnode/lib/bn')
let Privkey = require('fullnode/lib/privkey')
let Pubkey = require('fullnode/lib/pubkey')
let Script = require('fullnode/lib/script')
let Sig = require('fullnode/lib/sig')
let Txbuilder = require('fullnode/lib/txbuilder')
let Txverifier = require('fullnode/lib/txverifier')
let Txout = require('fullnode/lib/txout')
let Keypair = require('fullnode/lib/keypair')
let Interp = require('fullnode/lib/interp')
let Opcode = require('fullnode/lib/opcode')
require('should')

describe('Examples of how to use CLTV', function () {
  it('lock up funds until block 100', function () {
    let scriptnlocktime = 100
    let txnlocktime = 101
    let privkey = Privkey().fromRandom()
    let pubkey = Pubkey().fromPrivkey(privkey)
    let keypair = Keypair(privkey, pubkey)
    let scriptPubkey = Script()
      .writeOpcode(Opcode.OP_CHECKLOCKTIMEVERIFY)
      .writeOpcode(Opcode.OP_DROP)
      .writeBuffer(pubkey.toBuffer())
      .writeOpcode(Opcode.OP_CHECKSIG)
    let scriptSig = Script()
      .writeOpcode(Opcode.OP_0)
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

    txb.setNLocktime(txnlocktime)
    txb.build()
    let sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
    scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
    txb.tx.txins[0].setScript(scriptSig)
    Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(true)

    txnlocktime = 99
    txb.setNLocktime(txnlocktime)
    txb.build()
    sig = txb.getSig(keypair, Sig.SIGHASH_ALL, 0, scriptPubkey)
    scriptSig.chunks[0] = Script().writeBuffer(sig.toTxFormat()).chunks[0]
    txb.tx.txins[0].setScript(scriptSig)
    Txverifier.verify(txb.tx, txb.utxoutmap, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY).should.equal(false)
  })
})
