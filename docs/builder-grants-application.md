# Builder Grants Application — Answers

Working log of Q&A as submitted to the Mina Builder Grants Typeform: https://5bi2nn1mxxj.typeform.com/to/rXo2gX1B

Applications are rolling. We fill this in as we go so the final submitted answers are preserved, debuggable if something needs re-submission, and reusable if we apply again (e.g. zkIgnite Cohort 4, a follow-on Builder Grant for zkEmail).

---

## Q11 — Which Mina-specific features or capabilities will your project utilize?

We use four Mina-native primitives, each load-bearing rather than decorative:

1. **Native ECDSA-secp256k1 via `createForeignCurve(Crypto.CurveParams.Secp256k1)` + `createEcdsa()`.** Our `OriginProof` ZkProgram verifies attestor signatures over HTTPS claims *in-circuit*, with no sidecar proving or cross-chain bridge. This is the primitive we built because Mina Foundation's own funded Reclaim integration shipped without it.

2. **In-circuit `Keccak.ethereum` + `UInt8.fromBits` for foreign-field byte derivation.** Our circuit computes `keccak256(attestorPubKey)[12:]` inside the proof to derive the attestor's Ethereum address and bind it to the public input. This is what makes the proof Reclaim-compatible without trusting a pre-validated address off-chain.

3. **o1js `ZkProgram` recursive composition + native Poseidon.** Content hashing, wallet-signature verification, attestor signature, and Ethereum-address derivation all compose into a single succinct proof with one shared public-input shape across three proof modes. Verifiers check one proof type regardless of which credential path was used.

4. **Mina `SmartContract` state + on-chain proof verification.** Our `ProofCommitmentRegistry` zkApp (deployed to devnet at `B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU`) verifies an OriginProof on-chain via `proof.verify()` inside an `@method`, then anchors a compact Poseidon digest as state. Proof inputs stay private; only the commitment hits chain.

The 22KB succinct blockchain and <1s verification aren't listed as features we "use" because they're what lets our verifier UI run anywhere in a browser, which is the whole product surface. Without Mina's succinct verification cost, a creator-provenance proof would need either a trusted intermediary or a chain verification call, breaking the "zero-trust, in-browser" property the product relies on.

---

## Q12 — Why Mina?: Why is Mina the right platform for your project?

Mina is the only chain where creator provenance can be in-browser and zero-server without compromise. Its 22KB succinct verifier means anyone verifies a proof locally in under a second — on any other chain we'd need a bridge, a full node, or a trusted intermediary, which breaks the "no trust required" property.

o1js also ships production-ready foreign-curve ECDSA and native Keccak, which is what lets us verify Reclaim-style HTTPS attestor signatures *entirely in-circuit*. Mina Foundation's own funded Reclaim integration shipped without this primitive. We built it. That's the exact gap RFP #22 exists to close, and it's only buildable on Mina.

---

## Q13 — Intended Users: Who is your project for?

Two primary groups.

**Creators** — writers, journalists, artists, and anyone publishing content who wants to cryptographically mark it as human-made (or AI-generated, in Phase 2). They paste content, generate a proof in ~5 seconds, share a link. No account, no platform lock-in.

**Verifiers** — readers, platforms, and other zkApps that consume proofs to decide whether to badge, rank, or trust content. Verification is local and under a second.

Secondary: **platform integrators** (social apps, NFT marketplaces, news sites) who want to display a "verified human author" signal — our `OriginProofClass` is an exported Mina proof they can consume as a sub-proof.

---

## Q14 — What problem does your project solve, or what impact will it have?

**Problem:** Every method today for proving content authorship — AI detectors like GPTZero, watermarks like C2PA, platform badges like "Made with AI" — asks the viewer to trust the detector, the platform, or both. Content gets leaked to third parties in the process, watermarks get stripped, detectors guess probabilistically and are routinely wrong. There is no way today for a creator to *prove* authorship, or for an AI user to *transparently disclose* generation, without introducing a trust assumption that weakens the claim.

**Impact:** A single, portable, cryptographic proof anyone can verify in under a second — in a browser, offline, without a platform — that binds a content hash to its origin (verified human credential today, zkML-verified model inference in Phase 2). Because the verification is succinct and the proof travels in a URL, any reader, platform, or zkApp can adopt it without integrating infrastructure. The secondary impact is toolchain: we shipped the in-circuit ECDSA-secp256k1 attestor verifier Mina Foundation's own RFP #22 funded Reclaim to build, which we'll upstream as a PR (Milestone 6), making every future Mina project that wants to consume HTTPS-attested claims strictly better off.
