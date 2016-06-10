/* global describe,it */
'use strict'
let Msg = require('../../lib/msgs/msg')
let should = require('should')

describe('Msg', function () {
  it('should exist', function () {
    should.exist(Msg)
    should.exist(new Msg())
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
        args: ['arg1', 'arg2']
      })
      msg.cmd.should.equal('command-name')
      msg.args[0].should.equal('arg1')
      msg.args[1].should.equal('arg2')
    })
  })
})
