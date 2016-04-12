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

Recall that the challenge in building HTLC is to express "within two days". Recall from Section 1 that the nlocktime of a channel is an implicit condition that forces the receiver the spend the output of a payment transaction *before* that nlocktime expires. Thus we can use a channel with an nlocktime set to the time constraint of the HTLC. To encode an HTLC we build a simple payment transaction with a script that expresse the following:

> Receiver can spend this output if he can present the secret.

This can be encoded in Bitcoin script (about) as follows (TODO debug this script so that it expresses the condition above):

	OP_HASH160 <Hash160 (secret)> OP_EQUALVERIFY 
	OP_DUP OP_HASH160 <pubKeyHashReceiver> 
	OP_EQUALVERIFY OP_CHECKSIG

We will call a transaction that spends the multisig output of the funding transaction to an output with the above script a *HTLC transaction*. As the funding transaction is already confirmed in the blockchain when the HTLC transaction is built, *our construction is not subject to transaction malleability*.

![alt text](https://raw.githubusercontent.com/dattnetwork/fullnode-pc/master/docs/non-malleable.png "non-malleable.png")

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