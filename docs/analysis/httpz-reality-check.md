# httpz Reality Check — April 2026

**Status:** Research snapshot. Findings drive [DECISIONS.md D-005](../../DECISIONS.md).
**Date:** 2026-04-17
**Source confidence:** High. Cross-referenced 3+ authoritative sources (Mina Foundation blog, Core Grants RFP, Reclaim docs, GitHub repos).

## TL;DR

**"httpz" is a Mina Foundation brand, not an importable package.** It labels the aspirational vision of an internet whose HTTPS data can be cryptographically verified on Mina. The Mina X account even renamed itself "Mina Protocol (httpz)" for marketing.

The **actual primitive** that makes Phase 1 work is the set of zkOracle integrations funded by the Mina Foundation Core Grants RFP #22 ("zkOracle Integration For o1js"). Three teams were funded:

1. **Reclaim Protocol** — attestor-signed HTTPS claim proofs
2. **zkPass** — TransGate SDK with MPC-TLS attestations
3. **ZKON** — zkTLS-Mina-Oracle, MPC-TLS-based oracle

For our use case (bind content hash to a verified-human credential from GitHub / Twitter / .edu / similar), **Reclaim is the most production-ready** option as of April 2026.

## The original pitch vs reality

The project's [grant-proposal.md](../grant-proposal.md) currently says:

> httpz — prove data from HTTPS sources (the credential layer) without revealing the data

This phrasing is fine at the vision level but will not survive a technical reviewer's first question ("what package are you importing?"). We should NOT claim `import httpz from "httpz"` in any code, demo, or grant doc. We should reference the Mina Foundation zkOracle RFP by name and identify which funded integration we use.

## What actually exists, concretely

### Reclaim Protocol (recommended for Phase 1)
- **npm package:** `@reclaimprotocol/js-sdk` (v5.0.0, actively maintained April 2026)
- **Mina integration code:** [github.com/reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) — not published as a standalone npm package; vendor the `verifyProof`, `ClaimInfo`, `SignedClaim`, `Proof` classes into our repo.
- **Frontend example:** [github.com/reclaimprotocol/reclaim-mina-example](https://github.com/reclaimprotocol/reclaim-mina-example)
- **Docs:** [docs.reclaimprotocol.org/onchain/mina/quickstart](https://docs.reclaimprotocol.org/onchain/mina/quickstart)
- **Provider catalog:** 250+ (GitHub, Twitter/X, banks, ride-share, employment, education)
- **Trust model:** The proof's root of trust is Reclaim's attestor network (ECDSA-signed claims). It is NOT pure client-side TLSNotary.

### zkPass
- **SDK:** TransGate JS SDK
- **Trust model:** MPC-TLS with zkPass's own attestation network
- Similar composition pattern to Reclaim.

### ZKON
- **Repo:** [github.com/ZKON-Network/zkTLS-Mina-Oracle](https://github.com/ZKON-Network/zkTLS-Mina-Oracle)
- **Demoed source:** Binance price API
- Lower provider breadth than Reclaim; better fit for financial data oracles than identity.

### zkNotary (do not use)
- [github.com/vixuslabs/zkNotary](https://github.com/vixuslabs/zkNotary)
- Research-grade, notary server documented as down. Unmaintained.

## Trust-model disclosure we must make

Any "only possible on Mina" / "no trust required" claim needs an asterisk when using Reclaim/zkPass/ZKON: **the HTTPS-source trust root is the attestor network, not the TLS session directly**. The *proof* is Mina-native (verified in our ZkProgram via o1js), but the *claim about what was served at the HTTPS endpoint* is vouched for by attestors.

For the grant proposal, frame this honestly:
- "Mina-native verification of attestor-signed HTTPS claims"
- Not: "zero-trust end-to-end HTTPS proof"

A truly zero-trust pure-TLSNotary path does not yet exist in a production-usable form on Mina.

## 100%-Mina-native fallback

If the attestor dependency is deemed too heavy for our pitch, the cleanest pure-Mina fallback is:

1. **zkEmail-in-o1js** (funded in zkIgnite Cohort 3, 38,000 MINA grant) — proves control of an email address using DKIM signatures inside an o1js circuit. No external attestor. See [credential-provider-options.md](credential-provider-options.md) for comparison.
2. **Mina wallet signature only** — trivial, but weak as a "human" signal since anyone can create a Mina account.
3. Combine #1 + #2: `Signature.verify` over `(contentHash, emailDomain)` inside the ZkProgram, where email control is proven via zkEmail.

zkEmail is slower to integrate (still under active development in April 2026) but stronger for the "pure Mina" grant narrative.

## Recommendation

**Phase 1 uses Reclaim Protocol.** Ship fast, demo working, disclose trust model honestly. If zkEmail-in-o1js reaches production-usable state during Phase 1 build, add it as a second provider option. This is captured in [DECISIONS.md D-005](../../DECISIONS.md).

## Open questions

- **Exact version of Reclaim's Mina integration code.** Not published on npm (clone-and-vendor). Before committing, run `git log -1` on [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) to verify it still matches the docs.
- **o1js version compatibility.** Reclaim's Mina code targets a specific o1js major; our [packages/circuits/package.json](../../packages/circuits/package.json) pins `o1js ^2.2.0`. Verify compatibility during the spike.
- **Browser proving time.** Reclaim's in-circuit verification adds constraints; actual browser prove time needs measurement. Budget for 30–120s per [DECISIONS.md D-003](../../DECISIONS.md), validate empirically.

## Sources

- [Introducing 'httpz': the internet you can trust](https://minaprotocol.com/blog/httpz-the-internet-you-can-trust-with-zk-and-mina) — confirms httpz is a vision/brand, shows aspirational code that does not exist.
- [Three Expert Teams Chosen to Introduce zkOracle Features to o1js](https://minaprotocol.com/blog/zkoracles-rfp-three-teams-chosen) — the three funded teams.
- [RFP: zkOracle Integration For o1js — MinaFoundation/Core-Grants #22](https://github.com/MinaFoundation/Core-Grants/issues/22).
- [Reclaim Protocol Mina Quickstart](https://docs.reclaimprotocol.org/onchain/mina/quickstart).
- [zkIgnite Cohort 3 Funded Projects](https://minaprotocol.com/blog/zkignite-cohort-3-funded-projects) — zkEmail-in-o1js reference.
- [Road to Mesa: Status Update Feb 2026](https://minaprotocol.com/blog/road-to-mesa-feb-2026) — current o1js/protocol context.
