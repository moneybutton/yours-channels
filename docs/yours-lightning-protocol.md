Yours Lightning Protocol
========================

Definitions
-----------
- Alice (A) opens a payment channel with Bob (B) and makes a payment to Carol
  (C). Carol and Bob may be the same agent. Carol and Alice may be the same
  agent.
- The transaction fee is F.
- The channel is funded with N satoshis.
- The payment is M satoshis, and M < N.
- The change is R = N - M - F, and it must be that R >= 0.
- The transaction fee for a commitment tx is F satoshis.
- An HTLC secret is 32 bytes long and its hash is 32 bytes long.
- An RHTLC secret is 32 bytes long and its hash is 32 bytes long.

Open Channel Protocol: Alice opens a channel with Bob
-----------------------------------------------------
- Alice and Bob exchange public keys and they produce a multisig address.
- Alice funds the multisig address with N satoshis with the funding tx. She
  does not yet broadcast the funding tx.
- Alice and Bob proceed with the Payment Protocol (below) paying 0 satoshis to
  Bob.
- Upon success of the Payment Protocol, Alice broadcasts the funding tx.

No value has been sent to Bob or Carol at this point. The channel is funded
with N - F satoshis. It does not have to be the case that Alice opens the
channel; Bob could also open the channel. However, the agent who opens the
channel is fully responsible for funding the channel.

Payment Protocol: Alice pays Carol M satoshis
---------------------------------------------
- Carol produces an HTLC secret and shares its hash with Alice.
- Alice and Bob produce new RHTLC secrets and share their hashes.
- Alice and Bob produce new HTLC secrets and share their hashes.

- TODO: Note that Carol is really the only one that needs to generate HTLC
  secrets since she is the one being paid. Perhaps we can simply the scripts?
  That might destroy the symmetry.

- Alice produces Bob's new commitment tx containing:
  - An RHTLC output of M satoshis with Carol's HTLC hash and Alice's RHTLC hash
    to Bob.
  - An HTLC output of N - M - F satoshis (the remainder) with Alice's HTLC hash
    to Alice.
- Alice signs Bob's commitment tx and gives it to Bob. Bob signs it and holds
  it.

- Bob produces Alice's new commitment tx containing:
  - An HTLC output of N - M - F (the remainder) satoshis with Alice's HTLC hash
    to Alice.
  - An RHTLC output of M satoshis with Carol's HTLC hash and Bob's RHTLC hash
    to Bob.
- Alice signs Bob's commitment tx and gives it to Bob. Bob signs it and holds
  it.

- Carol receives a payment of M satoshis. It does not matter to Alice how Carol
  receives this payment, although the most likely possibility is that Bob and
  Carol have an open payment channel and Bob sent an HTLC output to Carol with
  her HTLC hash. After Carol is paid, Carol then shares her HTLC secret with
  Bob. Bob then shares Carol's HTLC secret with Alice.

- Alice shares her RHTLC secret with Bob.
- Bob shares his RHTLC secret with Alice.

Edge Case Protocols
-------------------
- Someone broadcasts a commitment tx at any point
- Someone doesn't share a secret
- Someone becomes unresponsive to all messages
