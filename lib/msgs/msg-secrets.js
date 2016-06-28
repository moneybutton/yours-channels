/**
 * MsgSecrets
 * ==========
 *
 * When an agent needs to reveal the secret for a particular hash. This works
 * either for an HTLC secret or a revocation secret.
 */
'use strict'
let Secret = require('../scrts/secret')
let Msg = require('./msg')

class MsgSecrets extends Msg {
  constructor (args, chanId) {
    let cmd = 'secret'
    super(cmd, args, chanId)
  }

  setSecrets (secrets) {
    this.args.secrets = secrets.map((secret) => secret.toJSON())
  }

  getSecrets () {
    return this.args.secrets.map((secret) => new Secret().fromJSON(secret))
  }
}

module.exports = MsgSecrets
