Yours Lightning Protocol
========================

We describe how a Bitcoin payment channel network can be built. The basic
building blocks are 2-way *hash time locked contracts* (HTLCs). Our
construction is not subject to transaction malleability except for the funding
transaction and uses only CHECKSEQUENCEVERIFY (CSV) and opcodes that are active
in Bitcoin script today.

Smart Contracts
---------------

We will need two kinds of smart contracts: HTLCs and revokable HTLCs.

### Hash Time Lock Contracts (HTLCs)

A HTLC between Alice (A) and Bob (B) expresses the following:

> An output can be spent by B if he can present a secret within two days, or by
> A after that.

HTLCs make payments routed through several untrusted third parties secure. They
can be encoded by the following output script:

```
IF
  <B's pubkey> CHECKSIG
  HASH160 <Hash160 (secret)> EQUAL
ELSE
  <A's pubkey> CHECKSIG
  <2 days> CHECKSEQUENCEVERIFY
ENDIF
```

If the transaction is settled, Bob may spend the output with the following
input script:

```
<secret> <B's signature> TRUE
```

Alice can spend it after two days with this input script:

```
<A's signature> FALSE
```

### Revocable HTLCs (RevHTLCs)

In order for channels to remain open an unlimited amount of time, the parties
must be able to revoke previously made payments. A Revocable Sequence Maturity
Contract (RSMC) is a technique to achieve just that [1]. We apply this
technique to HTLCs in order to make them revokable.

A revocable HTLC (RevHTLC) between A and B is a smart contract that expresses:

> An output can be spent by B if he knows A's revocation secret, or after one
> day if B knows the HTLC secret, or by A after 2 days.

The trick is that if Alice gives Bob her revocation secret, then Bob knows that
she will never publish the contract. If she did, he could spend from it
immediately. In this way Alice can effectively revoke the contract. If Bob does
not know the revocation secret, the above condition is equivalent to a normal
HTLC.

In Bitcoin script the condition above can be expressed as follows:

```
IF
  <B's pubkey> CHECKSIGVERIFY
  HASH160 <Hash160 (A's revocation secret)> EQUAL
ELSE
  IF
    <1 day> CHECKSEQUENCEVERIFY DROP
    <B's pubkey> CHECKSIGVERIFY
    HASH160 <Hash160 (HTLC secret)> EQUAL
  ELSE
    <2 days> CHECKSEQUENCEVERIFY DROP
    <A's pubkey> CHECKSIG
  ENDIF
ENDIF
```

If the transaction is settled, Bob may spend the output immediately with the
following input script:

```
<A's revocation secret> <B's signature> TRUE
```

Bob may spend it after one day with the following input script:

```
<HTLC secret> <B's signature> TRUE FALSE
```

Alice may spend it after two days with the following input script:

```
<A's signature> FALSE FALSE
```

Transactions
------------

For each transaction, Alice (A) and Bob (B) both generate a fresh htcl secret
and a fresh revocation secret. They construct the following two transactions:

![alt text](./img/2-way-rhtlc.png "2-way-rhtlc.png")

Each commitment transaction maintains two HTLCs, one for each direction. Note
that each party can revoke their own HTLC but not the other party's.

Data Structures
---------------

Either agent in the channel stores the following data:
- the source address used to fund the funding transaction
- the multisig address "between" the funding and commitment tx
- the destination address that the commitment transactions spend to
- the funding transaction (or its hash)
- a list of commitment transaction objects
- a reference to the other agent public information (including her list of
  previous commitment transaction objects)

A commitment transaction object contains the following

- a commitment transaction
- the agents htlc secret
- the agents revocation secret
- the public version of the other agents htlc secret
- the public version of the other agents revocation secret

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

At the end of the channel opening process, both agents store the following information:

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

**3. Broadcast spending transaction and the most recent commitment transaction.**

The party that broadcasts the commitment transaction must wait for a day to do
that, the other party can do so as soon as possible.

### Enforcing the HTLC

In case one party fails to spend an output by providing the HTLC secret, the
other party can spend the HTLC output after 2 days.

**1. Build spending transaction using spending key.**

**3. Broadcast spending transaction and the most recent commitment transaction.**

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

## Security Properties

In the following we assume that both Alice and Bob are malicious but rational.
That is, they look after their own self interest only and try to steal funds
whenever possible, but they will not harm themselves.

_**Property 1.** Assume that from the last payment, both parties have
transactions as in the picture above. If they execute the protocol "Sending a
payment", then their balance is as specified by the commitment transactions.
Either party can force the other to reveal their HTLC secret within two days._

We check that Property 1 holds true after each step of the protocol.

Steps 1 and 2 are not critical as the only information that gets exchanged are
hashes of revocation secrets that have not been used yet.

After step 3 Bob can sign and broadcast the commitment transaction to the
blockchain. In this case Bob is forced to spend the output labelled "HTLC to
Bob" output within two days while Alice's branch of that output is blocked by a
CSV lock. If he does not, then Alice will spend that output. If Bob spends that
output then he reveals his HTLC secret to Alice.

Step 4 is completely symmetric to step 3. The same reasoning applies.

Note that up to this point, Alice and Bob can still broadcast the commitment
transaction from the last round. This is particularly enticing for the party
that had a higher balance in the last round (essentially the "sender" of this
round). Note that however in that case the receiver will eventually reveal the
secret for the last payment, not the current one. Thus the "sender" cannot
claim to have made the last payment.

Step 5. This is where Alice sends her revocation secret to Bob. This guarantees
to Bob that Alice will not broadcast a previous transaction anymore. To
understand why assume that she would. In this case an old version of the
transaction "known only to Alice" is broadcast to the blockchain. If that
happens, Bob can claim both outputs. He can clearly claim the top output (HTLC
to Bob) by revealing an old HTLC secret. He can also claim the second output
using the Alice's revocation secret (either the one she just revealed or one
revealed in a previous round) and his own private key. Note that if Alice
cheats in this way, she looses not only a payment but the entire amount used to
fund the channel.

Step 6 is symmetric to step 5 and the same reasoning applies.

_**Property 2.** While executing the "funding the channel" protocol as
described above, neither party can steal the other parties funds. This is true
in the presence of transaction malleability._

Again, we check that Property 2 holds true after each step of the protocol.
Step 1 is completely uncritical because only public keys are exchanged and a
new address is created. So is step 2 because Alice does not broadcast the
funding transaction yet. Step 3 is not critical according to Property 1.

Note that as this point Alice could maleate her funding transaction before
she'd broadcast it to the blockchain. However all that would do is to
invalidate her refund transaction which would hurt only herself.

There is still the possibility that Bob controls a node that would maleate the
funding transaction after it is broadcast. However Bob would have to control a
sizable part of the bitcoin network to pull this off consistently (if he
controls n% of the network that would work n% of the time). Essentially, only
mining pool operators would have the resources to pull off that attack
consistently. However, there is very little to win (one funding transaction
worth double digit USD) and very much to loose (the miners in the pool), so we
do not anticipate this attack being a problem in practice.

Implementation
--------------

### Funding the channel

**buildMultisig(pubkey).** Creates a second fresh public key, returns a 2-of-2
multisig address from the two keys.

**buildFundingTx(amount, inputs, outputs).** Creates a transaction that spends
amount from inputs to outputs (outputs will be the multisig address from
above).

**buildRefundTx()** Calls BuildCommitmentTx to create a refund transaction.

### Building a payment

**generateRevocationSecret().** Returns a random string.

**storeRevocationSecret(secret).** Stores the revocation secret of the other
party.

**buildCommitmentTx(amount).** Builds and signs a commitment transaction. Still
needs to be signed by the other party.

**acceptCommitmentTx(txb).** Check if payment should be accepted. If so sign
and return.

Notes
-----
- Payments can go both ways on a channel, so the agent who ultimately receives
  a payment is the one who generates the secret.
- "Dave" is the ultimate recipient on the close end of the payment channel, and
  "Carol" is the ultimate recipient on the far end of the channel.

Definitions
-----------
- Bob (B) opens a payment channel with Carol (C). Alice (A) wishes to make a
  payment to Dave (D). The channel from Bob to Carol is used for the payment
  from Alice to Dave (and other channels may be involved as well). Alice and
  Bob may be the same agent. Carol and Dave may be the same agent.
- The transaction fee is F.
- The channel is funded with N satoshis.
- The payment is M satoshis, and M < N.
- The change is R = N - M - F, and it must be that R >= 0.
- The transaction fee for a commitment tx is F satoshis.
- An HTLC secret is 32 bytes long and its hash is 20 bytes long.
- A RevHTLC secret is 32 bytes long and its hash is 20 bytes long.

Low Level vs. High Level
------------------------
There are two protocols in the Yours Lightning Protocol. The low-level protocol
is for creating, updating, and closing a payment channel between two agents.
The high-level protocol is a way of using a network of payment channels to send
payments to and from any number of people.

Low-Level Message Data Structures
---------------------------------
All message types are JSON objects with these properties:
- cmd: A string, specifying the name of the command to be executed by the
  remote agent.
- args: A JSON object (optionally an array) containing the properties the
  remote agent needs to execute the method.
- chanId: A 32 character hex string identifying the channel. The chanId is set
  by the channel initiator and must be the same for every message for that
  channel.

### MsgError
- Command: 'error'
- Arguments:
  - error: An error string that explains the nature of the error.
- Explanation: When a fatal error occurs, an error message may be sent. Both
  parties should close the channel when an error message is either sent or
  received.

### MsgOpen
- Command: 'open'
- Arguments:
  - amount: A big number specifying the amount of satoshis the channel will be
    funded with.
  - pubKey: The channel funder's public key (in hex format) to be used in the
    funding multisig transaction.
- Explanation: This message is the first message sent on a channel. When Bob
  opens a channel with Carol, Bob sends this message first.

### MsgOpenRes
- Command: 'open-res'
- Arguments:
  - pubKey: The public key (in hex format) of the channel recipient.
- Explanation: If a channel recipient (Carol) has received an 'open' message
  and agrees to open the channel, they respond with an 'open-res' message. This
  message needs to contain the public key of the channel recipient for use in
  the funding multisig transaction.

### MsgUpdate
- Command: 'update'
- Arguments:
  - outputDescriptions: An array of OutputDescription objects specifying what
    types the outputs are (such as HTLC or pubkey) and how much bitcoin is in
    that output.
  - commitmentTxBuilder: A partially signed TxBuilder object created by the
    builder/sender and to be owned by the owner/receiver.
- Explanation: When you want to make a payment to someone, either to the agent
  on the other side of the channel or to someone else they are connected to,
  you need to send a MsgUpdate. When an agent sends a MsgUpdate, they expect
  the other agent to send a MsgUpdateRes with the complementary commitment
  transaction.

### MsgUpdateRes
- Command: 'update-res'
- Arguments:
  - outputDescriptions: An array of OutputDescription objects specifying what
    types the outputs are (such as HTLC or pubkey) and how much bitcoin is in
    that output.
  - commitmentTxBuilder: A partially signed TxBuilder object created by the
    builder/sender and to be owned by the owner/receiver.
- Explanation: An agent's response to an 'update' message. Also contains an
  Output Description list and a commitment transaction, but built by the other
  agent and with different hashes and signatures.

### MsgSecret
- Command: 'secret'
- Arguments:
  - secret: A hex string specifying secret data.
  - hash: A hex string specifying the HASH160 (sha256 ripemd160) hash of the
    secret.
- Explanation: Sometimes an agent needs to reveal a secret in order to receive
  a payment.

References
----------

[1] [The Bitcoin Lightning Network: Scalable Off-Chain Instant
Payments](http://lightning.network/lightning-network-paper.pdf) by Joseph Poon
and Thaddeus Dryja

[2] [A Fast and Scalable Payment Network with Bitcoin Duplex Micropayment
Channels](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf)
by Christian Decker and Roger Wattenhofer

[3] [Reaching the Ground with
Lightning](http://ozlabs.org/~rusty/ln-deploy-draft-01.pdf) by Rusty Russel
