/**
 * Protocol Message
 * ================
 *
 * - cmd: A short string specifying the command name, like 'open-channel'
 * - args: A json stringifiable object
 * - chanId: The id of the channel, which is the string form of the multiSig
 * address for the funding transaction of this channel.
 * - convId: The id of the conversation - often, a long series of messages need
 * to be exchanged in a particular order. Each sequence needs to share the same
 * 'conversation id' or 'convId'.
 */
let Struct = require('yours-bitcoin/lib/struct')
let Random = require('yours-bitcoin/lib/random')

class Msg extends Struct {
  constructor (
    cmd,
    args = {},
    chanId,
    convId = Random.getRandomBuffer(16).toString('hex'),
    chanPath = 'm'
  ) {
    super()
    this.fromObject({
      cmd,
      args,
      chanId,
      convId,
      chanPath
    })
  }

  setChanId (chanId) {
    this.chanId = chanId
    return this
  }

  getChanId () {
    return this.chanId
  }

  setChanPath (chanPath) {
    this.chanPath = chanPath
    return this
  }

  getChanPath () {
    return this.chanPath
  }

  setConvId (convId) {
    this.convId = convId
    return this
  }

  getConvId () {
    return this.convId
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
    // TODO: Check validity of chanPath
    if (typeof this.cmd !== 'string' || this.cmd.length > 30 || this.cmd.length < 1) {
      return false
    }
    if (typeof this.args !== 'object') {
      // this.args CAN be an array
      return false
    }
    if (typeof this.chanId !== 'string' || !(
      this.chanId.startsWith('3') || // mainnet
      this.chanId.startsWith('2') // testnet
    )) {
      return false
    }
    if (typeof this.convId !== 'string') {
      return false
    }
    return true
  }
}

module.exports = Msg
