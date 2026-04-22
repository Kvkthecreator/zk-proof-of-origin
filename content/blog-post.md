# Building the Primitive Mina's Funded Reclaim Integration Was Missing

*An in-circuit ECDSA-secp256k1 attestor verifier for Mina, why we built it, and how to use it.*

---

## The pitch we couldn't ship

A few weeks ago I started [zk-proof-of-origin](https://github.com/Kvkthecreator/zk-proof-of-origin) — a creator-provenance zkApp on Mina. The thesis is simple: a creator should be able to cryptographically label content as human-made (or transparently AI-generated) without trusting a platform, leaking the content, or relying on a watermark that gets stripped on re-upload. One zkProgram, one succinct proof, verify in a browser in under a second.

Mina is the only platform where this works without compromise. The 22KB succinct verifier means anyone can verify a proof locally — no bridge, no full node, no trusted intermediary. The o1js standard library has first-class foreign-curve ECDSA and Keccak, which is what makes verifying HTTPS-attested credentials in-circuit *actually possible*.

Mina Foundation knows this. Their public vision they call **httpz** — "the internet you can trust" — is built on exactly this premise. Their [Core Grants RFP #22](https://github.com/MinaFoundation/Core-Grants/issues/22) funded three teams (Reclaim Protocol, zkPass, ZKON) to bridge HTTPS attestations onto Mina. We were going to consume one of those funded integrations, point it at a GitHub credential, and ship.

Then we audited the leading one.

## What we found

The [Reclaim Mina integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) is real code by competent people. It has a `Reclaim` SmartContract with witness-set rotation, a working keccak claim-info hasher, a deterministic witness-selection function, helper utilities. The structural thinking is right.

But the actual cryptographic verification — the part that proves an attestor *signed* a claim — wasn't implemented. The `verifyProof` method declares `signatures: [String]` as a struct field and never passes that signatures array to any cryptographic primitive. The Merkle witness check is a tautology (`witnessProof.assertEquals(witnessesRoot)` where `witnessProof = witnessesRoot`). And — most tellingly — the test suite runs with `proofsEnabled = false`, which means the circuit *never compiles* during tests. If it did compile, it would fail: `String` isn't a provable type in o1js, so `Struct({ provider: String })` blows up the moment you try to constrain it.

I'm not pointing this out to dunk on Reclaim. I'm pointing it out because **the primitive every Mina application that wants to consume HTTPS-attested credentials needs — a real, in-circuit, secp256k1-ECDSA verifier — didn't exist**. Not in Reclaim's repo, not in zkPass's, not in ZKON's. The RFP was funded to enable applications like ours, and the application layer was waiting on a gap nobody had closed.

So we closed it.

## The primitive

The whole verifier is shorter than the audit doc. Here's the shape:

```ts
@method async verifySignedClaim(
  claimDigest: AttestorDigest,            // 32-byte keccak of claim string
  signature: EcdsaSecp256k1,              // (r, s) — drop Ethereum's v byte
  attestorPubKey: Secp256k1,              // witnessed pubkey (a curve point)
  expectedAttestorAddress: Field          // public input: 20-byte ETH addr
) {
  // 1. Real ECDSA-secp256k1 verification — in circuit.
  const msgHashScalar = digestToSecp256k1Scalar(claimDigest);
  signature
    .verifySignedHash(msgHashScalar, attestorPubKey)
    .assertTrue('attestor ECDSA signature is invalid');

  // 2. Derive the attestor's Ethereum address from the pubkey, in circuit.
  const pubKeyBytes = pubKeyToBigEndianBytes(attestorPubKey);
  const ethAddrDigest = Keccak.ethereum(Bytes.from(pubKeyBytes));
  let derivedAddress = Field(0);
  for (let i = 12; i < 32; i++) {
    derivedAddress = derivedAddress.mul(256).add(ethAddrDigest.bytes[i].value);
  }

  // 3. Bind the derived address to the trusted attestor address.
  expectedAttestorAddress.assertEquals(derivedAddress);
}
```

That's it. Three steps. The whole thing built on o1js standard library — `createForeignCurve(Crypto.CurveParams.Secp256k1)`, `createEcdsa()`, `Keccak.ethereum`, `UInt8`, `Field.fromBits`. No external crypto, no sidecar prover, no bridge.

A few subtleties matter:

**Reclaim signs the digest, not the pre-image.** When an attestor signs a claim, they keccak the canonical `provider\nparameters\ncontext` string off-circuit, then sign the resulting 32-byte hash directly. So we use o1js's `verifySignedHash`, which takes a pre-computed scalar — not `verify`, which would apply keccak256 a second time and produce a hash mismatch.

**The Ethereum address derivation has to live in-circuit.** If we trusted an off-circuit derivation and just compared addresses, a malicious prover could substitute any pubkey with a matching ECDSA signature for a different message. The in-circuit `keccak256(pubkey)[12:]` is what proves the witnessed pubkey is the trusted attestor — without it, the public-input binding is meaningless.

**Drop the `v` byte.** Ethereum's 65-byte signature format includes a recovery ID. Recovery is what lets `ecrecover` derive a pubkey from a signature alone. We don't need it — the pubkey is a witness input, so we just consume `(r, s)` and ignore `v`.

## Measured

Standalone spike: compile 30s, prove 13s, verify 0.45s on a modern laptop. Integrated into our `OriginProof` ZkProgram alongside two other proof modes (wallet-only, and a Poseidon-committed variant for non-Reclaim attestors): compile 61s, prove 18s, verify under 1s. In the browser, prove time is 2–4× slower — call it 30–60s for a one-time circuit compile, then 5–18s per proof depending on mode.

Not bad for "the primitive that lets any Mina application consume Reclaim/zkPass/ZKON credentials."

## What we built on top

Once the primitive worked, the rest was product work:

- An `OriginProof` ZkProgram that binds a content hash + Mina wallet signature + attestor signature into a single succinct proof. Verifiers check one proof type regardless of which credential path was used.
- A `ProofCommitmentRegistry` SmartContract — a Mina zkApp that verifies an OriginProof on-chain and anchors a compact Poseidon digest. [Live on Mina devnet](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs).
- A browser app that does everything client-side: paste content, generate proof in the browser, share via URL hash, verify locally. [Hosted demo](https://kvkthecreator.github.io/zk-proof-of-origin/) (uses `coi-serviceworker` to synthesize COOP/COEP headers since GitHub Pages can't set them natively, and `unplugin-swc` to preserve o1js decorator metadata under Vite).

Full repo at [github.com/Kvkthecreator/zk-proof-of-origin](https://github.com/Kvkthecreator/zk-proof-of-origin). 18/18 tests passing, decision log at [`DECISIONS.md`](https://github.com/Kvkthecreator/zk-proof-of-origin/blob/main/DECISIONS.md), full audit + research notes under [`docs/analysis/`](https://github.com/Kvkthecreator/zk-proof-of-origin/tree/main/docs/analysis).

## Upstreaming

The primitive belongs in Reclaim's repo, not just ours. Every Mina application that wants to verify a Reclaim claim should be able to `npm install` and call `verifySignedClaim()` rather than re-derive the byte-packing math from scratch.

So we opened a PR: [reclaimprotocol/mina-sdk-onchain-integration#1](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/pull/1). Draft, fully backward compatible, all 18 of their existing tests still pass, and a new `proofsEnabled = true` test suite that exercises the full circuit-compiled ECDSA path (~86s total wall clock, including the compile).

What I want from this PR isn't credit — it's adoption. If a maintainer merges (or even iterates on) this, the next builder who shows up wanting to consume HTTPS-attested credentials on Mina doesn't have to do what we did. The ecosystem becomes strictly better off.

## Why this is actually a good outcome for Mina Foundation

It's tempting to read "the funded integration was missing the core primitive" as a critique of Mina's grant program. It isn't. Three reasons:

1. **The RFP was right.** Funding teams to build HTTPS-to-Mina bridges is exactly how an ecosystem bootstraps. Some funded deliverables ship at varying levels of completeness — that's true of every grant program ever, in any field.

2. **The downstream-fix pattern is healthy.** A creator-provenance zkApp built on the integration found a gap and contributed the fix back. That's the kind of leverage Mina wants — the grant money goes further when the ecosystem self-repairs.

3. **The primitive itself proves Mina's positioning.** The reason we *could* build this in three days is that o1js has production-ready foreign-curve ECDSA and native Keccak. Try doing this on any chain that doesn't have first-class zk-SNARK tooling. You can't.

We've applied for a Mina Builder Grant ($25K, M3–M6) to fund the next stretch — live Reclaim SDK wire-up, Auro wallet on-chain anchor flow, demo + community outreach, and finalizing this PR through maintainer review and a security pass. Decision expected by ~2026-05-20. If approved, we'll keep contributing back. If not, we'll keep contributing back anyway, just slower.

Either way, this primitive is now in Reclaim's PR queue. Go use it.

---

*Repo: [github.com/Kvkthecreator/zk-proof-of-origin](https://github.com/Kvkthecreator/zk-proof-of-origin) · Live demo: [kvkthecreator.github.io/zk-proof-of-origin](https://kvkthecreator.github.io/zk-proof-of-origin/) · zkApp on Mina devnet: [B62qpPxW…nbHgNoVU](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs) · Upstream PR: [reclaimprotocol/mina-sdk-onchain-integration#1](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/pull/1)*

*— Kevin Kim*
