/**
 * Protocol Message
 * ================
 *
 * cmd: a short string specifying the command name, like 'open-channel'
 * args: a json stringifiable object
 */
let Struct = require('yours-bitcoin/lib/struct')

class Msg extends Struct {
  constructor (cmd, args = {}) {
    super()
    this.fromObject({cmd, args})
  }

  toJSON () {
    return {
      cmd: this.cmd,
      args: this.args
    }
  }

  fromJSON (json) {
    this.cmd = json.cmd
    this.args = json.args
    return this
  }
}

module.exports = Msg
