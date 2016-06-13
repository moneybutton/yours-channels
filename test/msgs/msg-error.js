/* global describe,it */
'use strict'
let MsgError = require('../../lib/msgs/msg-error')
let should = require('should')

describe('MsgError', function () {
  it('should exist', function () {
    should.exist(MsgError)
    should.exist(new MsgError())
  })

  describe('#constructor', function () {
    it('should set the command name', function () {
      let msg = new MsgError()
      msg.cmd.should.equal('error')
    })
  })

  describe('#setErrorString', function () {
    it('should set the error string', function () {
      let msg = new MsgError()
      msg.setErrorString('error message')
      msg.args.error.should.equal('error message')
    })
  })

  describe('#getErrorString', function () {
    it('should get the error string', function () {
      let msg = new MsgError()
      msg.setErrorString('error message')
      let errStr = msg.getErrorString()
      errStr.should.equal('error message')
    })
  })
})
