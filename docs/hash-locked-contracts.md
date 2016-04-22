# Hash Locked Contracts


This is a simple explanation of hash locked contracts (HLCs). HLCs are a simplified version of hash time locked contracts (HTLCs) that are used in the lightning network.

The advantage of HLCs over a HTLCs is that they can be implemented using the features that are available in Bitcoin today. In addition they do not require the receiver of a payment to be online when a payment is made.

As far as I can tell from the argument below HLCs guaranty that all payments will be made to the right people eventually. However, I'm not sure if there is room for timing attacks where a party withholds a payment for extended amount of time (tbd).

## An Example

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

##

## Related Reading

[A Fast and Scalable Payment Network with
Bitcoin Duplex Micropayment Channels](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf) by Christian Decker and Roger Wattenhofer

[The Bitcoin Lightning Network:Scalable Off-Chain Instant Payments](http://lightning.network/lightning-network-paper.pdf) by Joseph Poon and Thaddeus Dryja

[Reaching the Ground with Lighning](http://diyhpl.us/~bryan/papers2/bitcoin/Fast%20and%20scalable%20payment%20network%20with%20Bitcoin%20duplex%20micropayment%20channels.pdf) by Rusty Russel

[Emulation of Hash-Time-Locked Contracts of the Lightning network by a trusted, but publically auditable escrow service](https://cornwarecjp.github.io/amiko-pay/doc/lightning_emulation.pdf) by C. J. Plooy

[Liar, Liar, Coins on Fire!](http://people.mmci.uni-saarland.de/~aniket/publications/Non-equivocationWithBitcoinPenalties.pdf) by Tim Ruffing, Aniket Kate, & Dominique Schröder


