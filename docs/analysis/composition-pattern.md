# Composition Pattern — Reclaim Proof + OriginProof

**Status:** Design note supporting Phase 1 implementation.
**Date:** 2026-04-17

## The question

How does a Reclaim HTTPS-claim proof fit inside our own `OriginProof` ZkProgram? Recursive sub-proof, or witness data?

## Answer: witness data, not recursive sub-proof

Reclaim-style attestor proofs are **not Mina proofs**. They are ECDSA signatures over structured claim data. Inside our o1js ZkProgram, we:

1. Receive `{ claimInfo, signedClaim }` as witness inputs (private).
2. Reconstruct them as o1js-native types (vendored `ClaimInfo`, `SignedClaim`, `Proof` classes from Reclaim).
3. Call `verifyProof(p)` inside our `@method` — this checks the attestor's ECDSA signature over the claim fields.
4. Bind our own public inputs (content hash, wallet pubkey) to the verified claim fields in the same method.

This is simpler than recursive composition. A recursive sub-proof would require Reclaim to emit a Mina Proof object; they emit an ECDSA-signed struct instead. We just verify the signature in-circuit.

## Why this matters for the ZkProgram shape

Our architecture doc currently says:

> Both branches produce proofs of the same shape (`OriginProof`). A verifier doesn't need to know which branch was used — it checks one proof type.

This is still achievable, but the *witness* differs between Branch A (Reclaim struct) and Branch B (zkML proof). The *ZkProgram* definition — public inputs, public output, verifier — is shared.

Two implementation shapes to consider:

### Option 1: Single ZkProgram with method-per-branch

```ts
const OriginProof = ZkProgram({
  name: 'OriginProof',
  publicInput: OriginPublicInput,  // { contentHash, credentialCommitment, originType }
  publicOutput: Field,

  methods: {
    proveHuman: {
      privateInputs: [ReclaimProof, Signature, PublicKey],
      async method(publicInput, reclaim, sig, pubKey) {
        verifyProof(reclaim);
        sig.verify(pubKey, [publicInput.contentHash]).assertTrue();
        // bind reclaim claim fields to credentialCommitment
        // assert originType === 0
        return publicInput.contentHash;
      },
    },
    proveAI: {
      // Phase 2 — zkML witness
    },
  },
});
```

Verifiers call `OriginProof.verify(proof)` without caring which method produced it.

### Option 2: Two ZkPrograms, one verifier-facing wrapper

More ceremony, cleaner separation. Probably premature for Phase 1.

**Go with Option 1.** Revisit if Phase 2's zkML witness breaks the method-per-branch boundary.

## Implementation sequence

1. **Scaffold `OriginProof` with a stub `proveHuman` method** — just binds `contentHash` + Mina signature, no Reclaim yet. Tests should compile + prove + verify locally.
2. **Clone [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration)** — verify o1js version compatibility, vendor the minimal subset into `packages/circuits/src/reclaim/`.
3. **Wire `verifyProof(reclaim)` into `proveHuman`.** Update tests to include a real (or fixtured) Reclaim claim.
4. **Measure prove time** in a Node test. If >120s, revisit [D-003](../../DECISIONS.md).
5. **Port to browser** — same code, measure again.

## Trust-boundary map

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (client-side prove)                                     │
│                                                                 │
│   User content ──► Poseidon hash ──► contentHash ─┐             │
│                                                   │             │
│   Reclaim SDK ──► attestor network ──► signedClaim─┤            │
│                                                   │             │
│   Mina wallet ──► sign(contentHash) ──► signature ─┤            │
│                                                   ▼             │
│                                        OriginProof.proveHuman   │
│                                                   │             │
│                                                   ▼             │
│                                        Mina proof (shareable)   │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                 Any verifier (browser, zkApp, CLI)
                                 runs OriginProof.verify(proof)
```

**Trust roots:**
- Poseidon hash: math.
- Mina signature: user's private key.
- Reclaim claim: Reclaim's attestor network (disclose).
- Mina proof: the o1js/Mina setup.
