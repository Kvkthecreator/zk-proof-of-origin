# Grant Proposal — zk-proof-of-origin

> **Status:** Submission-ready. Final items before send: demo video recording.
> **Last updated:** 2026-04-20

## One-liner

An open-source zkApp that lets any creator cryptographically label content as human-made or AI-generated — powered by a Mina-native ECDSA attestor verifier we built from scratch because the existing one didn't work.

## Problem

Creators face a trust crisis. AI-generated content is indistinguishable from human work, and every deployed solution — GPTZero-class detectors, C2PA watermarks, platform "made with AI" badges — has the same failure mode: it asks you to trust a third party, leaks your content in the process, or can be trivially stripped. There is no way for a creator today to **prove** authorship of content without that trust assumption.

Mina Foundation's *httpz* vision — an internet whose HTTPS data can be cryptographically verified on-chain — is the right framing for solving this. But httpz is a vision, not an importable package. The concrete primitives are the three zkOracle integrations Mina Foundation funded in Core Grants RFP #22 (Reclaim, zkPass, ZKON). We audited the leading one (Reclaim's Mina integration) and found it is a scaffold: ECDSA signature verification is absent, circuit compilation never runs in its own test suite, last commit ~3 months stale. The primitive creator-provenance applications need — *a general, in-circuit ECDSA-secp256k1 attestor-signature verifier on Mina* — doesn't exist yet.

So we built it.

## Solution

**One zkProgram. One proof. In-browser, no server.**

Our `OriginProof` ZkProgram binds three things together in a single succinct Mina proof:

1. A **content hash** (Poseidon, computed locally on the user's content — the content never leaves the browser).
2. A **Mina wallet signature** over that content hash (the user's key commitment).
3. An **attestor's ECDSA-secp256k1 signature** over an HTTPS-sourced claim (e.g. "this GitHub user owns this account"), verified in-circuit against the attestor's secp256k1 public key, which is exposed as a Poseidon-committed public input.

The proof is the product. A ~15KB gzipped browser app wraps it: paste content → generate proof → share a URL. Anyone can verify the proof in **<1 second**, locally, with no server or blockchain call. A minimal zkApp deployment anchors the proof commitment + timestamp on Mina testnet so verifiers have an optional on-chain timestamp source.

The AI-transparency branch (Phase 2) swaps the attestor witness for a zkML model-inference witness, producing the same shape of proof. Verifiers check one proof type — the witness type is the branch.

## What's actually built (as of 2026-04-19)

This proposal is not a vision doc. The core primitive is implemented, tested, runnable, and on GitHub:

- **`packages/circuits`** — `OriginProof` ZkProgram with three proof methods:
  - `proveHuman` — wallet-signature-only binding (simpler fallback).
  - `proveHumanWithAttestor` — wallet + **real in-circuit ECDSA-secp256k1 verification** of an attestor's signature, plus a Poseidon commitment over the attestor's foreign-curve pubkey.
  - `proveHumanWithReclaimAttestor` — the Reclaim-compatible mode: verifies an attestor's ECDSA-secp256k1 signature over the Reclaim keccak claim digest, then **computes `keccak256(attestorPubKey)[12:]` in-circuit** to derive the attestor's 20-byte Ethereum address and binds it to the public input. This is the axiomatic primitive: verifies a real Reclaim-shaped signed claim, entirely in circuit, against a trusted attestor address.
- **`ProofCommitmentRegistry` zkApp** — a real Mina SmartContract that verifies an `OriginProof` on-chain and anchors a Poseidon digest + monotonic counter + origin type. `anchor(proof)` prove time ~9.4s on local Mina. **Deployed to Mina devnet:**
  - Address: [`B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs)
  - Deploy tx: [`5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc`](https://minascan.io/devnet/tx/5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc)
  - Deploy runbook: [packages/circuits/deploy/](../packages/circuits/deploy/)
- **`packages/web`** — React/Vite SPA with client-side proving. Two proof modes selectable in the UI:
  - **Wallet only** — ephemeral Mina keypair signs the content hash. Observed browser prove time ~4.6s on M-series Mac.
  - **Reclaim claim** — user pastes a Reclaim-shaped JSON response (a "Load demo claim" button ships a committed fixture so reviewers can exercise the full path with zero setup). Off-circuit `ecrecover` + prepare-witness → `proveHumanWithReclaimAttestor` runs entirely in the browser.
- **18/18 tests green** across circuits, zkApp, spikes, and off-circuit helpers. Measured on M-series Mac in Node:
  - Compile `OriginProof`: ~61s (one-time, cacheable)
  - Prove (wallet-only): ~5–7s
  - Prove (attested, Poseidon commitment): ~17s
  - Prove (Reclaim-style, keccak + Ethereum address): ~18s
  - `anchor()` on-chain: ~9.4s
  - Verify any mode: <1s
- **`docs/analysis/`** — seven research documents covering: the httpz-vs-reality gap, credential-provider comparison (Reclaim vs zkPass vs ZKON vs zkEmail), a source-level audit of Reclaim's upstream, the pivot decision rationale, empirical ECDSA-spike results, composition patterns, and grant-narrative impact.
- **`DECISIONS.md`** — seven architectural decisions (D-001 through D-007) with rationale, consequences, and supersession chain.

Repository: [github.com/Kvkthecreator/zk-proof-of-origin](https://github.com/Kvkthecreator/zk-proof-of-origin). Demo video: [TBD — see §Links].

## Why Mina (sharp version)

This project is built on Mina native primitives, and the *specific* primitive that makes it work did not exist on Mina before we built it. That's the concrete answer to "why Mina, not Ethereum?"

- **Native `Ecdsa` + `ForeignField` + `Keccak` in o1js.** The in-circuit ECDSA-secp256k1 verifier we built uses o1js's first-class foreign-curve support — no sidecar proving, no bridging, no custom gadget. A Mina validator verifies the resulting proof natively.
- **Recursive zk-SNARK composition.** Human (attestor) and AI (zkML) witnesses share a single public-input shape, so verifiers check one proof type. This is cheap on Mina; non-recursive proof systems would need infrastructure around it.
- **22KB succinct blockchain.** Any device, any browser, <1s verification. This matters specifically for a creator-provenance product where verifiers are readers, not validators.
- **Directly aligned with Mina Foundation's funded roadmap.** Core Grants RFP #22 funded three zkOracle teams precisely to enable applications like this. We are the consumer the RFP was designed to enable — and we surface, and fix, a gap in the funded stack.

## Trust-model disclosure (honest version)

The proof is Mina-native and verified by math. The *claim* that the HTTPS source served particular data is vouched for by the attestor's signing key (Reclaim-style). This is the same trust model as every production zkOracle on any chain in 2026. We disclose this explicitly rather than claiming "zero trust end-to-end."

Post-grant upgrade path: zkEmail-in-o1js (funded in zkIgnite Cohort 3) offers DKIM-rooted email proofs with no external attestor. We will add it as a second provider once it reaches production readiness, giving users a choice between broad HTTPS coverage (Reclaim, attestor-trust) and narrow DKIM-rooted (zkEmail, no attestor).

## Key contribution: the attestor verifier

The upstream Reclaim Mina integration ([github.com/reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration), last commit 2026-01-28) is a `SmartContract` that:
- Never verifies the attestor's ECDSA signature (the `signatures: [String]` field is never fed to any cryptographic primitive).
- Declares `Struct` members as JS `String` (a non-provable type), causing circuit compilation to fail — which the repo's own test suite sidesteps by setting `proofsEnabled = false`.
- Stubs the Merkle witness check (asserts `root === root`).

We built the missing primitive. Our `OriginProof.proveHumanWithAttestor` uses `createForeignCurve(Crypto.CurveParams.Secp256k1)`, `createEcdsa(Secp256k1)`, and `Keccak.ethereum` — all o1js standard library — to produce a ZkProgram method that actually verifies an attestor's signature in-circuit, commits the attestor's pubkey as a Poseidon hash for public-input use, and binds it to a content hash + Mina wallet signature in a single proof.

Our upstreaming plan (post-grant, see Milestone 6): open a PR to Reclaim's repo contributing this verifier back. Public goods. This turns a "Mina ecosystem gap" into a "Mina ecosystem primitive."

## Milestones

Calibrated to Mina Builders Grants mid-tier awards (working applications with a real user surface) and zkIgnite Cohort 3 ranges (comparable scope to zkEmail-in-o1js at ~38,000 MINA). Timeline assumes solo execution.

### What's shipped (self-funded, not in ask)

| # | Deliverable | Status |
|---|-------------|--------|
| 0 | Repo scaffold, content hashing, architectural decisions | ✅ Done |
| 1 | `OriginProof` ZkProgram — wallet + ECDSA attestor + Reclaim-compatible modes, 18/18 tests | ✅ Done |
| 2 | Browser app — creator/verifier UIs, client-side proving, paste-a-Reclaim-claim mode with committed demo fixture, hash-fragment share links | ✅ Done |
| 2a | `ProofCommitmentRegistry` zkApp — deployed to Mina devnet at [B62qpPxW...nbHgNoVU](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs) | ✅ Done |
| 2b | Verifier UI reads live zkApp state, shows on-chain anchor status with MinaScan link | ✅ Done |

### What this grant funds (primary ask: $38,000)

| # | Deliverable | Timeline | Cost (USD) |
|---|-------------|----------|------------|
| 3 | **Live Reclaim SDK integration** — wire `@reclaimprotocol/js-sdk` with a QR/app-clip flow to real providers (GitHub, Twitter/X), plus a minimal backend proxy for `APP_SECRET`. End-to-end "verified human" proofs from real HTTPS sources, not fixtures. | 2 weeks | $12,000 |
| 4 | **On-chain anchor submission flow** — browser-side `anchor(proof)` via Auro wallet integration so users actually write commitments to the deployed zkApp, not just read them. Closes the read/write gap in the current verifier UI. | 1.5 weeks | $7,000 |
| 5 | **Demo video, landing site, repo polish, submission materials** — GitHub Pages auto-deploy with COOP/COEP shim (already scaffolded), 60–90s demo video, README polish, example integrations. | 1 week | $3,000 |
| 6 | **Public-goods upstream contribution** — open a PR to [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) contributing our in-circuit ECDSA-secp256k1 verifier + documented test vectors. Includes a third-party security review pass on the verifier before PR. | 2 weeks | $6,000 |
| 7 | **zkEmail-in-o1js integration** — second credential provider with DKIM-rooted trust (no external attestor), gives users a choice between broad HTTPS coverage (Reclaim) and attestor-free email verification. Honors the "post-grant upgrade path" disclosed in the trust-model section. | 3 weeks | $10,000 |

**Primary ask: $38,000 for Milestones 3–7 (~10 weeks solo FTE).** This covers 60–65% of blended-rate opportunity cost and produces (a) a deployed public demo, (b) a primitive contributed back to Mina's funded Reclaim stack as a public good, and (c) two operational credential provider backends.

### Explicitly out of scope for this application

- **Phase 2 — AI-generated content branch (zkML proof of model inference bound to content hash).** This is a meaningful follow-on that deserves its own focused application once the human branch is production-stable and zkML tooling on Mina has matured. Scope estimate ~6 weeks, ~$25–40K, to be submitted as a separate Builders application.
- **Mainnet deployment + distribution (browser extension, embed code, platform integrations).** Follows Phase 2; separate scope.

We flag these to show we've thought about the long game, not to bundle them into this ask. Reviewers who prefer focused applications get one.

## Differentiation

| Approach | Trust model | Privacy | Verifiable | Decentralized |
|----------|-------------|---------|------------|---------------|
| AI detectors (GPTZero, etc.) | Trust the detector | Content sent to third party | No — probabilistic guess | No |
| Watermarks (C2PA, etc.) | Trust the platform | Metadata strippable | Partially | No |
| Platform badges ("made with AI") | Trust the platform | Platform sees everything | No — self-reported | No |
| Reclaim alone (on other chains) | Trust attestors | Content not bound | Yes — for credential | Partially |
| **zk-proof-of-origin on Mina** | **Trust attestors + math** (disclosed) | **Content never leaves browser** | **Yes — cryptographic proof** | **Yes — Mina chain, <1s verify** |

## Integration potential

The output is a standard Mina proof. Any application can verify it:

- **Social platforms:** verified-origin badges tied to content hashes.
- **News organizations:** journalist-to-publication authorship proofs.
- **NFT / creator marketplaces:** provenance layer decoupled from platform metadata.
- **Browser extension:** in-page proof widgets ("verified human author") — Phase 3.
- **API for other zkApps:** `OriginProofClass` is exported; any Mina zkApp can consume proofs as sub-proofs.

## Team

**Kevin Kim** — solo founder. Background in autonomous-agent systems and content platforms (founder of YARNNN, a cross-LLM context hub). This is my first Mina project. I am directly motivated by the creator provenance problem — it's a trust gap in the systems my own products sit inside. Grant work is scoped to be deliverable by a solo builder with AI-pair-programming support.

## Risks and mitigations

- **Browser prove time on low-end devices.** Attested mode measured ~13s in Node; browser estimate 30–60s. Mitigation: staged progress UX (already built), wallet-only mode as a fast fallback (already built), optional proving service as a Phase 3 opt-in (architecture supports this via the `ProofProvider` boundary in [DECISIONS.md D-003](../DECISIONS.md)).
- **Reclaim SDK API drift.** Reclaim's browser SDK surface (`@reclaimprotocol/js-sdk` v5.0.0) is stable per our research but not pinned in our circuits. Mitigation: integration layer isolates the SDK so swapping to zkPass or zkEmail is a provider-interface replacement.
- **Attestor trust assumption.** Disclosed above; zkEmail path (Milestone 7) is the mitigation.

## Links

- **Repository:** https://github.com/Kvkthecreator/zk-proof-of-origin
- **Demo video:** [TBD — see [`content/demo-script.md`](../content/demo-script.md)]
- **Live devnet zkApp:** [`B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`](https://minascan.io/devnet/account/B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU/zk-txs) — deploy tx [`5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc`](https://minascan.io/devnet/tx/5JtyAdhT2AN7kocAbc6kDFp4jkfcDnmFTexQ2UMg4J3QSVoVRVCc)
- **Live demo site:** [TBD — after Milestone 5 static hosting]
- **Analysis docs:** [docs/analysis/](analysis/)
- **Decision log:** [DECISIONS.md](../DECISIONS.md)
- **Deploy runbook:** [packages/circuits/deploy/README.md](../packages/circuits/deploy/README.md)
- **Mina Foundation zkOracle RFP #22 (context):** https://github.com/MinaFoundation/Core-Grants/issues/22
- **Reclaim Mina integration (the gap we filled):** https://github.com/reclaimprotocol/mina-sdk-onchain-integration
