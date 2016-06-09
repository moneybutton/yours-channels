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

    let bip32_1 = bip32.derive('m/0/1')
    ;(bip32_1.privKey instanceof PrivKey).should.equal(true)
    ;(bip32_1.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32_1.pubKey) instanceof Address).should.equal(true)

    let bip32_2 = bip32.derive('m/0/2')
    ;(bip32_2.privKey instanceof PrivKey).should.equal(true)
    ;(bip32_2.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32_2.pubKey) instanceof Address).should.equal(true)

    let bip32_3 = bip32.derive('m/0/3')
    ;(bip32_3.privKey instanceof PrivKey).should.equal(true)
    ;(bip32_3.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32_3.pubKey) instanceof Address).should.equal(true)

    // Now you can share your *public* bip32 object with someone else, and they
    // can generate the same public keys, but not the private keys
    let bip32pub = bip32.toPublic()

    let bip32pub_1 = bip32pub.derive('m/0/1')
    ;(bip32pub_1.privKey instanceof PrivKey).should.equal(false)
    ;(bip32pub_1.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32pub_1.pubKey) instanceof Address).should.equal(true)
    Address.fromPubKey(bip32pub_1.pubKey).toString().should.equal(Address.fromPubKey(bip32_1.pubKey).toString())

    let bip32pub_2 = bip32pub.derive('m/0/2')
    ;(bip32pub_2.privKey instanceof PrivKey).should.equal(false)
    ;(bip32pub_2.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32pub_2.pubKey) instanceof Address).should.equal(true)
    Address.fromPubKey(bip32pub_2.pubKey).toString().should.equal(Address.fromPubKey(bip32_2.pubKey).toString())

    let bip32pub_3 = bip32pub.derive('m/0/3')
    ;(bip32pub_3.privKey instanceof PrivKey).should.equal(false)
    ;(bip32pub_3.pubKey instanceof PubKey).should.equal(true)
    ;(Address.fromPubKey(bip32pub_3.pubKey) instanceof Address).should.equal(true)
    Address.fromPubKey(bip32pub_3.pubKey).toString().should.equal(Address.fromPubKey(bip32_3.pubKey).toString())
  })

  it('secrets and hashes', function () {
    let bip32 = Bip32.fromRandom()

    let bip32_1 = bip32.derive('m/0/1')
    let secret_1 = bip32_1.pubKey.toBuffer()
    let hash_1 = Hash.sha256Ripemd160(secret_1)
    hash_1.length.should.equal(20)

    let bip32_2 = bip32.derive('m/0/2')
    let secret_2 = bip32_2.pubKey.toBuffer()
    let hash_2 = Hash.sha256Ripemd160(secret_2)
    hash_2.length.should.equal(20)

    let bip32_3 = bip32.derive('m/0/3')
    let secret_3 = bip32_3.pubKey.toBuffer()
    let hash_3 = Hash.sha256Ripemd160(secret_3)
    hash_3.length.should.equal(20)
  })
})
