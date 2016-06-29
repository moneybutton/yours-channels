/* global describe,it,beforeEach */
'use strict'
let should = require('should')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let OutputDesc = require('../lib/output')
let HltcSecret = require('../lib/scrts/htlc-secret')
let RevSecret = require('../lib/scrts/rev-secret')

let outputDesc

describe('OutputDesc', function () {
  it('should exist', function () {
    should.exist(OutputDesc)
    should.exist(new OutputDesc())
  })

  beforeEach(function () {
    return asink(function * () {
      outputDesc = new OutputDesc('Alice')
      outputDesc.channelSourcePath = 'm/1/5'
      outputDesc.channelDestPath = 'm/3/7'
      outputDesc.networkSourceId = 'AliceId'
      outputDesc.channelSourceId = 'BobId'
      outputDesc.channelDestId = 'CarolId'
      outputDesc.networkDestId = 'DaveId'
      outputDesc.kind = 'htlc'
      outputDesc.htlcSecret = new HltcSecret()
      yield outputDesc.htlcSecret.asyncInitialize()
      outputDesc.revSecret = new RevSecret()
      yield outputDesc.revSecret.asyncInitialize()
      outputDesc.amount = new Bn(1e7)
    }, this)
  })

  describe('#toJSON', function () {
    it('should create a json object', function () {
      return asink(function * () {
        let json = outputDesc.toJSON()
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
    it('should create a public OutputDesc object', function () {
      return asink(function * () {
        let publicOutputDesc = outputDesc.toPublic()
        should.exist(publicOutputDesc)
        should.exist(publicOutputDesc.channelSourcePath)
        should.exist(publicOutputDesc.channelDestPath)
        should.exist(publicOutputDesc.networkSourceId)
        should.exist(publicOutputDesc.channelSourceId)
        should.exist(publicOutputDesc.channelDestId)
        should.exist(publicOutputDesc.networkDestId)
        should.exist(publicOutputDesc.kind)
        should.exist(publicOutputDesc.htlcSecret.hash)
        should.not.exist(publicOutputDesc.htlcSecret.buf)
        should.exist(publicOutputDesc.revSecret.hash)
        should.not.exist(publicOutputDesc.revSecret.buf)
        should.exist(publicOutputDesc.amount)
      }, this)
    })
  })
})
