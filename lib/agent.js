'use strict'
let Struct = require('yours-bitcoin/lib/struct')
let asink = require('asink')
let Bn = require('yours-bitcoin/lib/bn')
let Multisig = require('./addrs/multisig')
let KeyPairAddress = require('./addrs/key-pair-address')
let HtlcSecret = require('./scrts/htlc-secret')
let RevSecret = require('./scrts/rev-secret')
let Funding = require('./txs/funding')
let Commitment = require('./txs/commitment')
let Wallet = require('./wallet')

class Agent extends Struct {
  constructor (id,
    sourceAddress, // the address that the funding transaction is funded from
    multisigAddress, // the shared multisigAddress address
    destinationAddress, // the address that the spending transactions spend to
    funding, // an object storing information about the funding tx
    commitments, // a list of objects storing information about previous commitment txs
    wallet, // the wallet (dummy for now)
    initialized, // boolean, set to true once local initialization is complete
    funder, // boolean, set to true if agent funds the channel
    sender, // boolean, set to true if agent has sent the last payment
    other, // public information about the other agent and all commitment txs that he stores
    remoteAgent // used temporarily to communicate with the other agent (will go away once we integrate msgs)
  ) {
    super()
    this.fromObject({id,
      sourceAddress,
      multisigAddress,
      destinationAddress,
      funding,
      commitments,
      wallet,
      initialized,
      funder,
      sender,
      other,
      remoteAgent
    })
  }

  /* ---- INITIALIZATION ---- */

  /*
   * Initializes an agent locally. In particular, the sourceAddress address, the multisigAddress
   * address, the destinationAddress address are initialized. The list of commitment txouts
   * is initialized with secrets for the next payment.
   */
  asyncInitialize (sourcePrivKey, multisigPrivKey, destinationPrivKey) {
    return asink(function * () {
      if (!sourcePrivKey || !multisigPrivKey || !destinationPrivKey || sourcePrivKey.constructor.name !== 'PrivKey' || multisigPrivKey.constructor.name !== 'PrivKey' || destinationPrivKey.constructor.name !== 'PrivKey') {
        throw new Error('sourcePrivKey, multisigPrivKey, destinationPrivKey must be PrivKeys and are required in asyncInitialize')
      }

      // the address that's the input to the sourceAddress trasnaction
      this.sourceAddress = new KeyPairAddress()
      yield this.sourceAddress.asyncInitialize(sourcePrivKey)

      // the shared multisigAddress address
      this.multisigAddress = new Multisig()
      yield this.multisigAddress.initializePrivKey(multisigPrivKey)

      // the address that's the output to a commitment trasnaction
      this.destinationAddress = new KeyPairAddress()
      yield this.destinationAddress.asyncInitialize(destinationPrivKey)

      // initialize first commitment
      this.commitments = []
      // yield this.asyncInitializeCommitment()

      // the wallet
      this.wallet = new Wallet()

      this.initialized = true
    }, this)
  }

  /* ---- PROTOCOL ---- */

  /*
   * This is the first point of communication between the two agents. Arguments are
   * the amount to fund the channel with and the public projection of the other agent.
   * Stores the public information about the other agent and initializes the multisigAddress
   * address. The funder of the channel will build the funding transaction and send
   * it's hash to the other party.
   */
  asyncOpenChannel (amount, publicOther) {
    return asink(function * () {
      // initialize information about other agent
      this.other = publicOther

      // initialize multisigAddress
      yield this.multisigAddress.asyncInitialize(this.other.multisigAddress.pubKey)

      if (!this.funder) {
        // send your information to the other agent
        // TODO sign fundingTx and send back to funder
        yield this.remoteAgent.asyncOpenChannel(amount, yield this.asyncToPublic())
      } else {
        // the funder will build the sourceAddress transaction and cache it's hashbuf and txout
        let fee = Bn(20000)
        let output = this.wallet.getUnspentOutput(amount.add(fee), this.sourceAddress.keyPair.pubKey)

        this.funding = new Funding()
        this.funding.asyncInitialize(amount, this.sourceAddress, this.multisigAddress,
          output.txhashbuf, output.txoutnum, output.txout, output.pubKey)

        // send the sourceAddress tx hash to the other agent
        this.remoteAgent.setFunding(yield this.funding.asyncToPublic())
      }
    }, this)
  }

  asyncSendOutputs (outputs, changeOutput) {
    return asink(function * () {
      if (!this.multisigAddress || !this.funding) {
        throw new Error('Agent not sufficiently initialized in asyncSendOutputs')
      }

      // create new commitment and add all info that is not realted to builder vs owner
      let commitment = new Commitment()
      commitment.revSecret = new RevSecret()
      yield commitment.revSecret.asyncInitialize()
      commitment.multisigAddress = this.multisigAddress
      commitment.funding = this.funding
      commitment.outputs = outputs.map((output) => this.completeOutput(output, commitment.revSecret))
      commitment.changeOutput = this.completeOutput(changeOutput, commitment.revSecret)
      this.commitments.push(commitment)
      this.other.commitments.push(commitment)

      if (!this.sender) {
        yield this.remoteAgent.asyncSendOutputs(outputs, changeOutput)
      } else {
        yield this.remoteAgent.asyncBuildCommitment()
      }
    }, this)
  }

  asyncBuildCommitment () {
    return asink(function * () {
      let otherCommitment = this.other.commitments.pop()
      otherCommitment.builderId = this.id
      otherCommitment.builderDestinationAddress = this.destinationAddress
      otherCommitment.ownerId = this.other.id
      otherCommitment.ownerDestinationAddress = this.other.destinationAddress
      yield otherCommitment.asyncBuild()
      this.other.commitments.push(otherCommitment)

      if (!this.sender) {
        yield this.remoteAgent.asyncBuildCommitment()
      } else {
        yield this.remoteAgent.sendCommitment(otherCommitment)
      }
    }, this)
  }

  sendCommitment (newCommitment) {
    return asink(function * () {
      let storedCommitment = this.commitments[this.commitments.length - 1]
      if (this.checkCommitment(storedCommitment, newCommitment)) {
        yield newCommitment.txb.asyncSign(0, this.multisigAddress.keyPair, this.funding.txb.tx.txOuts[0])

        this.commitments.pop()
        this.commitments.push(newCommitment)
      }

      if (!this.sender) {
        let otherCommitment = this.other.commitments[this.other.commitments.length - 1]
        yield this.remoteAgent.sendCommitment(otherCommitment)
      } else {
        let revSecret = this.getRevSecret()
        if (revSecret) {
          yield this.remoteAgent.sendRevSecret(revSecret)
        }
      }
    }, this)
  }

  sendRevSecret (revSecret) {
    return asink(function * () {
      // TODO
    }, this)
  }

  /* ---- SETTERS ---- */

  setFunding (txo) {
    this.funding = txo
  }

  setCommitment (txo) {
    this.commitments[this.commitments.length - 1] = txo
  }

  setOtherCommitment (txo) {
    this.other.commitments[this.other.commitments.length - 1] = txo
  }

  /* ---- GETTERS ---- */

  getRevSecret () {
    // if there is a transaction to revoke, return it's rev secret
    if (this.commitments.length > 1) {
      return this.commitments[this.commitments.length - 2].revSecret
    } else {
      return false
    }
  }

  /* ---- HELPERS ---- */

  completeOutput (output, revSecret) {
    if (output.intermediateDestId === this.id) {
      output.revSecret = revSecret
    }
    return output
  }

  checkCommitment (storedCommitment, newCommitment) {
    // TODO
    return true
  }

  // We have to delete other and remoteAgent and restore after constructing json.
  // Ideallt we'd call super.toJSON after that, but that's not possible due to
  // some stupid error (TODO)
  toJSON () {
    let other = this.other
    let remoteAgent = this.remoteAgent
    let that = this
    that.other = undefined
    that.remoteAgent = undefined
    var json = {}
    for (var val in this) {
      if (this[val] instanceof Array) {
        let arr = []
        for (var i in this[val]) {
          arr.push(this[val][i].toJSON())
        }
        json[val] = arr
      } else if (typeof this[val] === 'object') {
        json[val] = this[val].toJSON()
      } else if (typeof this[val] !== 'undefined') {
        json[val] = this[val]
      }
    }
    this.other = other
    this.remoteAgent = remoteAgent
    return json
  }

  fromJSON (json) {
    this.name = json.name
    this.sourceAddress = json.sourceAddress ? new KeyPairAddress().fromJSON(json.sourceAddress) : undefined
    this.multisigAddress = json.multisigAddress ? new Multisig().fromJSON(json.multisigAddress) : undefined
    this.destinationAddress = json.destinationAddress ? new KeyPairAddress().fromJSON(json.destinationAddress) : undefined
    this.htlcSecret = json.htlcSecret ? new HtlcSecret().fromJSON(json.htlcSecret) : undefined
    this.nextRevSecret = json.nextRevSecret ? new RevSecret().fromJSON(json.nextRevSecret) : undefined
    this.funder = json.funder
    this.wallet = json.wallet ? new Wallet().fromJSON(json.wallet) : undefined
    this.initialized = json.initialized
    this.sender = json.sender
    this.funding = json.funding ? new Funding().fromJSON(json.funding) : undefined
    if (json.commitments) {
      let commitments = []
      json.commitments.forEach(function (tx) {
        commitments.push(new Commitment().fromJSON(tx))
      })
      this.commitments = commitments
    }
    return this
  }

  asyncToPublic () {
    return asink(function * () {
      let agent = new Agent()
      agent.id = this.id
      agent.sourceAddress = this.sourceAddress ? this.sourceAddress.toPublic() : undefined
      agent.multisigAddress = this.multisigAddress ? this.multisigAddress.toPublic() : undefined
      agent.destinationAddress = this.destinationAddress ? this.destinationAddress.toPublic() : undefined
      agent.funding = this.funding ? yield this.funding.asyncToPublic() : undefined
      if (this.commitments) {
        let commitments = []
        this.commitments.forEach(function (txo) {
          commitments.push(txo.toPublic())
        })
        agent.commitments = commitments
      }
      agent.wallet = this.wallet ? this.wallet.toPublic() : undefined
      agent.initialized = this.initialized
      agent.funder = this.funder
      agent.sender = this.sender
      return agent
    }, this)
  }
}

module.exports = Agent
/**

Protocols
---------

We now describe the protocol that the parties use to construct the transactions
shown above.

### Local initialization (asyncInitialize)

**1. Local initialization .** Both agents initialize the following
- their local addresses (source, destination)
- a htlc and revocation secret to be used in the first payment
- the shared multisig object is initialized, but the address has not been
  generated yet.

### Opening the channel (asyncOpenChannel)

As there are inherent malleability problems if two parties fund a payment
channel. To avoid this problem we use a version where only Alice funds the
channel.

**1. Alice and Bob exchange their public projections (initializeOther).** This
allows them to build a shared multisig address and to know the public versions
of the other agents htlc and revocation secret. After this step the following
is initialized

**2. Alice and Bob build the shared multisig (asyncInitializeMultisig).** Now
that they have exchanged public keys for the multisig address, they can both
build it.

**3. The funder (Alice) builds a funding transaction.** The agent that funds
the channel creates the funding transaction that spends to the shared multisig
address. She does not broadcast it yet. She then sends the funding amount and
funding transaction hash to Bob.

**4. Bob builds and signs a refund transaction, sends it to Alice.** Alice and
Bob go through the protocol described below for creating a payment, in the case
where Bob sends a payment to Alice. The payment spends all funds from the
funding transaction to Alice.

**5. Alice broadcasts the funding transaction.** When the refund transaction is
created and distributed between the two parties, Alice broadcasts the funding
transaction. The channel is open when the funding transaction is confirmed into
the blockchain.

At the end of the channel opening process, both agents store the following
information:

- three addresses (source, destination, multisig)
- a list of commitment transactions objects. The list has one entry that
  contains the secrets used for the first payment
- the public information about the other client; this also contains a list of
  commitment transaction objects with one entry containing the public
  projections (hahes) of two secrets.

### Creating the payment (asyncSend)

We describe a payment from Alice to Bob. Note that if this is not the first
payment, Alice has the hash of Bob's last revocation secret, and the hash of
Bob's last HTLC secret. If this is the first payment, revoking isn't necessary
and these secrets are not needed.

**1. Alice builds a commitment transaction for Bob, stores it, and asks him to
do the same (asyncSend).** Alice builds the transaction labeled "known only to
Bob" above. She then asks Bob to build one for her.<!--She uses the public
versions of the secrets obtained from Bob in step 2 and her own secrets
generated in Step 1. She signs the transaction and sends it to Bob.-->

**2. Bob builds a commitment transaction for Alice, stores it, and sends it to
Alice (asyncSend).**

**3. Alice checks the new commitment transaction, stores it, and sends the
transaction built in step 1 to Bob (asyncSendTxb).**

**4. Bob checks the new commitment transaction, stores it, and revokes the old
commitment transaction (asyncSendTxb).**

**5. Alice checks the revocation secret, stores it, generates new secrets, and
revokes the old commitment transaction (asyncPrepareNextPayment).**

**6. Bob checks the revocation secret, stores it, generates new secrets for the
next payment.**

<!--
**4. Alice checks the transaction, builds one for Alice and sends it to her.**
Bob checks that the transaction spends from the shared multisig address, spends
to his destination address, that the secrets used are the ones he generated in
Step 2, and that the spending amounts are as expected. If the test passes, he
builds the transaction labelled "known only to Alice" and sends it to her (this
is symmetric to case 3.).

**5. Alice checks the transaction obtained from Bob, and revokes her last
payment if the check passes.** To revoke the previous payment, Alice sends her
revocation secret from the last commitment transaction to Bob.

**6. Bob revokes.** Symmetrically, Bob sends Alice his revocation secret from
the last commitment transaction.

**1. Alice generates new secrets and sends them to Bob.** She locally creates a
revocation secret and a htlc secret for use on the next transaction. She then
sends the public versions (hashes) of these secrets to Bob.

**2. Bob generates a new secrets and sends them to Alice.** This is symmetric
to the case above
-->
### Closing the channel

Either party can broadcast their most recent commitment transaction to the
blockchain. In this case both parties go through the following protocol

**1. Find the most recent HTLC secret.**

**2. Build a spending transaction.**

**3. Broadcast spending transaction and the most recent commitment
transaction.**

The party that broadcasts the commitment transaction must wait for a day to do
that, the other party can do so as soon as possible.

### Enforcing the HTLC

In case one party fails to spend an output by providing the HTLC secret, the
other party can spend the HTLC output after 2 days.

**1. Build spending transaction using spending key.**

**3. Broadcast spending transaction and the most recent commitment
transaction.**

### React to other agent broadcasting an old commitment transaction

In that case one party broadcasts an old commitment transaction,
the other party goes trough the following:

**1. Find the corresponding HTLC secret.**

**2. Create an output script that spends the HTLC output.**

**3. Find the corresponding revocation secret.**

**4. Create an output script that spends the revocation output.**

**5. Build a transaction that spends both outputs.**

This has to happen within one day, in order to make sure that the revocation
output can be spent.

**/
