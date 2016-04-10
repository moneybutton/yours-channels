# How to build a bitcoin micropayment network today
(Draft 0.1)

We describe how a network of maicropayment channels can be built using features that are available in bitcoin today. In addition to the script tags used in standard bitcoin payments, we only use nlocktime and an hash opcode like OP_SHA256. The basic trick is that HTLCs can be expressed using only nlocktime and a hash opcode.

## Unidirectional payment Channels

We use standard uni-directional payment channels. The construction is as usual.

Note that the timelock of the refund transaction forces the receiver to broadcast the last transaction he receives from the sender before the timelock expires. Consider for example the case where the timelock of the refund transaction is due to expire in 30 days and receiver gets a payment trastion of 0.1 from sender. The contract on that payment transaction can be read as 
> Receiver will get 0.1 bitcoin within 30 days.

Note that the nlocktime of a payment channel can easily be decreased if both parties agree: to accomplish this sender signs a transaction that distributes the current balance between the two parties as usual but that has a lower nlocktime than the refund transaction. Receiver now signs this transaction and sends it back to the Sender. A small case distinction shows that Sender will prefer this transaction over the original refund transaction (todo).

Conversely, it is also possible to increase the nlocktime of a channel if both parties cooperated, but an additional transaction fee must be payed. To do this the two parties set up a new 2-of-2 multisig address, they setup a new refund transaction from the new multisig address with a higher nlocktime, and broadcast a transaction to the blockchain that spends the funds from the old multisig to the new one. This way the imput to the new refund address is spent, thus invalidating the old refund transaction.

## HTLCs

HTLCs are contracts that force intermediate nodes of a payment channel to be forward the payment. They are special payment transactions whos output script specifies the following contract: 

> If receiver knows a string x such that h(x)=secret within two days, then sender will send him 0.1 bitcoin.

Note that the time constraint can be enforced by setting nlocktime to "in two days" and the part about the secret can be expressed using an hash opcode such as OP_SHA256. Note that the HTLCs used in [1] use a similar construction.

Lets look at an example. Consider the case where Alice routs a payment for Carol through Bob
    
    Alice -> Bob -> Carol
    
For HTLCs to be effective, it is important that nlocktimes are decreasing along the route. We have shown above that the nlocktime of a channel can both be increased and decreased. If the nlocktimes along the route are not decreasing, then the parties will negotiate that either 

* the nlocktime of  the channel from Alice to Bob be decreased or
* the nlocktime of the channel from Bob to Carol be increased.

### Materializing the payment and the problem of receivers not online

Note that there will not be a phase of explicite secret sharing in practise. At some point before the channel between Bob and Carol expires, will Carol choose to close the channel. Bob has to monitor the channel to get a notification as to when that happens. At that point Bob can look at the spending transaction, lears the secret and close his channel to Alice.

There is no way to avoid a problem if Carol does not close her channel before it expires. At this point I think we will just have to prompt the users: "Your channel will expire in 3 days, we recommend you close it and open a new one". It would be ideal to avoid that, but I'm not sure how atm.

## References 

[1] [A Fast and Scalable Payment Network with
Bitcoin Duplex Micropayment Channels](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf) by Christian Decker and Roger Wattenhofer