/* global describe,it */
'use strict'
let should = require('should')
let OutputDescription = require('../lib/output-description.js')

describe('OutputDescription', function () {
  it('should exist', function () {
    should.exist(OutputDescription)
    should.exist(new OutputDescription())
  })
})
