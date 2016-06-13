/* global describe,it */
'use strict'
let Address = require('yours-bitcoin/lib/address')
let Bip32 = require('yours-bitcoin/lib/bip-32')
let Hash = require('yours-bitcoin/lib/hash')
let PrivKey = require('yours-bitcoin/lib/priv-key')
let PubKey = require('yours-bitcoin/lib/pub-key')
require('should')

describe('Example: Bip32 deterministic keys', function () {
  it('deterministic private keys, public keys, addresses', function () {
    let bip32 = Bip32.fromRandom()

    let bip32a = bip32.derive('m/0/1')
    ;(bip32a.privKey instanceof PrivKey).should.equal(true)
    ;(bip32a.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32a.pubKey) instanceof Address).should.equal(true)

    let bip32b = bip32.derive('m/0/2')
    ;(bip32b.privKey instanceof PrivKey).should.equal(true)
    ;(bip32b.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32b.pubKey) instanceof Address).should.equal(true)

    let bip32c = bip32.derive('m/0/3')
    ;(bip32c.privKey instanceof PrivKey).should.equal(true)
    ;(bip32c.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32c.pubKey) instanceof Address).should.equal(true)

    // Now you can share your *public* bip32 object with someone else, and they
    // can generate the same public keys, but not the private keys
    let bip32pub = bip32.toPublic()

    let bip32puba = bip32pub.derive('m/0/1')
    ;(bip32puba.privKey instanceof PrivKey).should.equal(false)
    ;(bip32puba.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32puba.pubKey) instanceof Address).should.equal(true)
    Address.fromPubKey(bip32puba.pubKey).toString().should.equal(Address.fromPubKey(bip32a.pubKey).toString())

    let bip32pubb = bip32pub.derive('m/0/2')
    ;(bip32pubb.privKey instanceof PrivKey).should.equal(false)
    ;(bip32pubb.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32pubb.pubKey) instanceof Address).should.equal(true)
    Address.fromPubKey(bip32pubb.pubKey).toString().should.equal(Address.fromPubKey(bip32b.pubKey).toString())

    let bip32pubc = bip32pub.derive('m/0/3')
    ;(bip32pubc.privKey instanceof PrivKey).should.equal(false)
    ;(bip32pubc.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32pubc.pubKey) instanceof Address).should.equal(true)
    Address.fromPubKey(bip32pubc.pubKey).toString().should.equal(Address.fromPubKey(bip32c.pubKey).toString())
  })

  it('secrets and hashes', function () {
    let bip32 = Bip32.fromRandom()

    let bip32a = bip32.derive('m/0/1')
    let secreta = bip32a.pubKey.toBuffer()
    let hasha = Hash.sha256Ripemd160(secreta)
    hasha.length.should.equal(20)

    let bip32b = bip32.derive('m/0/2')
    let secretb = bip32b.pubKey.toBuffer()
    let hashb = Hash.sha256Ripemd160(secretb)
    hashb.length.should.equal(20)

    let bip32c = bip32.derive('m/0/3')
    let secretc = bip32c.pubKey.toBuffer()
    let hashc = Hash.sha256Ripemd160(secretc)
    hashc.length.should.equal(20)
  })
})
