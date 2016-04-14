# How to build a bitcoin micropayment network today
(Draft 0.2)

We describe how a network of micropayment channels can be built. Our construction is not vulnerable to malleability and only uses constructs that are available today. We also show how our construction can easily upgraded once CSV gets deployed to have nicer properties such as payment channels that do not expire. 

## Uni-directional payment channels

Sender and receiver will sign and exchange payment transactions of the form below.

![alt text](./ntl-channel-now.png "ntl-channel-now.png")

Both parties know slightly different versions of the payment transactions. Receiver builds the top Payment transaction, signs it, and sends it to Sender (so sender is the only one to know the fully signed transaction). Conversely, Sender builds the lower Payment transaction, signs it and sends it to Receiver. 

Receiver will only accept a payment until 2 days before the CTLV timeout expires (day 27 in the example below).

Sender will use a new private key to generate the multisig output of the Payment transaction every time he generates a new one. Whenever a new payment is created, Sender will share the key used in the old one.

This is neccessary to prevent Sender from broadcasting an old payment transaction (note that the older payment transactions are of advantage to Sender since he will have to pay less). However, our construction prevents that from happening: Assume that Sender broadcasts an old transaction. Receiver can clearly claim the first output. The second branch of the second output is locked with a CLTV constrains, so Sender cannot spend this. However, Receiver can spend the second output as Sender has shared the key used in that transaction with him previously.

Note that if Sender tries to cheat by broadcasting an old transaction he loses not only the funds he has legitimately sent to Receiver, but all also the funds that he has not spent yet.

### Closing the channel

There can be a protocoll for closing the channel immediately if both parties agree to do so. To do so Sender signes a payment trasnaction as above just without the CTLV constraint. In this case both parties can spend their money immediately. After the channel is closed, receiver can not accept any more payments.

## Removing the time-limit

We simply replace the CLTV constraint by a CSV constraint in the output script of senders payment transaction.

![alt text](./ntl-channel-now.png "ntl-channel.png")

In this case Sender can accept payments indefinately, provided that the channel is still funded and that no 
