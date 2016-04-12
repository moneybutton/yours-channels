# HTLCs as explained by Decker & Wattenhofer

*Hash time locked contracts* (HTLCs) are spechial contracts on the outputs of payment transaction that allow to concatentate multiple payment channels in a trustless way. Given a secret string *s* and a hash function *h*, an example of a HLC would be 

> either receiver provides *s′* s.t. *h(s) = h(s′)* and a valid signature from both parties, or both parties must sign the transaction spending the HTLC output.


### The transactions

For each hop there is a sender H<sub>A</sub> and a receiver H<sub>B</sub> and they share a multisig output that is used for the transfer. The HTLC output is created by an *HTLC setup transaction*, claiming the multisig output. The output script of the setup transaction is as follows:

	OP_IF		OP HASH160 <Hash160 (s)> OP_EQUALVERIFY 2
		<Alice> <Bob> OP_CHECKMULTISIG
	OP_ELSE
		2 <Alice> <Bob> OP_CHECKMULTISIG 
	OP_ENDIF

During the execution of the protocol up to three transactions are created that may claim the output of the setup transaction: a refund transaction, a settlement transaction, and a forfeiture transaction. 

* The *refund transaction* is identical to the one from the shared account setup and ensures that H<sub>A</sub> is refunded should H<sub>B</sub> not cooperate. 
* The *settlement transaction* performs the transfer from H<sub>A</sub> to H<sub>B</sub> if the latter reveals the secret. 
* Finally, the *forfeiture transaction* is used to guarantee that H<sub>A</sub> is refunded even if the secret is eventually revealed. The last scenario is used to remove the HTLC output before the refund becomes valid, i.e., when both parties agree to free the funds locked in the HTLC output without performing the transfer.

### The protocol

The sender creates the HTLC setup transaction and all three transactions spending the HTLC output and signs refund transaction, forfeiture transaction and settlement transaction. The settlement transaction uses the else-branch of the script, which uses a separate HTLC signing key for the sender. This is necessary since otherwise H<sub>B</sub> could simply use the same signature in the if-branch, since signatures are valid for both branches. 

The partially signed refund, forfeiture and settlement transactions are then sent to the receiver which adds its signature to the refund and sends it back. 

The sender signs the HTLC setup transaction and sends it to the receiver, who may attempt to claim the HTLC output unilaterally by providing its signature and the secret to the settlement transaction.

The *lifetime of the HTLC output* is limited by the refund transaction’s timelock, and **should H<sub>B</sub> want to claim it, it must release the settlement transaction before the refund is valid**. While this protocol works when committing transactions directly to the blockchain, its main use is in off-blockchain transactions.

### Nlocktime of channel refund vs nlocktime of HTLC refund

*It must be guaranteed that H<sub>B</sub> indeed has time to claim the HTLC output on the blockchain before the refund transaction becomes valid*. Should the receiver disclose the secret S to the sender, then both parties can agree on removing the HTLC output and instead add its value to another output that directly transfers to the receiver. 

Sould H<sub>B</sub> not be able to disclose *s* then it may decide to **forfeit the HTLC output**. In this case both parties sign the forfeiture transaction with no timelock, spending the HTLC output back to the sender. Once the sender has a fully signed forfeiture transaction, the receiver may not claim the HTLC output anymore since the forfeiture transaction is valid before the settlement transaction.
The HTLC output can be attached to an existing micropayment channel, the sender would simply send a micropayment update transaction which includes the HTLC output of value δ.

___
