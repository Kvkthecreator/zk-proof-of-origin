# Pivot Decision — How to Realize "httpz" Most Primitively

**Status:** Decision rationale. Authored on user's behalf given his stated preference for the most axiomatic, primitive approach. Drives [DECISIONS.md D-007](../../DECISIONS.md).
**Date:** 2026-04-17

## The situation

Three forward paths presented after [reclaim-upstream-audit.md](reclaim-upstream-audit.md) revealed the Reclaim upstream is a non-functional scaffold:

1. **Pure-Mina fallback** — ship Phase 1 with Mina wallet signature + zkEmail (if ready). No Reclaim.
2. **Narrow the credential** — hand-tune a circuit for one specific HTTPS source (e.g., GitHub).
3. **Full ECDSA pivot** — build a general attestor-signature verifier in-circuit using o1js `Ecdsa` + `ForeignField`.

User's guiding principle: the project should be the **most axiomatic, primitive approach possible**. Grant pitch, repo narrative, and strategy all center on building on Mina's native primitives directly rather than stitching together higher-level abstractions.

## The decision: path #3 (ECDSA pivot), with a specific framing

We build the attestor-signature verifier ourselves using o1js's native `Ecdsa` + `ForeignField` primitives. This is the path most aligned with the project's axiomatic-primitive thesis.

## Why this matches "most axiomatic, primitive"

Each path, held up against the primitive principle:

- **Path #1 (pure-Mina wallet sig + zkEmail)** avoids ECDSA entirely but gets there by *dropping the HTTPS-identity story*. A wallet signature proves key control, not humanness. zkEmail is clean but narrow (email-only), and it's not yet production-ready in April 2026. Net effect: we'd ship something technically pure but *claim-ing less*. The grant pitch weakens.

- **Path #2 (narrow to GitHub)** hand-tunes a circuit for one HTTPS source. Pragmatic but *un*-primitive: it's a special case, not a general primitive. A reviewer asks "what about Twitter?" and we'd need another bespoke circuit. This is the opposite of axiomatic.

- **Path #3 (ECDSA pivot)** implements the *primitive* that every HTTPS-credential-on-Mina project needs: in-circuit verification of an attestor's ECDSA-secp256k1 signature over a claim digest. One circuit, arbitrary HTTPS source, arbitrary attestor. This IS the axiomatic unit of work.

The user's own principle picks this path.

## Secondary reasons, in support

1. **It maps directly to the Mina Foundation zkOracle RFP.** The RFP exists precisely because nobody has built this primitive cleanly yet. Reviewers who funded the RFP will recognize what we're building.

2. **The upstream audit gave us free evidence of the gap.** We can cite [reclaim-upstream-audit.md](reclaim-upstream-audit.md) in the grant as proof that the gap is real and unclosed.

3. **It's cite-worthy as a public good.** Once working, upstream a PR to Reclaim's repo. The grant pitch gains a "contributes back to a Mina-funded project" beat.

4. **o1js already has the primitives.** `Ecdsa.verify`, `createForeignCurve`, `Keccak.ethereum` are all in the o1js standard library. We're composing, not inventing cryptography.

## Risks acknowledged

1. **Proof-time cost.** Foreign-field ECDSA verification is expensive in constraints. The [D-003](../../DECISIONS.md) budget of 30–120s browser prove time may be breached. **Mitigation:** measure in Node first, then browser. If it's 3–5 min, we still ship — the demo video is the artifact, not real-time UX.

2. **Implementation complexity.** ECDSA-over-foreign-field in o1js is non-trivial but documented and has working examples in the o1js test suite. **Mitigation:** start with a standalone spike (verify one hardcoded secp256k1 signature) before integrating into OriginProof.

3. **Schedule.** +3–5 days over vendoring path. Phase 1 estimate moves from ~3 weeks to ~4. **Mitigation:** acceptable — the demo quality improves materially, and the grant budget should account for real cryptographic work.

## What we're NOT doing (explicit non-goals)

- Not writing our own ECDSA gadget from scratch. Use o1js's `Ecdsa` class directly.
- Not building a general-purpose zkOracle. Scope is narrow: verify one attestor signature over one claim digest bound to one content hash.
- Not deferring this to Phase 2. The whole point is that the primitive IS Phase 1.
- Not implementing the full Reclaim witness-set Merkle tree. For the grant demo, a fixed attestor pubkey (stored as circuit constant or public input) is sufficient. Multi-attestor witness-set verification is a Phase 2 expansion.

## Implementation shape

```
OriginProof.proveHumanWithAttestor(
  publicInput: { contentHash, attestorCommitment, originType },
  privateInputs: (
    signature: EcdsaSignature,           // Reclaim attestor's sig
    attestorPubKey: EcdsaPubKey,         // secp256k1 foreign-curve pubkey
    claimDigestBytes: Bytes,             // keccak256 of (provider || params || context)
    walletSig: Signature,                // Mina wallet sig over contentHash
    walletPubKey: PublicKey,             // Mina wallet pubkey
    claimOwnerField: Field               // Reclaim claim.owner — binds claim to user
  )
) {
  // 1. Verify attestor ECDSA signature over claim digest
  signature.verify(claimDigestBytes, attestorPubKey).assertTrue();

  // 2. Bind attestor identity to public input
  Poseidon.hash(attestorPubKey.toFields()).assertEquals(publicInput.attestorCommitment);

  // 3. Bind Mina wallet to user-controlled content
  walletSig.verify(walletPubKey, [publicInput.contentHash]).assertTrue();

  // 4. Bind wallet pubkey to the Reclaim claim's owner field
  //    (keeps the credential cryptographically tied to the prover)
  Poseidon.hash(walletPubKey.toFields()).assertEquals(claimOwnerField);

  return publicInput.contentHash;
}
```

This is the axiomatic unit. Everything else (creator UI, verifier UI, testnet deploy) composes on top of it.

## Sequencing

1. **Spike:** standalone ECDSA verification ZkProgram, verify one hardcoded Reclaim-shaped signature. Measure compile + prove time.
2. **Integrate:** fold spike into `OriginProof` as a new method. Keep existing `proveHuman` (wallet-only) for fallback.
3. **SDK wire-up:** use `@reclaimprotocol/js-sdk` in the browser to fetch a real `{ claimInfo, signedClaim }`. Parse into ZkProgram witness.
4. **End-to-end test:** Node-side test with a fixture signed claim (grab one from Reclaim's test data or generate with a known secp256k1 key).

If step 1 reveals >10min proving time or missing o1js primitives, reconvene and consider narrowing to path #2 for the grant demo while keeping the full primitive as the roadmap.

## Communication to the user

Summarize the decision in plain language, not crypto jargon. The user should understand:
- We are building *the* primitive, not hand-crafting one HTTPS source.
- This adds days, not weeks, to the timeline.
- The grant narrative gets stronger: "we built the primitive Mina Foundation funded the RFP to enable, and contributed it back."
