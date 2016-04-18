# Yours Lightning

We describe how 2-way hash time locked contracts (HTLCs) can be built. 

## Scripts

We will need two kinds of smart contracts: HTLCs and revokable HTLCs.

### HTLCs

A HTLC expresses the following:

> An output can be spent by Alice if she can present a secret immediately, or by Bob after two days

This can be encoded by the following output script

	OP_IF
		<Alice's pubkey> CHECKSIGVERIFY
		OP HASH160 <Hash160 (secret)> OP_EQUALVERIFY 
	OP_ELSE
		<2 days> CHECKSEQUENCEVERIFY DROP
		<Bob's pubkey> CHECKSIGVERIFY
	OP_ENDIF
	
### Revocable HTLCs

Revocable Sequence Maturity Contract (RSMC) are a technique to make outputs revokable by reveiling a private key [1]. We apply this technique to HTLCs. 

A revocable HTLC (RHTLC) is a smart contract that expresses:

> An output can be spend by whomever knows both Alice's and Bob's private key immediately, or by Alice after a day if she knows a secret, or by Bob after two days.

In Bitcoin script this looks something like this:

	OP_IF
		<Alice's pubkey> <Bob pubkey> 2 CHECKMULTISIG
	OP_ELSE
		OP_IF
			<2 days> CHECKSEQUENCEVERIFY OP_DROP
			<Alice's pubkey> CHECKSIGVERIFY
			OP HASH160 <Hash160 (s)> OP_EQUALVERIFY 
		OP_ELSE
			<2 days> CHECKSEQUENCEVERIFY OP_DROP
			<Bob's pubkey> CHECKSIGVERIFY
		OP_ENDIF	
	OP_ENDIF

## Transactions

The sender and the receiver exchange the follwoing transactions.

![alt text](./img/2-way-rhtlc.png "2-way-rhtlc.png")

Note that each party can revoke their own HTLC but not the other parties.

## Protocols

For the moment we assume that only one party funds the channel. An elegant one that I'd have to discuss with Ryan, and the other one

### Funding the channel

**Creating the multisig.** Sender sends a public key to receiver, receiver created a public key himself, creates a multisig address, and sends it back to sender

**Creating a funding transactions.** Sender creates a transaction that spends to that multisig address. Does not broadcast it though.

**Creating a refund transaction.** Sender creates a commitment transaction that spends the funded amount back to himself. To do that he uses the "RHTLC to sender" output in the picture above. The other output has value zero. He does not sign the transaction and sends it to ...

TODO.

### Creating the payment

**1. Sender generates fresh key pair.** He then sends the public key to receiver and stores the private key. He will later use this private key to revoke a transacion.

**2. Receiver generates fresh key pair.** He also sends the public key to sender and stores the private key to be able to revoke later.

**3. Sender builds transaction.** Sender builds the transaction labelled "known only to receiver" above. He uses the public key obtained from receiver in step 2. to generate the multisig output in the script laballed "RHTLC to receiver" above. Sender does not need to use a fresh keypair to create this multisig. He signs the transaction and sends it to receiver.

**4. Receiver builds transactions.** If receiver wants to accept the payment, he will build the transaction labelled "known only to sender" above. He uses the public key obtained from sender in step 1. He then signes it and sends it back to sender.

**5. Sender revokes.** To revoke the previous payment, sender sends the private key generated in step 1 to sender.

**6. Receiver revokes.** Symmetrically, receiver sends sender the private key generated in step 2.

## References 

[1] [The Bitcoin Lightning Network:
Scalable Off-Chain Instant Payments](http://lightning.network/lightning-network-paper.pdf) by Joseph Poon and Thaddeus Dryja

[2] [A Fast and Scalable Payment Network with
Bitcoin Duplex Micropayment Channels](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf) by Christian Decker and Roger Wattenhofer

[3] [Reaching the Ground with Lighning](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf) by Rusty Russel 