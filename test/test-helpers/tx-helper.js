let Tx = require('yours-bitcoin/lib/tx')
let Script = require('yours-bitcoin/lib/script')
let TxIn = require('yours-bitcoin/lib/tx-in')
let Address = require('yours-bitcoin/lib/address')
let Interp = require('yours-bitcoin/lib/interp')
let Bn = require('yours-bitcoin/lib/bn')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let KeyPair = require('yours-bitcoin/lib/key-pair')
let Sig = require('yours-bitcoin/lib/sig')

/**
 * redeemScript is optional and only exists for p2sh transactions
 */
function interpCheckSig (scriptSig, scriptPubKey, privKey, sigPos, nSequence, redeemScript) {
  let tx1 = new Tx()
  {
    let txHashBuf = new Buffer(32)
    txHashBuf.fill(0)
    let txOutNum = 0
    let script = Script.fromString('OP_TRUE')
    tx1.versionBytesNum = 2
    tx1.addTxIn(txHashBuf, txOutNum, script, TxIn.SEQUENCE_FINAL)
  }

  {
    let script = scriptPubKey
    tx1.addTxOut(Bn(1e8), script)
  }

  let tx2 = new Tx()
  {
    let txHashBuf = new Buffer(32)
    txHashBuf.fill(0)
    // let txOutNum = 0
    // let script = Script.fromString('OP_TRUE')
    tx2.versionBytesNum = 2
    tx2.addTxIn(tx1.hash(), 0, scriptSig, nSequence)
  }

  {
    let script = Address.fromPrivKey(PrivKey.fromRandom())
    tx2.addTxOut(Bn(1e8), script)
  }

  {
    let keyPair = KeyPair.fromPrivKey(privKey)
    let nHashType = Sig.SIGHASH_ALL
    let nIn = 0
    let subScript = redeemScript || scriptPubKey
    let sig = tx2.sign(keyPair, nHashType, nIn, subScript)
    scriptSig = Script.fromBuffer(scriptSig.toBuffer())
    scriptSig.setChunkBuffer(sigPos, sig.toTxFormat())
    tx2.txIns[0].setScript(scriptSig)
  }

  let interp = new Interp()
  let verified = interp.verify(scriptSig, scriptPubKey, tx2, 0, Interp.SCRIPT_VERIFY_P2SH | Interp.SCRIPT_VERIFY_CHECKLOCKTIMEVERIFY | Interp.SCRIPT_VERIFY_CHECKSEQUENCEVERIFY)

  let debugString = interp.getDebugString()
  return {verified, interp, debugString}
}

module.exports.interpCheckSig = interpCheckSig
