#A gentle introduction to the lightning network

We describe the lightning network in non-technical terms. We omit some details, but try to convey the general idea of how it works.

##Direct payments (aka payment channels)

Payment channels can be used if a sender, say Alice, wants to send recurring payments to a receiver, say Bob. To send the first payment, Alice sends Bob a Bitcoin transaction that spends 10 cent from Alice to Bob. Bob can broadcast this transaction to the blockchain immediately to claim his funds. However, a fee needs to be payed when a transaction is broadcast to the blockchain, so Bob waits, hoping that Alice will send more payments.

When Alice wants to send an additional 10 cents to Bob she sends him a transaction over 20 cents that claim the same funds that the first transaction did. This way Bob can only ever broadcast one of the transactions and not both. This procedure can be repeated many times. At the end Bob broadcasts only one transaction to the blockchain.

###Why a shared address is needed

However, there is still a way for Alice to cheat Bob. After Alice has made multiple payments to Bob, and Bob is waiting for the next payment, she could broadcast the first transaction to the blockchain. This way only 10 cents would be payed to Bob.

This can be prevented by setting up a shared address that both Bob and Alice control jointly (a 2-of-2 multi-signature address in Bitcoin speak). This is a special kind of Bitcoin address that requires Alice and Bob to agree whenever an outgoing payment is made. Then, Alice first sends some funds, say $50, to the shared address. All micro payments from Alice to Bob are sent from that jointly controlled address. This way Bob does not have to worry that Alice will run with the money while Bob waits for further payments.

###Preventing a hostage situation

However in the last step, we have actually made Bob a bit too powerful. Once Alice funds the shared address, Bob can take her coins hostage. Remember that both have to agree whenever money gets spent from the shared address. Now Bob could bribe Alice: "If you do not pay me $5, I will prevent you from  accessing the $50 in the shared address ever again."

This problem can be solved by setting up a "refund transaction" before Alice funds the shared address. The refund transaction spends the entire funding amount ($50) back to Alice. However the transaction can only be broadcast to the blockchain in the future, say 30 days. This way Bob can safely accept recurring payments from Alice within 30 days, and Alice is assured that Bob can keep her funds hostage for at most 30 days.

###Extensions

There exist slightly more complex versions of payment channels that allow the channel to stay open indefinitely and to allow for bi-directional payments. These extensions are based on similar ideas and are beyond the scope of this document.

##Routed payments (aka the lightning network)

The above section describes payments between two parties over a payment channel. As there is a cost associated with setting up a payment channel (currently 10-20 cents) it is not economically feasible to set up mutual channels between any two individuals.

However this is not necessary as payments can be routed via other parties. For example, say Alice has a payment channel to Bob, and Bob has a channel to Carol. If Alice wants to pay $1 to Carol, she can route the payment through Bob.

	Alice -> Bob -> Carol

The general risk is that Bob keeps Alice's money and does not forward to to Carol. The idea to prevent that from happening is to force Bob to pay Carol before Alice pays Bob. The next section explains how this can be enforced.

### Enforcing a payment order

Carol creates secret string that only she knows. Alice and Carol agree that as soon as Alice knows that secret they will assume that the payment has been made. Essentially Alice now wants to buy that secret for $1.

As Alice knows that Bob is closer to Carol along the path, she promises Bob: "If you can get me Carols secret, I will pay you $1.01". At that point Bob turns around to Carol and promises "If you tell me your secret, I will pay you $1". One should note that these are in fact not promises that require trust, but rather "smart contracts" that can be enforced on the blockchain with mathematical certainty.

At this point Carol is happy to give her secret to Bob in exchange for $1. If she gives out her secret, she must be aware that that secret might eventually end up in the knowledge of Alice. However she does not care, because she got her money anyway. Once she tells the secret to Bob, Bob goes ahead and gives the secret to Alice in exchange for $1.01. At the end of this exchange, Alice knows the secret and can thus prove to Carol that she made the payment, Bob has made a small profit of one cent, and Carol has gotten her money. Everybody is happy.

If you have any feedback or questions, feel free to join our (Slack channel)[https://yours-slackin.herokuapp.com/]
