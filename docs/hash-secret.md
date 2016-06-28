Deterministic Hashes
====================

It is desirable to be able to derive the hash of a secret without knowing the
secret for use in HTLC or RevHTLC contracts. This is possible. The basic idea
is you can share the state of the hashing algorithm, which I call the hash
object O, without sharing the data that has been hashed.

Dave creates a secret S and finds its hash object O(S) without finding the
digest or hash(S). Dave gives the hash object O(S), which cannot be used to
derive S, to Alice, who adds random data X to S to get a new hash object
O(S+X). Alice can use O(S) to find hash(S), O(S+X), and hash(S+X), but she does
not know and cannot find S unless Dave tells her. Alice puts hash(S+X) in an
HTLC output and gives the secret X to Dave, and only Dave knows the secret S+X
and can reveal it when he has received payment.

Unfortunately, this scheme is to simple too be used to deterministically
generate many hashes by separate parties, becaues Dave can only reveal S once.
As soon as Dave publically reveals S, which would be necessary to spend an HTLC
output, all other hashes H(S+Y) for some secrets Y are now partially
compromised. A secret S can only be publically revealed once. Once S is
publically revealed, Dave would need to use a new secret S' to receive a
different payment. So although new hashes can be derived deterministically, it
is still the case that Dave needs to generate many secrets, in this case O(S)
rather than just S, for this scheme to work.
