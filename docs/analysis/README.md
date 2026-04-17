# Analysis

Deep-research notes and technical assessments that inform architectural decisions. These documents are working artifacts — snapshots of what we knew at a point in time. Do not treat as normative specs. When findings here drive a decision, record that decision in [`../../DECISIONS.md`](../../DECISIONS.md) and cite the analysis doc.

## Index

- [httpz-reality-check.md](httpz-reality-check.md) — What "httpz" actually is in April 2026 and why the credential-layer primitive is Reclaim Protocol, not an `httpz` npm package.
- [credential-provider-options.md](credential-provider-options.md) — Comparison of Reclaim, zkPass, ZKON, zkEmail, and wallet-signature fallback as the Phase 1 credential source.
- [composition-pattern.md](composition-pattern.md) — How a Reclaim-style proof composes with our OriginProof ZkProgram (witness vs recursive sub-proof).
- [reclaim-upstream-audit.md](reclaim-upstream-audit.md) — Source-level audit of Reclaim's Mina integration. Key finding: ECDSA verification is absent; upstream tests bypass circuit compilation. Drives D-006.
- [pivot-decision.md](pivot-decision.md) — Why we build the ECDSA-secp256k1 attestor verifier ourselves, chosen on the user's behalf per his axiomatic-primitive principle. Drives D-007.
- [ecdsa-spike-results.md](ecdsa-spike-results.md) — Empirical results from the standalone ECDSA spike: compile 29.8s, prove 12.9s, verify 0.45s. De-risks D-007.
- [grant-narrative-impact.md](grant-narrative-impact.md) — How the httpz→Reclaim reality shifts the "only possible on Mina" pitch and what to write instead.
