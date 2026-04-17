# Grant Proposal Draft — zk-proof-of-origin

> Living document. Refine before submission to Mina Builders Grants Program and/or zkIgnite Cohort 3.

## One-liner

A dead-simple zkApp that lets any creator cryptographically label content as human-made or AI-generated using only Mina's native primitives.

## Problem

Creators face an existential trust crisis. AI-generated content is indistinguishable from human work. Current solutions — AI detectors, watermarks, platform badges — all rely on centralized trust, are trivially defeated, or leak user data.

There is no way for a creator to **prove** their content is human-made, and no way for an AI user to **transparently declare** their content was generated, without trusting a third party.

## Solution

**One zkProgram. One proof. No trust required.**

zk-proof-of-origin uses Mina's recursive zk-SNARKs to produce a single succinct proof that binds a content hash to its origin:

- **Human path:** httpz web proof links content to a verified human credential (Mina wallet + trusted HTTPS source). No biometrics stored. Pure ZK.
- **AI path:** zkML proof verifies that a specific model produced the exact output. Transparent by design.

The proof is the service. A thin browser tool wraps it: paste content, choose path, generate proof, share a link. Anyone can verify in <1 second with no trust in any platform.

## Why Mina

This project is **only possible on Mina.** It uses exclusively Mina-native primitives:

- **Recursive zk-SNARKs** — compose credential/inference proofs into one succinct proof
- **httpz** — prove data from HTTPS sources (the credential layer) without revealing the data
- **zkML** — verify AI model inference inside a zk circuit (Phase 2)
- **22KB blockchain** — lightweight verification from any device, any browser

No extra oracles. No central server. No new token. No complex governance.

## Milestones

| # | Deliverable | Timeline | Cost |
|---|-------------|----------|------|
| 1 | zkProgram: content hash + httpz credential proof (human branch) | 4 weeks | $X |
| 2 | Browser tool: creator flow (paste → prove → share) + verifier flow | 3 weeks | $X |
| 3 | Mina testnet deployment + live demo | 2 weeks | $X |
| 4 | Mainnet deployment + embed code / QR / shareable links | 2 weeks | $X |

> Budget TBD — calibrate to Builders ($1K-$100K range) or zkIgnite cohort funding.

## Team

Kevin Kim — founder, product builder. Background in autonomous agent systems and content platforms (YARNNN). First Mina project, motivated by the creator provenance problem.

> Expand with any collaborators if applicable.

## Differentiation

| Approach | Trust model | Privacy | Verifiable | Decentralized |
|----------|------------|---------|------------|---------------|
| AI detectors (GPTZero etc.) | Trust the detector | Content sent to third party | No — probabilistic guess | No |
| Watermarks (C2PA, etc.) | Trust the platform | Metadata can be stripped | Partially | No |
| Platform badges ("made with AI") | Trust the platform | Platform sees everything | No — self-reported | No |
| **zk-proof-of-origin** | **Trust math only** | **Content never leaves browser** | **Yes — cryptographic** | **Yes — Mina chain** |

## Integration potential

The proof is a standard Mina proof. Any application can verify it:

- Social platforms: verified origin badges
- NFT marketplaces: provenance layer for digital art
- News organizations: source verification
- Content platforms: transparency labels
- Any website: embed widget / QR code

## Links

- Repository: (will be filled after creation)
- Mina httpz docs: https://docs.minaprotocol.com/zkapps/o1js/httpz
- Mina zkML docs: https://docs.minaprotocol.com/zkapps/o1js/zkml