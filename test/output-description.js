/* global describe,it,beforeEach */
'use strict'
let should = require('should')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let OutputDescription = require('../lib/output-description')
let HltcSecret = require('../lib/scrts/htlc-secret')
let RevSecret = require('../lib/scrts/rev-secret')

let outputDescription

describe('OutputDescription', function () {
  it('should exist', function () {
    should.exist(OutputDescription)
    should.exist(new OutputDescription())
  })

  beforeEach(function () {
    return asink(function * () {
      outputDescription = new OutputDescription('Alice')
      outputDescription.channelSourcePath = 'm/1/5'
      outputDescription.channelDestPath = 'm/3/7'
      outputDescription.networkSourceId = 'AliceId'
      outputDescription.channelSourceId = 'BobId'
      outputDescription.channelDestId = 'CarolId'
      outputDescription.networkDestId = 'DaveId'
      outputDescription.kind = 'htlc'
      outputDescription.htlcSecret = new HltcSecret()
      yield outputDescription.htlcSecret.asyncInitialize()
      outputDescription.revSecret = new RevSecret()
      yield outputDescription.revSecret.asyncInitialize()
      outputDescription.amount = new Bn(1e7)
    }, this)
  })

  describe('#toJSON', function () {
    it('should create a json object', function () {
      return asink(function * () {
        let json = outputDescription.toJSON()
        should.exist(json)
        should.exist(json.channelSourcePath)
        should.exist(json.channelDestPath)
        should.exist(json.networkSourceId)
        should.exist(json.channelSourceId)
        should.exist(json.channelDestId)
        should.exist(json.networkDestId)
        should.exist(json.kind)
        should.exist(json.htlcSecret.hash)
        should.exist(json.htlcSecret.buf)
        should.exist(json.revSecret.hash)
        should.exist(json.revSecret.buf)
        should.exist(json.amount)
      }, this)
    })
  })

  describe('#toPublic', function () {
    it('should create a public OutputDescription object', function () {
      return asink(function * () {
        let publicOutputDescription = outputDescription.toPublic()
        should.exist(publicOutputDescription)
        should.exist(publicOutputDescription.channelSourcePath)
        should.exist(publicOutputDescription.channelDestPath)
        should.exist(publicOutputDescription.networkSourceId)
        should.exist(publicOutputDescription.channelSourceId)
        should.exist(publicOutputDescription.channelDestId)
        should.exist(publicOutputDescription.networkDestId)
        should.exist(publicOutputDescription.kind)
        should.exist(publicOutputDescription.htlcSecret.hash)
        should.not.exist(publicOutputDescription.htlcSecret.buf)
        should.exist(publicOutputDescription.revSecret.hash)
        should.not.exist(publicOutputDescription.revSecret.buf)
        should.exist(publicOutputDescription.amount)
      }, this)
    })
  })
})
