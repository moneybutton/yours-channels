Yours Lightning Protocol
========================

We describe how a Bitcoin payment channel network can be built. The basic
building blocks are 2-way *hash time locked contracts* (HTLCs). Our
construction is not subject to transaction malleability except for the funding
transaction and uses only CHECKSEQUENCEVERIFY (CSV) and opcodes that are active
in Bitcoin script today.

To make the network design easier to understand, we will often consider the
example case where Bob opens a payment channel with Carol, and Alice wants to
pay Dave via this payment channel. Alice and Bob may or may not be the same
agent. Carol and Dave may or may not be the same agent. If Alice and Bob are
not the same agent, it is implied that Alice has a payment channel with Bob. If
Carol and Dave are not the same agent, it is implied that Carol has a payment
channel with Dave.

The protocol has two levels, the low level and the high level. The low level is
the protocol for opening a payment channel, updating the commitment
transactions across the channel, and closing the channel. The high level is the
protocol for sending micropayments across a network of payment channels.

Questions
---------

- **What is the purpose of revocation secrets?** Because each agent needs to be
  able to revoke payments made to themselves. After sharing the revocation
  secret, the other party can spend that full amount, disincentivizing the
  recipient of that output from spending the commitment transaction ever again,
  since they would not get any of the money in that output.

- **Why can’t Bob share his commitment transaction with Carol?** Because if he
  did, Carol would be able to immediately spend the HTLC output by knowing
  Dave’s HTLC secret, and as soon as Bob shares his revocation secret Carol
  could also spend the RevHTLC output.

- **Why can’t Carol share her commitment transaction with Bob?** Because if she
  did, Bob would be able to immediately spend the HTLC output by knowing
  Alice’s HTLC secret, and as soon as Carol shares her revocation secret Bob
  could also spend the RevHTLC output.

- **Why are there two commitment transactions?** Imagine we were to be using a
  commitment transaction like in the picture below. After a payment is made,
  both parties exchange their old revocation secret. Now either party can spend
  both outputs of an old transaction: For example Bob can spend the first
  branch of the first output because he knows his sig and will be able to
  obtain A’s HTLC secret. He can also spend the third branch of the second
  output, because he knows his sig and C’s revocation secret.


Definitions
-----------

- The agents in the analysis are Alice (A), Bob (B), Carol (C), and Dave (D).
- Bob opens a channel with Carol. Bob funds the channel.
- The channel is funded with N satoshis.
- The transaction fee is F satoshis.
- The amount being paid in the payment is M satoshis. There will be more than
  one payment; each payment uses M in context.
- To each HTLC secret there is an HTLC hash.
- To each revocation secret there is a revocation hash.
- The multisig address is the address containing one of Bob’s public keys and
  one of Carol’s public keys.
- The funding transaction is the transaction Bob creates spending to the
  multisig address to fund the channel to Carol.
- An Output Description is an amount, final recipient’s name (“Alice” or
  “Dave”), an intermediate recipient’s public key (Bob or Carol), an HTLC hash,
  and a revocation hash.
- An Output Description list is a list of Output Descriptions. The sum of the
  amounts of the output list must equal the funding amount minus the fee (F).

Smart Contracts
---------------

Consider a channel between Bob and Carol. These are the output scripts that
will be used in the commitment transactions.

### PubKey

Bob can pay to Carol with this output:

```
<C's pubKey> CHECKSIG
```

Carol can spend the output with this input:

```
<C's signature>
```

### Revocable PubKey

Bob may wish to make a payment to Carol which is revocable:

```
IF
  <C's pubkey> CHECKSIGVERIFY
  HASH160 <Hash160 (B's revocation secret)> EQUAL
ELSE
  <C's pubKey> CHECKSIG
ENDIF
```

### Hash Time Lock Contracts (HTLCs)

A HTLC between Bob (B) and Carol (C) expresses the following:

> An output can be spent by C if she can present a secret within two days, or
> by B after that.

HTLCs make payments routed through several untrusted third parties secure. They
can be encoded by the following output script:

```
IF
  <C's pubkey> CHECKSIG
  HASH160 <Hash160 (secret)> EQUAL
ELSE
  <B's pubkey> CHECKSIG
  <2 days> CHECKSEQUENCEVERIFY
ENDIF
```

If the transaction is settled, Carol may spend the output with the following
input script:

```
<secret> <C's signature> TRUE
```

Bob can spend it after two days with this input script:

```
<B's signature> FALSE
```

### Revocable HTLCs (RevHTLCs)

In order for channels to remain open an unlimited amount of time, the parties
must be able to revoke previously made payments. A Revocable Sequence Maturity
Contract (RSMC) is a technique to achieve just that [1]. We apply this
technique to HTLCs in order to make them revokable.

A revocable HTLC (RevHTLC) between B and C is a smart contract that expresses:

> An output can be spent by C if she knows B's revocation secret, or after one
> day if C knows the HTLC secret, or by B after 2 days.

The trick is that if Bob gives Carol his revocation secret, then Carol knows
that he will never publish the contract. If he did, she could spend from it
immediately. In this way Bob can effectively revoke the contract. If Carol does
not know the revocation secret, the above condition is equivalent to a normal
HTLC.

In Bitcoin script the condition above can be expressed as follows:

```
IF
  <C's pubkey> CHECKSIGVERIFY
  HASH160 <Hash160 (b's revocation secret)> EQUAL
ELSE
  IF
    <1 day> CHECKSEQUENCEVERIFY DROP
    <C's pubkey> CHECKSIGVERIFY
    HASH160 <Hash160 (HTLC secret)> EQUAL
  ELSE
    <2 days> CHECKSEQUENCEVERIFY DROP
    <B's pubkey> CHECKSIG
  ENDIF
ENDIF
```

If the transaction is settled, Carol may spend the output immediately with the
following input script:

```
<B's revocation secret> <C's signature> TRUE
```

Carol may spend it after one day with the following input script:

```
<HTLC secret> <C's signature> TRUE FALSE
```

Bob may spend it after two days with the following input script:

```
<B's signature> FALSE FALSE
```

### P2SH

In practice, the above scripts are always the redeemScript in a P2SH input, and
outputs are always P2SH outputs with the hash of the redeemScript.

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

Protocols (high/low-level specification)
----------------------------------------

### Low Level: Open Channel Protocol
- Bob and Carol each generate a new keypair and share the public key with each
  other.
- Bob and Carol generate a multisig address from the public keys (with public
  keys sorted lexicographically, guaranteeing they each generate the same
  multisig address).
- Bob funds the multisig address with a new funding transaction, but does not
  yet broadcast the funding transaction.
- Bob proceeds to follow the Refund Transaction Protocol to send the full
  amount minus a transaction fee (N - F) back to himself.
- If the Refund Transaction Protocol succeeded, Bob broadcasts the funding
  transaction.

### Low Level: Refund Transaction Protocol
- Carol generates a new revocation secret and shares the hash with Bob.
- Bob generates a new HTLC secret and a new revocation secret. (TODO: Do we
  really need an HTLC secret for the refund?)
- Bob generates an output list containing an output to Bob spending the entire
  funding amount minus the fee, N - F. Bob shares the output list with Carol,
  but masking his secrets.
- Bob creates a new commitment transaction for Carol containing Carol’s view of
  the outputs in the output list, which are:
  - An HTLC output of N - F satoshis to Bob (containing Bob’s HTLC hash) routed
    through Bob (containing Bob’s public key)
- Bob signs Carol’s commitment transaction and gives it to Carol.
- Carol signs her commitment transaction and holds it.
- Carol creates a new commitment transaction for Bob containing Bob’s view of
  the outputs in the output list, which are:
  - A RevHTLC output of N - F satoshis to Bob (containing Bob’s HTLC hash and
    Bob’s revocation hash) routed through Bob (containing Bob’s public key)
- Carol signs Bob’s commitment transaction and gives it to Bob.
- Bob signs his commitment transaction and holds it.
- At this point, Bob could share the HTLC secret, but does not need to.

### Low Level: Bob to Carol Transaction Update Protocol
- Bob desires to route a payment of M satoshis through Carol.
- Bob is already in possession of the HTLC hash of the payee and that agent’s
  id.
- Bob generates a new revocation secret and shares the hash with Carol.
- Carol generates a new revocation secret and shares the hash with Bob.
- Bob adds a new HTLC output to the output list with the output information:
  The payee’s id, the payee’s HTLC hash, Carol’s public key, and Bob’s
  revocation hash, and the amount being paid, M satoshis.
- Bob also updates one of the outputs sending bitcoin back to him to subtract M
  satoshis. This is because the total amount output from the transaction must
  be the same amount input to the transaction minus the fee, F.
- Bob shares the updated output list with Carol.
- Bob now constructs a new commitment transaction to Carol. The commitment
  transaction outputs should equal Carol’s view of the output list. This
  commitment transaction is the same as the previous commitment transaction for
  Carol, but with one new output, and with one output decreased by M satoshis.
  In the case where the previous commitment transaction was the refund
  transaction, the outputs are:
  - An HTLC output of N - (M + F) satoshis to Bob (containing Bob’s HTLC hash)
    routed through Bob (containing Bob’s public key)
  - A RevHTLC output of M satoshis to the payee (containing the payee’s HTLC
    hash and Carol’s revocation hash) routed through Carol (containing Carol’s
    public key)
- Bob signs Carol’s commitment transaction and gives to Carol.
- Carol signs her commitment transaction and holds it.
- Carol now constructs a new commitment transaction for Bob. The commitment
  transaction outputs should equal Bob’s view of the output list. This
  commitment transaction is the same as the previous commitment transaction for
  Bob, but with one new output, and with one output decreased by M satoshis. In
  the case where the previous commitment transaction was the refund
  transaction, the outputs are:
  - A RevHTLC output of N - (M + F) satoshis to Bob (containing Bob’s HTLC hash
    and Bob’s revocation hash) routed through Bob (containing Bob’s public key)
  - An HTLC output of M satoshis to the payee (containing the payee’s HTLC
    hash) routed through Carol (containing Carol’s public key)
- Carol signs Bob’s commitment transaction and gives it to Bob.
- Bob signs his commitment transaction and holds it.
- Carol receives the HTLC secret from the payee, and then delivers it to Bob.
- Bob and Carol now exchange revocation secrets for the previous commitment
  transactions. (TODO: Can the revocation secret be exchanged before the HTLC
  secret is shared?)

### Low Level: Carol to Bob Transaction Update Protocol
TODO

### Low Level: Commitment Transaction Simplification Protocol
- Shared Secret Simplification:
- If an HTLC secret has been shared, at any time either party can reduce that
  output with the counterparty’s public key to a single pubkey output. 
- If an RevHTLC secret has been shared, at any time either party can reduce
  that output with the counterparty’s public key to a single revocable output.
- Unshared Secret Simplification: If Carol never gets the secret from Dave, but
  Carol does get her money from her channel with Dave, then Carol can agree
  with Bob to remove the output to Dave from her channel with Bob, and add M
  satoshis in an output to Bob.

### Low Level: Close Channel Protocol
Either agent (Bob or Carol) can broadcast their latest fully signed commitment
transaction at any time to close the channel.

### Low Level: Uncooperative Agent Protocols
- Either party might broadcast an old commitment transaction. Assume that Carol
  broadcast an old transaction only known to her, and assume that it’s like in
  the picture at the top of this doc. Then Bob forces Alice to reveal her
  secret, uses that secret to spend the first output. He will also look up the
  stored revocation secret for that transaction and use it to spend the second
  output.
- Alice does not reveal her HTLC secret used in an HTLC contract. Say that
  Alice shares her HTLC secret with Bob, but Bob does not pass on the secret to
  Carol in time. Then Carol broadcasts her commitment transaction. Now Bob
  could spend the first output of the first branch within two days, thereby
  revealing Alice’s secret. Otherwise, Carol can spend the second branch of the
  first output.
- Dave does not reveal his HTLC secret used in an RevHTLC contract.  Say that
  Dave shares his HTLC secret with Carol, but Carol does not pass on the secret
  to Bob in time. Then Bob broadcasts his commitment transaction. Now Carol
  could spend the first output of the first branch within two days, thereby
  revealing Dave’s secret. Otherwise, Bob can spend the third branch of the
  second output.

### High Level: Alice pays Dave using the Bob <-> Carol payment channel
- Alice determines she wishes to pay Dave M satoshis.
- Dave generates a new HTLC secret and shares the hash with Alice.
- Alice pays Bob with an HTLC output containing Dave’s HTLC hash and a time
  lock or 3 days.
- Bob pays Carol with an HTLC output containing Dave’s HTLC hash and a time
  lock or 2 days.
- Carol pays Dave with an HTLC output containing Dave’s HTLC hash and a time
  lock or 1 day.
- Dave shares his HTLC secret with Carol within 1 day.
- Carol shares the HTLC secret with Bob within 2 days (1 day later).
- Bob shares the HTLC secret with Alice within 3 days (1 day later).

https://github.com/yoursnetwork/yours-channels/blob/master/docs/hash-locked-contracts.md

### High Level: Renegotiation Protocol
Initiate the Low Level Transaction Update Protocol but where you remove one of
the outputs instead of add one.

### High Level: Uncooperative Agent Protocol
- Suppose Bob is paying Dave. If Dave becomes unresponsive, Carol broadcasts
  her commitment transaction with Dave. If Dave spends his money, he must
  reveal his HTLC secret meaning Carol can get her money from Bob (Shared
  Secret Simplication). Otherwise Dave does not ever spend his money, and Carol
  doesn’t get Dave’s HTLC secret, but Carol does get all of the money from that
  channel, in which case Bob and Carol agree to renegotiate to remove the
  output to Dave Unshared Secret Simplification).

Protocols (original)
--------------------

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

Security Properties
-------------------

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

Implementation (Agent version)
------------------------------

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

Implementation (Channel version)
--------------------------------

### As Bob, how to initiate opening a channel from Bob to Carol:

- create a new Channel object
- asyncOpenStep1
- send MsgOpen to Carol
- receive MsgOpenRes from Carol
  - if receive any other message:
    - go to start and try again
- asyncHandleMsgOpenRes
  - if failure:
    - go to start and try again
- build funding tx
- asyncOpenStep2
- send MsgUpdate to Carol
- receive MsgUpdateRes from Carol
  - if receive any other message:
    - go to start and try again
- asyncHandleMsgUpdateRes
  - if failure:
    - go to start and try again
- send MsgAck to Carol
- broadcast funding tx to blockchain
- wait for funding tx to be confirmed
- asyncConfirmFundingTx
- send MsgFundingTx to Carol
- receive MsgFundingTx from Carol (confirming she sees tx)
- send MsgAck to Carol
- channel is now open

### As Carol, how to receive a channel initiation from Bob:

- receive MsgOpen from Bob
  - if chanId already exists:
    - asyncMsgOpen on channel with chanId
- create new Channel object
- asyncHandleMsgOpen
  - if failure:
    - asyncClose
- send MsgOpenRes to Bob
- receive MsgUpdate from Bob
- asyncHandleMsgUpdate
  - if failure:
    - asyncClose
- send MsgUpdateRes to Bob
- wait for funding tx to be confirmed
- asyncConfirmFundingTx
- receive MsgFundingTx from Bob
- send MsgAck to Bob
- channel is now open

### As Bob, how to make a payment from Bob to Carol over an open channel:

- asyncUpdate
- send MsgUpdate to Carol
- receive MsgUpdateRes from Carol
  - if receive any other message:
    - asyncClose
- asyncHandleMsgUpdateRes
  - if failure:
    - asyncClose

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
  - xPub: The channel funder's extended public key (in bip32 string format) to
    be used in the funding multisig transaction.
- Explanation: This message is the first message sent on a channel. When Bob
  opens a channel with Carol, Bob sends this message first.

### MsgOpenRes
- Command: 'open-res'
- Arguments:
  - pubKey: The extended public key (in bip32 string format) of the channel
    recipient.
- Explanation: If a channel recipient (Carol) has received an 'open' message
  and agrees to open the channel, they respond with an 'open-res' message. This
  message needs to contain the extended public key of the channel recipient for
  use in the funding multisig transaction and payments.

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
