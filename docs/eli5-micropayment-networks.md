# ELI5 - micropayment networks

We describe how a network of maicropayment channels can be built using features that are available in bitcoin today. In addition to the script tags used in standard bitcoin payments, we only use nlocktime and [insert the hash thing].

## Unidirectional payment Channels

Say Alice wants to use Bob's internet connection and pay 0.0001 bitcoin per MB after each MB she used. To save transaction fees the two set up a payment channel between the two. 

The way this channel works is that after the first MB Alice has used she signs a bitcoin transaction that spends 0.0001 to an address controlled by Bob. Bob could push this transaction to the blockchain immediately. However Bob decides to wait a bit. After Alice has used the the second MB she sends him a second transaction, this time spending 0.0002 from the same output as the previous one. Thus Bob can only ever one of the transactions. 

Note that in the example above, Alice has effectively given two payments to Bob. As they spend the same output only one of them will ever be accepted into the blockchain. As the second transaction gives him more money, he will very likely use that one.

As only one transaction is ever broadcast to the Bitcoin network, the two have to pay only one transaction fee. Note also that the two could continue to exchange more transactions without broadcasting them and further drive down the cost per transaction.

### Spending from a multisig address

*We have to look at a few details though.* The first problem is that while Bob is waiting for the second transaction from Alice, Alice might spend the output that the first one spends. In this way Alice could 'steal' her first payment to Bob. To make sure that this is not possible the payment transactions spends from an 2-of-2 multisig address that Alice funds, but both controll. This way Bob can prevent Alice from spending from the output used in previous payment transactions without his consent.

### Building a refund transaction

But now Alice is at risk: Recall that she funds the multisig address, but both of them must collaborate to spend money from that address. Now Bob could missbehave and basically hold Alice's funds hostage for an undeterminate amount of time. He might even try to blackmail her: 'If you don't give me 0.01, I will prevent you from ever getting those 0.1 from the multisig again'.

To prevent that from happening, the two sign a transaction that spends all funds of the multisig address back to an address that Alice controlls. This transaction has it's locktime set to some point in the future, say 30 days. Only after Alice has this transaction will she fund the multisig address. This way Bob can only hold Alice's funds hostage for 30 days.

### Implications of the model

Note that the timelock forces the receiver to broadcast the last payment transaction before the timelock of the refund transaction expires. 

Also, note that only the refund transaction must have a timelock, the payment transactions can be broadcast to the blockchain immediately. Thus the receiver can close the channel immediately by broadcasting his last transaction immediately. The sender can close the channel immediately if the receiver cooperates, otherwise he has to wait until the refund transaction becomed spendable.

## Multi hop channels

Setting up a payment channel does not come for free. Eventually two transactions have to be broadcast to the blockchain and two transaction fees must be payed. Thus, it is unrealistic that everybody in the world sets up a payment channel with everybody else. To solve this problem payments will be routed through a network of nodes that forwad payments between parties. 

The immediate concern when routing through other participants is that the guy in the middle will run with the money. Immagine Alice wants to send money to Dave, routed through Bob and Carol:

    Alice -> Bob -> Carol

If Alice just sends money to Bob, Bob has no reason to forward that money to Carol.

One way to solve this is to try to enforce that Bob does not run with the money is through hash time locked contracts, discussed next.

### Hash time locked contracts by Example

Lets say that Alice owes Dave 0.1 bitcoin. She wants to pay through a lighting network, but does not have a payment channel open to him. However, she can route through Bob and Carol:

    Alice -> Bob -> Carol -> Dave

We are assuming that all actors are malicious and acting in their own best interest. However we assume that Alice actually wants to pay the Dave.

**Step 1)** Dave generates a secret (just a long random string). Alice and Dave agree to use the secret as a payment confirmation token, that is if Alice can present the secret then they will consider the payment to be made.

Alice is happy with this arrangement, all she'll need is knowledge of the secret and her debt will be considered payed. Dave has no reason to worry either: he is never forced to reveal the secret, and will only do so if he get's 0.1 in return.


**Step 2)** As Alice has no channel open to Dave, she turns to Bob who is "closer" to Dave in the network. She proposes the following: "Yo Bob, if you can send me Dave's secret, then I will send you 0.100002".

That's not an irrational thing for Alice to do given that Dave will accept the fact that Alice knows the secret as a proof that she has re-payed her debt. Bob is not at risk, bc he has neither made a payment nor promised to pay anybody.


**Step 3)** Bob is now motivated to see if he can get ahold of Dave's secret. So he turns to Carol, bc he knows that Carol has a direct channel with Dave. He says: "Carol, if you can send me Dave's secret then I will send you 0.100001".

There is no risk involved for Bob at all: If Carol accepts and gives him the secret, he'll pay her the 0.100001, but he can get a refund of 0.100002 from Alice. Like Bob in the step before, Carrol is not worried bc she has not made any commitment at this point.


**Step 4)** Next Carol tries to get ahold of Dave. However, Dave is not online. Carol leaves him messages: "Hey Dave, we should get together again. Btw I heard you know a secret, wanna let me know? I'll give you 0.1".

When Dave gets back online he finds Carol's message, Dave has a bit of a decision to make: He has three options:

1. Give the secret to Carol, and get 0.1 from her. Since he shares the secret with somebody and information wants to be free, Dave is aware of the possibility that Alice will end up knowing his secret. However Dave does not need to worry about that, bc he gets his money (and Alice can prove that she payed). 
  
  However, Dave is not certain that Alice will end up knowing the secret. That case is even better for Dave, bc he get's money from Carol and can still claim that Alice owes him money (that's bc Alice cannot prove the payment by presenting s).

2. Dave's second option is to give the secret to someone other than Carol. This is a very bad move for Dave. He is not sure to get money from Carol. Plus, as he has shared the secret, he cannot control if Alice will end up knowing the secret (in fact that's a very likely outcome as Alice is willing to pay money to get ahold of the secret). Dave would be very stupid opt for this decision..
  
3. Finally, Dave could not give the secret to anybody. In this case all the above contracts are "in the air", nobody pays money to anybody bc nobody other than Dave knows s. Nothing bad happens in this case other than that Dave does not get any money. Not an awesome move for him, but well.

Note that only in case where Dave is sure to get his money is (a). As we assumed that Dave is acting in his own self interest, he will opt for (a) as soon as he finds Carols message.

What if Dave never comes back: nobody pays, nobody looses money, Dave never get's payed and Alice can keep her money... (same as option c)

So Dave gives the secret to Carol and gets 0.1. At this point Carol goes through the same thinking as Dave and will end up giving the secret to Bob and get 0.10001 in return. Same thing for Bob, who finally gives the secret to Alice.

####Let's see who has what now:

* Alice has payed 0.10002, 0.1 to Dave and 0.00002 in network fees. But she knows the secret so she can prove she has re-payed her debt.
* Bob made a profit of 0.00001
* Carol made a profit of 0.00001
* Dave got a payment of 0.1 and must assume that Alice ended up knowing the secret

Everybody should be happy at this point.

## A Theorem

The above example can be turned into a proof of the following

**Theorem.** Assuming that all all actors are malicious and acting in their own best interest we have that

* any actor knows Dave's secret if and only if that actor has (indirectly) payed Dave 
* any actor other than Alice will only make a promise to make a payment after they have a promise from another party that will refund them

Note that a corollary is that Alice will know Dave's secret if and only if she has payed Dave. 

The proof of the theorem is by induction on the length of the chain between Alice and Dave where the base case is trivial and the inductive step is essentially the argument made above.
