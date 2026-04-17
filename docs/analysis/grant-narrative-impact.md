# Grant Narrative Impact — Post-httpz-Reality-Check

**Status:** Advisory. Feeds [docs/grant-proposal.md](../grant-proposal.md) revisions.
**Date:** 2026-04-17

## What changed

The original [grant-proposal.md](../grant-proposal.md) leans on "httpz" as if it's an importable primitive. [httpz-reality-check.md](httpz-reality-check.md) shows that's inaccurate — httpz is Mina Foundation's brand for the zkOracle vision; the actual primitive we'll use is Reclaim Protocol.

## What the grant doc should say instead

### Before

> httpz — prove data from HTTPS sources (the credential layer) without revealing the data

### After (options)

**Option A — honest + specific:**
> We use Reclaim Protocol's Mina integration (funded via Mina Foundation's zkOracle Integration RFP) to produce attestor-signed proofs of HTTPS credentials, which our ZkProgram verifies in-circuit alongside the content hash. This is the "httpz" vision realized through a Mina-funded zkOracle stack.

**Option B — vision + realization:**
> This project operationalizes Mina Foundation's httpz vision. We compose a user's HTTPS-rooted credential (via Reclaim, funded under Core Grants RFP #22) with a content hash inside a single o1js ZkProgram, producing a Mina-native proof any verifier can check in under a second.

Option B is stronger for reviewers because it explicitly ties to Mina Foundation's own roadmap and RFP, demonstrating we've read the funding signals.

## "Only possible on Mina" — reframed

The original claim was overbroad. The sharper, defensible version:

> **Why Mina specifically:**
> - The ZkProgram that binds credential proof + content hash runs on Mina's native o1js and produces a proof Mina validators verify natively — no bridge, no adapter, no wrapping.
> - The Reclaim Mina integration is one of three zkOracle stacks Mina Foundation funded to make this class of application first-class. We're the consumer the RFP was funded to enable.
> - Mina's 22KB verifier means any device can verify provenance in <1s — relevant for mobile verifiers, embeds, and browser extensions.
> - Recursive proof composition lets Branch A (human) and Branch B (AI) share a single verifier surface — a property that would require extra infrastructure on chains with non-recursive proof systems.

Cut any phrasing that implies pure client-side TLSNotary or "zero external trust." Reclaim's attestor network is an external trust assumption. Be honest — reviewers will ask.

## Milestone impact

The four milestones in the current proposal remain valid, but milestone 1 needs wording:

### Before
> zkProgram: content hash + httpz credential proof (human branch)

### After
> OriginProof ZkProgram: Poseidon content hash + Reclaim HTTPS-claim verification (human branch), composed into a single o1js proof

## Reviewer objections to prepare for

1. **"Reclaim's attestors are a trust assumption — how is this decentralized?"**
   - Answer: the *proof verification* is decentralized (Mina chain). The *HTTPS claim vouching* is attestor-based. We disclose this and note that zkEmail-in-o1js (zkIgnite Cohort 3) is our planned pure-Mina upgrade path.

2. **"Why not wait for pure TLSNotary on Mina?"**
   - Answer: no production-ready pure-TLSNotary exists on Mina in April 2026. zkNotary (Vixus Labs) is research-only and unmaintained. Shipping now with Reclaim beats shipping never.

3. **"How is this different from Reclaim's existing demo apps?"**
   - Answer: Reclaim's demos prove credentials in isolation. We bind credentials to *content hashes* and produce a single shareable proof for creator provenance — the application layer Reclaim was funded to enable but doesn't itself build.

4. **"Budget for what exactly?"**
   - Itemize: circuit development, UI, testnet + mainnet deployment, demo production, maintenance runway. Match to Builders Grants typical ranges (see [grant-proposal.md](../grant-proposal.md) budget TBD).

## Action items for the grant doc

- Replace all bare "httpz" references with either "Reclaim Protocol (Mina Foundation zkOracle RFP)" or "Mina's httpz stack (via Reclaim)."
- Rewrite "Why Mina" section with the four reframed bullets above.
- Add a "Trust model disclosure" subsection under Solution.
- Fill in the budget column.
- Add the repo link (will be populated when pushed).
- Reference this analysis doc and [httpz-reality-check.md](httpz-reality-check.md) as research backing.
