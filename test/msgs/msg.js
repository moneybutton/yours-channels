/* global describe,it */
'use strict'
let Msg = require('../../lib/msgs/msg')
let Random = require('yours-bitcoin/lib/random')
let should = require('should')
let Address = require('yours-bitcoin/lib/address')
let Script = require('yours-bitcoin/lib/script')

describe('Msg', function () {
  it('should exist', function () {
    should.exist(Msg)
    should.exist(new Msg())
  })

  describe('#setChanId', function () {
    it('should set the chanId', function () {
      let chanId = Random.getRandomBuffer(16).toString('hex')
      let msg = new Msg()
      msg.setChanId(chanId)
      msg.chanId.should.equal(chanId)
    })
  })

  describe('#getChanId', function () {
    it('should get the chanId', function () {
      let chanId = Random.getRandomBuffer(16).toString('hex')
      let msg = new Msg()
      msg.setChanId(chanId)
      msg.getChanId().should.equal(chanId)
    })
  })

  describe('#setConvId', function () {
    it('should set the convId', function () {
      let convId = Random.getRandomBuffer(16).toString('hex')
      let msg = new Msg()
      msg.setConvId(convId)
      msg.convId.should.equal(convId)
    })
  })

  describe('#getConvId', function () {
    it('should get the convId', function () {
      let convId = Random.getRandomBuffer(16).toString('hex')
      let msg = new Msg()
      msg.setConvId(convId)
      msg.getConvId().should.equal(convId)
    })
  })

  describe('#toJSON', function () {
    it('should convert this msg into json', function () {
      let msg = new Msg('command-name', ['arg1', 'arg2'])
      let json = msg.toJSON()
      json.cmd.should.equal('command-name')
      json.args[0].should.equal('arg1')
      json.args[1].should.equal('arg2')
    })
  })

  describe('#fromJSON', function () {
    it('should convert this json into a msg', function () {
      let msg = Msg.fromJSON({
        cmd: 'command-name',
        args: ['arg1', 'arg2'],
        chanId: Random.getRandomBuffer(16).toString('hex')
      })
      msg.cmd.should.equal('command-name')
      msg.args[0].should.equal('arg1')
      msg.args[1].should.equal('arg2')
    })
  })

  describe('#isValid', function () {
    it('should know this is a valid msg with mainnet id', function () {
      let msg = new Msg('command-name', ['arg1', 'arg2'])
      let chanId = Address.Mainnet.fromRedeemScript(Script.fromString('OP_RETURN')).toString()
      msg.setChanId(chanId)
      msg.isValid().should.equal(true)
    })

    it('should know this is a valid msg with testnet id', function () {
      let msg = new Msg('command-name', ['arg1', 'arg2'])
      let chanId = Address.Testnet.fromRedeemScript(Script.fromString('OP_RETURN')).toString()
      msg.setChanId(chanId)
      msg.isValid().should.equal(true)
    })
  })
})
