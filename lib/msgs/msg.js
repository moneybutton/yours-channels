/**
 * Protocol Message
 * ================
 *
 * cmd: a short string specifying the command name, like 'open-channel'
 * args: a json stringifiable object
 * chanId: the id of the channel; normally a 32 character hex string
 */
let Struct = require('yours-bitcoin/lib/struct')
let Random = require('yours-bitcoin/lib/random')

class Msg extends Struct {
  constructor (cmd, args = {}, chanId = Random.getRandomBuffer(16).toString('hex')) {
    super()
    this.fromObject({cmd, args, chanId})
  }

  setChanId (chanId) {
    this.chanId = chanId
    return this
  }

  getChanId () {
    return this.chanId
  }

  toJSON () {
    return {
      cmd: this.cmd,
      args: this.args,
      chainId: this.chanId
    }
  }

  fromJSON (json) {
    this.cmd = json.cmd
    this.args = json.args
    this.chainId = json.chanId
    return this
  }

  isValid () {
    if (typeof this.cmd !== 'string' || this.cmd.length > 30 || this.cmd.length < 1) {
      return false
    }
    if (typeof this.args !== 'object') {
      // this.args CAN be an array
      return false
    }
    if (typeof this.chanId !== 'string') {
      return false
    }
    return true
  }
}

module.exports = Msg
