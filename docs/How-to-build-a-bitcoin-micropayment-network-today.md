# How to build a bitcoin micropayment network today
(Draft 0.2)

We describe how a network of micropayment channels can be built using features that are available in bitcoin today.

## Unidirectional payment Channels

We use standard uni-directional payment channels. The construction is as usual. We use channels where the refund transaction has an nlocktime set to some point in the future (say 30 days). The payment transactions do not have an nlocktime set.

### nlocktime of a channel

Note that the nlocktime of the refund transaction forces the receiver to broadcast a payment transaction before the nlocktime of the refund transaction expires. If he fails to do that he looses all payments obtained through the channel.

Consider for example a refund transaction with ntimelock set to 30 days. Now receiver gets a payment transaction of 0.1. The contract on that payment transaction can be read as 
> Receiver will get 0.1 bitcoin if he closes the channel within 30 days.

Thus we define the *nlocktime of a channel* to be the nlocktime of its refund transaction. We will use this observation to encode HTLC below. We next show that the nlocktime of a channel can both be incresed and decreased.

### Decreasing nlocktime of a channel

Note that the nlocktime of a payment channel can easily be decreased if both parties agree to do so: the easiest way to do this is for receiver the build a transaction that is identical with the original refund transaction just with a lower nlocktime. He then sends this transaction to receiver.

### Increasing nlocktime of a channel

Conversely, it is also possible to increase the nlocktime of a channel if both parties cooperate, but an additional transaction fee must be payed. To do this the two parties 

* set up a new 2-of-2 multisig address, 
* they build and sign a new refund transaction from the new multisig address with a higher nlocktime, and
* broadcast a transaction to the blockchain that spends the funds from the old multisig to the new one. 

This way the input to the new refund address is spent, thus invalidating the old refund transaction.


# Background on HTLCs

HTLCs are cryptographic contracts with both a time contraint and a constraint that requires receiver to know a secret. An example HTLC is the following:

> Receiver can unlock this output if he can present the secret within the next two days. 

The problem with expressing this in bitcoin script is the condition "within two days". While it is easy to express "after two days" using nlocktime, we have to jump through some hoops to express "before two days".

### Decker & Wattenhofer HTLCs

Decker & Wattenhofer solve the problem by setting up two levels of transactions on top of the funding transaction of a payment channel. The first level is a *setup transaction* that spends the 2-of-2 multisig output of the funding transaction into a second 2-of-2 multisig. The output script of the setup transaction specifies that 

> either the receiver provides the secret and a valid signature from both parties, or both parties must sign the transaction spending the HTLC output.

In Bitcoin script the is:

	OP_IF
		OP HASH160 <Hash160 (s)> OP_EQUALVERIFY 2
		<sender> <receiver> OP_CHECKMULTISIG
	OP_ELSE
		2 <sender> <receiver> OP_CHECKMULTISIG 
	OP_ENDIF
	
The setup transaction is signed & exchanged by both parties, but not broadcast to the bitcon network.

During the execution of the protocol a second level of transactions is created that spend the output of the setup transaction. This level consists of up to three transactions that may claim the output of the setup transaction: 

* The *settlement transaction* performs the transfer from sender to receiver if receiver reveals the secret. This transaction has a timelock that is a bit smaller than the one of the refund transaction. It uses the if-brance of the output of the setup transaction.
* The *refund transaction* ensures that sender is refunded should receiver not cooperate. This transaction has a timelock that is equal to the timeconstraint in the HTLC. 
* Finally, the *forfeiture transaction* is used to guarantee that sender is refunded if receiver failes to present the secret. It has no timelock. The latter two transactions both use the else-branch of the output script of the setup transaction.

There are three possible scenarios: If the receiver does not cooperate, the sender can eventually use the refund transaction to get a refund and close the channel. Should the receiver be able to produce the secret, he can use the settlement transaction to settle the payment. Finally in case the receiver fails to get ahold of the secret, the parties can cooperate and use the forfeiture transaction to refund the payment in question back to sender but keep the channel open.


![alt text](https://raw.githubusercontent.com/dattnetwork/fullnode-pc/master/docs/decker-et-al.png "decker-et-al.png")

### Poon & Dryja HTLCs

[Internal note: My feeling is that these are pretty similar to the ones described above, but I still cannot make it through the entire construction. They certainly are subject to malleability as their construction also consists of at least two levels of un-broadcasted transactions on top of the (broadcasted) funding transaction (see for example page 34 of [2].]

## Non malleable HTLCs

We now describe an new implementation of HTLCs that is not subject to transaction malleability. 

Recall that the challenge in building HTLC is to force receiver to reveil his secret within a limited amount of time. Decker & Wattenhofer solve this problem by giving sender a refund transaction that he can use to force Receiver to reveil his secret on time. However, this refund transaction spends the output if the unbroadcasted Setup Transaction, and was thus subject to a malleability attck.

We solve the same problem in a different way using OP_CHECKLOCKTIMEVERIFY. Our construction is similar to the one by Decker & Wattenhofer, but the output script of our Setup transaction has three brances and encodes the following condition

> Receiver can spend this output if he can present the secret. However, if he fails to do so within two days, Receiver can spend the output. Finally, both parties can cooperate at any time to spend the output jointly.

The picture below shows the transactions that can be exchanged by the two parties. Note that all broadcasted transaction only depend only on the funding transaction that has been broadcast and confirmed into the blockchain. This is the reason that our approach is not vulnerable to transaction malleability.

![alt text](https://raw.githubusercontent.com/dattnetwork/fullnode-pc/master/docs/non-malleable.png "non-malleable.png")


The output of the setup transaction can be encoded in Bitcoin script as follows:

	OP_IF
		<Receiver's pubkey> CHECKSIGVERIFY
		OP HASH160 <Hash160 (s)> OP_EQUALVERIFY 
	OP_ELSE
		OP_IF
			<now + 2d> CHECKLOCKTIMEVERIFY DROP
			<Sender's pubkey> CHECKSIGVERIFY
		OP_ELSE
			2 <Sender's pubkey> <Receiver's pubkey> OP_CHECKMULTISIG 
		OP_ENDIF
	OP_ENDIF
	
There are three ways of spending from this an output generated by this script. The if branch can be spent by receiver if he can provide the secret. Receiver can do so immediately

	<secret> <Receiver's sig> <Receiver's pubkey> 1

After two days, sender can spend the output using the if brach of the else branch:

	<Senders's sig> <Sender's pubkey> 0 1

Finally, at any point can sender and receiver cooperate to spend output using the else branch of the else branch

	2 <Receiver's pubkey> <Sender's pubkey> 2 OP_CHECKMULTISIG 0 0



An important property of our construction is: 

> Assuming that Sender and Receiver are mallicious and looking after their own best interest, either Receiver reveils the secret to Sender within two days, xor Sender gets a refund after two days, xor the two cooperate.

The reason is that if Receiver does not spend the output within two days, sender has the possibility to spend the output. It is in his best interest to do so as quick as possible.


### Downgrading HTLC to normal payments

Note that the receiver is forced to spend the output of the HTLC transaction before the nlocktime of the refund transaction expires. However, he can choose to share the secret with sender earlier. In return, and on a completely voluntary basis, the receiver might offer to downgrade the HTLC transaction to a normal payment transaction. To do so he simply sends a signed payment transaction to a receiver with the same amount as the HTLC transaction.

Note that neither party is forced to cooperate in this manner, but as the balance is not changed, they surely will not mind. However, doing this helps both parties to keep transaction sizes (and hence fees) small.

### Chaining HTLC channels

Consider the case where Alice routes a payment for Carol through Bob
    
    Alice -> Bob -> Carol
    
For HTLCs to be effective, it is important that nlocktimes are decreasing along the route. We have shown above that the nlocktime of a channel can both be increased and decreased. If the nlocktimes along the route are not decreasing, then the parties will negotiate that either 

* the nlocktime of  the channel from Alice to Bob be decreased or
* the nlocktime of the channel from Bob to Carol be increased.

### Keeping track of multiple secrets

Consider the case where Alice routes a payments through Bob to Carol. Assume that Carol has neither spent the HTLC transaction nor has reveiled her secret via a downgrade.


	                Carol
	              /
    Alice -> Bob
	              \
	                Dave

Now Alice might want to route a second payment, again through Bob, but this time to Dave. In this case her channel to Bob must keep track of two hashed secrets. This can be accomplished by adding a seconds output to her HTLC transaction shared with Bob.

The above example shows why it is important for all parties to downgrade their transactions as fast as possible.

### Receivers not online

TODO check if something bad happened if sender does nothing when the refund transaction expires (unlikely to work but still). Also look into bi-directional channels

## References 

[1] [A Fast and Scalable Payment Network with
Bitcoin Duplex Micropayment Channels](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf) by Christian Decker and Roger Wattenhofer