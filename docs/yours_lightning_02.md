# A Lightning Network for Datt

We describe how a lightning network can be built for the Datt network. Our system will be deployable as soon as the new checksequenceverify (CSV) opcode get's activated in Bitcoin script. It is not subject to transaction malleability.



## 1. Payment channels

Even in a bi-directional channel, there is always a sender who initiates a payment and a receiver. We first describe the data structures used, that is the transactions that each user must know about. We then talk about the functionality that the Wallet must have. Finally, we discuss the protocols used and prove their security.

### 1.1 Uni-directional payment channels

In the simplest form of a payment channel, the sender does not need to store any transactions at all. He just sings a transaction and sends it to receiver. 

In our use-case however it is important that both the sender and the receiver must be able to unilaterally close the channel. For example if a users channel expires, we want to be able to close the channel even if that user is not online.

The obvious solution is for the sender to store a full signed commitment transaction as well. The problem hereby is that sender will want to broadcast an old commitment transaction to the blockchain. 

To prevent that from happening, we use a slightly more involved construction that is inspired by the Revocable Sequence Maturity Contract of [1]. The transaction that both parties store looks like this.

![alt text](./img/1-way-channel.png "1-way-channel.png")

The idea is that sender get's punished if he broadcasts an old transaction. To detect if a transaction is old, sender uses a new private key to generate the multisig output of the Payment transaction every time he generates a new one. Whenever a new payment is created, Sender will share the key used in the old one. Note that receiver can safely use the same private key every time.

Now, if sender broadcasts an old transaction, receiver can clearly claim the first output. The second branch of the second output is locked with a CLTV constrains, so Sender cannot spend this. However, Receiver can spend the second output as Sender has shared the key used in that transaction with him previously.

Note that if Sender tries to cheat by broadcasting an old transaction he loses not only the funds he has legitimately sent to Receiver, but all also the funds that he has not spent yet.

### Bi-directional channels

In the bi-directional case, both parties must be able to revoke a transaction. In this case the spending transaction looks as follows:

![alt text](./img/2-way-channel.png "2-way-channel.png")

Note that this case is essentially not more complex than the previous.


## 1.2 HTLC Transactions

Hash time locked contracts (HTLC) guaranty security in a multi-hop scenario. A HTLC encodes the following:

> Receiver can spend an output if he can present a secret within a limited amount of time. If he fails to do so, no payment is made.

This can be encoded by the following output script

	OP_IF
		<Receiver's pubkey> CHECKSIGVERIFY
		OP HASH160 <Hash160 (s)> OP_EQUALVERIFY 
	OP_ELSE
		<2 days> CHECKSEQUENCEVERIFY DROP
		<Sender's pubkey> CHECKSIGVERIFY
	OP_ENDIF
	
### Uni-directional HTLCs

In the one-directional model, we just add the above script to receivers output of the commitment transactions.

![alt text](./img/1-way-htlc.png "1-way-htlc.png")

*__Theorem__ If Sender and Receiver set up a HTLC as above, exactly one of the following is true:*

 * *Receiver reveals the secret to Sender within a limited amount of time and Sender sends him the money*
 * *Sender can force a refund after 2 days*

**Proof** We assume that the Funding transaction has been confirmed into the blockchain and both parties have signed and exchanged the HTLC transaction. There are two ways that this can play out: either the two parties decide to cooperate or not. We will see that under the assumptions they will cooperate. To see why, we have to look at what happens if they don't.

In this case eventually one party will broadcast the HTLC transaction to the blockchain and someone spends it. If Receiver does, then he reveals his secret while doing so. If Receiver does not spend, then Sender will be able to spend output after 2 days to refund himself (these two cases are exactly what is enforced by the output of the Setup transaction). In both cases the condition of the Theorem is maintained.

The outcome of not cooperating is not bad for either party, no-one has lost any money. However, it's not awesome either. After all, they are effectively closing the channel when someone broadcasts the HTLC transaction. All else being equal, they prefer to keep the channel open.

We have just argued that no party has anything to gain from not cooperating. So lets see how they can cooperate to avoid having to close channel. The protocol is simple:

> After getting the signed HTLC transaction from Sender, Receiver sends the secret to sender

We have to check that the conditions of the Theorem are maintained afterwards. Receiver waits for Sender to send the payment transaction for one day (this is not enforced by anything, just a convention between the two). If he does not get the payment he assumes that Sender is not willing to cooperate and proceeds to broadcast the HTLC transaction to the blockchain. He then spends its output to himself, thereby revealing the secret. In this case everything played out as in the non-cooperative case. **qed.**


### Bi-directional HTLCs
	
In the bi-directional case the parties need the ability to revoke a HTLC. Luckily we already know how to revoke an output: temporarily lock the output with a CSV lock and make an additional branch with an output that both parties must sign. 

![alt text](./img/2-way-htlc.png "2-way-htlc.png")

Note that this transaction maintains two HTLCs - one for each direction in the channel. When sender wants to force receiver to reveal his secret, he just broadcasts the HTLC transaction to the blockchain. In this case receiver will have to spend the top output between day 1 and day 2. If he waits after day 2 then sender can use his output to spend that output. 

In addition this more complex output allows the the parties to invalidate old transactions. Like in the case of payment channels, they use a new key to build each new transaction. If they want to revoke an old transactions output they just publish the key they used to for that output.

TODO: what if a party does not know the secret?


## 2. Protocols

### Establishing a channel

**1. Create Multisig.** Sender creates a new public key and sends it to receiver. Receiver then creates a new 2-of-2 multisig address and sends it back to sender

**2. Create Funding Transactions Locally.** Next both parties create a funding transaction that spends to the newly created multisig. They do not broadcast or exchange these transactions.

**3. Create Refund Transactions.** Each party builds a transaction that spends their input into the multisig address back to an address that they controll. They do not sign it. They ask the other party sign it and send it back. 

**4. Broadcast Funding Transactions.** Once both parties have gotten their refund transactions, they fund they broadcast their funding transaction.

### Sending a paymnet

**1. Building the multisig outputs.** Sender creates two public keys, sends them to receiver. Receiver creates two public keys of his own, sends them to sender. Sender created two multisig addresses.

**2. Sender builds, signes, & sends HTLC tx.** Sender builds a HTLC transaction from the new addresses, signes it, and sends to receiver.

Note that it is not necessary for receiver to resend the signed tx to sender. If sender wants to revoke that transaction, he just publishes the private keys he used to build the multisig addresses.

### Maintaining several secrets

The construction above can maintain several secrets for each direction. To do so it just adds an extra output per secret.


### Resolving HTLC off-blockchain

Note that sender will not be able to send a new payment until the HTLC contract is resolved. Thus receiver is motivated to resolve off-chain. 

To do that receiver sends the secret to sender. Sender will then construct a new commitment transaction with that output downgraded from a HTLC output to a payment channel output.

### Closing the channel

Either party can to that unilaterally. If the two parties collaborate they can create a smaller transaction where outputs are merged.