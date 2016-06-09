/* global describe,it */
'use strict'
let should = require('should')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let OutputDescription = require('../lib/Output-description.js')
let HltcSecret = require('../lib/scrts/htlc-secret.js')
let RevocationSecret = require('../lib/scrts/revocation-secret.js')

describe('OutputDescription', function () {
  it('should exist', function () {
    should.exist(OutputDescription)
    should.exist(new OutputDescription())
  })

  describe('#toJSON', function () {
    it('should create a json object', function () {
      return asink(function *() {
        let outputDescription = new OutputDescription('Alice')
        outputDescription.intermediateDestId = 'BobId'
        outputDescription.finalDestId = 'CarolId'
        outputDescription.amount = new Bn(1e7)
        outputDescription.htlcSecret = new HltcSecret()
        yield outputDescription.htlcSecret.asyncInitialize()
        outputDescription.revocationSecret = new RevocationSecret()
        yield outputDescription.revocationSecret.asyncInitialize()

        let json = outputDescription.toJSON()
        should.exist(json)
        should.exist(json.intermediateDestId)
        should.exist(json.finalDestId)
        should.exist(json.amount)
        should.exist(json.htlcSecret.hash)
        should.exist(json.htlcSecret.buf)
        should.exist(json.revocationSecret.hash)
        should.exist(json.revocationSecret.buf)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('should create a public OutputDescription object', function () {
      return asink(function *() {
        let outputDescription = new OutputDescription('Alice')
        outputDescription.intermediateDestId = 'BobId'
        outputDescription.finalDestId = 'CarolId'
        outputDescription.amount = new Bn(1e7)
        outputDescription.htlcSecret = new HltcSecret()
        yield outputDescription.htlcSecret.asyncInitialize()
        outputDescription.revocationSecret = new RevocationSecret()
        yield outputDescription.revocationSecret.asyncInitialize()

        let publicOutputDescription = outputDescription.toPublic()
        should.exist(publicOutputDescription)
        should.exist(publicOutputDescription.intermediateDestId)
        should.exist(publicOutputDescription.finalDestId)
        should.exist(publicOutputDescription.amount)
        should.exist(publicOutputDescription.htlcSecret.hash)
        should.not.exist(publicOutputDescription.htlcSecret.buf)
        should.exist(publicOutputDescription.revocationSecret.hash)
        should.not.exist(publicOutputDescription.revocationSecret.buf)
      }, this)
    })
  })
})
