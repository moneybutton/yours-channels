/* global describe,it,beforeEach */
'use strict'
let should = require('should')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let Output = require('../lib/output')
let HltcSecret = require('../lib/scrts/htlc-secret')
let RevSecret = require('../lib/scrts/rev-secret')

let outputDesc

describe('Output', function () {
  it('should exist', function () {
    should.exist(Output)
    should.exist(new Output())
  })

  beforeEach(function () {
    return asink(function * () {
      outputDesc = new Output('Alice')
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
    it('should create a public Output object', function () {
      return asink(function * () {
        let publicOutput = outputDesc.toPublic()
        should.exist(publicOutput)
        should.exist(publicOutput.channelSourcePath)
        should.exist(publicOutput.channelDestPath)
        should.exist(publicOutput.networkSourceId)
        should.exist(publicOutput.channelSourceId)
        should.exist(publicOutput.channelDestId)
        should.exist(publicOutput.networkDestId)
        should.exist(publicOutput.kind)
        should.exist(publicOutput.htlcSecret.hash)
        should.not.exist(publicOutput.htlcSecret.buf)
        should.exist(publicOutput.revSecret.hash)
        should.not.exist(publicOutput.revSecret.buf)
        should.exist(publicOutput.amount)
      }, this)
    })
  })
})
