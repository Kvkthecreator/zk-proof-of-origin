# Credential Provider Options — Comparison

**Status:** Research snapshot supporting [httpz-reality-check.md](httpz-reality-check.md) and [DECISIONS.md D-005](../../DECISIONS.md).
**Date:** 2026-04-17

## The question

For Phase 1 (Branch A / human provenance), what HTTPS-rooted credential do we bind to a content hash? The options below are all compatible with verification inside an o1js ZkProgram on Mina.

## Comparison

| Option | Maturity (Apr 2026) | Trust root | Provider breadth | "Pure Mina" score | Integration effort |
|--------|---------------------|------------|------------------|-------------------|--------------------|
| **Reclaim Protocol** | Production, actively maintained | Reclaim attestor network (ECDSA) | ★★★★★ 250+ providers | ★★★☆☆ | Low — clone + vendor |
| **zkPass** | Production, less Mina-specific docs | zkPass attestor network (MPC-TLS) | ★★★★☆ | ★★★☆☆ | Medium |
| **ZKON** | Production, oracle-focused | ZKON MPC-TLS attestors | ★★☆☆☆ (financial APIs) | ★★★☆☆ | Medium |
| **zkEmail-in-o1js** | In development (zkIgnite Cohort 3) | DKIM signing key (domain-level) | N/A — email only | ★★★★★ | High — still being built |
| **Mina wallet signature** | Trivial | Private-key holder | N/A — not a human signal | ★★★★★ | Trivial |
| **zkNotary / Vixus Labs** | Research, notary server down | TLS session (via notary) | N/A | ★★★★★ | Not viable |

## Detail per option

### Reclaim Protocol
- Flow: user scans QR, logs into HTTPS source in browser, Reclaim attestor observes the session and signs a claim (`claimInfo`). SDK hands us `{ claimInfo, signedClaim }`. Our ZkProgram runs `verifyProof` (vendored code) which checks the attestor ECDSA signature + any Merkle witnesses over specific claim fields.
- Best fit: fastest path to a working Phase 1 demo. Broad provider catalog makes the product story compelling.
- Weakness: attestor dependency. Must disclose honestly.

### zkPass
- Similar user flow to Reclaim; different attestor network. Uses MPC-TLS.
- Less Mina-specific reference material than Reclaim in April 2026. If Reclaim has unexpected integration blockers, zkPass is the next-best swap.

### ZKON
- Strong fit for financial/price oracle use cases (Binance demo). Weaker fit for identity credentials.
- Skip unless Phase 2+ expands into provenance of data-derived claims (e.g., "this NFT's floor price was X at time T").

### zkEmail-in-o1js
- Proves control of an email via DKIM signatures. No external attestor. The DKIM key is published by the email domain (e.g., `google.com`) — the trust root is the domain itself.
- As of April 2026, zkIgnite Cohort 3 funded this at 38,000 MINA. Production readiness unclear — needs verification before committing.
- **Strategic value:** strongest "pure Mina, no oracles" story. If available in time, adding this alongside Reclaim gives us a dual-provider narrative ("identity-attested OR self-sovereign email").

### Mina wallet signature
- Trivial: `Signature.create(privKey, [contentHash])`. Verified in-circuit via `Signature.verify`.
- Alone, not a "human" signal — any script can create a Mina account. Useful as a *binding layer* under a real credential (wallet pubkey becomes the identifier in the proof's public output).

### zkNotary
- Do not use. Notary server is documented as down; repo unmaintained. Pure client-side TLSNotary-on-Mina is a research direction, not a shippable dependency.

## Recommended Phase 1 composition

```
OriginProof public inputs:
  - contentHash: Field                 (from ContentHash.fromText / fromBytes)
  - credentialCommitment: Field        (Poseidon hash of credential identifier)
  - originType: Field                  (0 = human, 1 = AI; Phase 2 uses 1)

OriginProof witness:
  - Reclaim { claimInfo, signedClaim } (verified in-circuit)
  - Mina Signature over contentHash    (binds wallet pubkey to the claim)

OriginProof output:
  - Proof asserting: "holder of wallet W, who controls credential C from source S,
                      committed to content with hash H"
```

Phase 2 swaps the Reclaim witness for a zkML inference witness; public input shape stays identical. This honors the recursive-composition intent from [architecture.md](../architecture.md).

## Decision

Go with **Reclaim Protocol for Phase 1**. Treat zkEmail as an opportunistic upgrade if it reaches production readiness during the build. Recorded in [DECISIONS.md D-005](../../DECISIONS.md).
