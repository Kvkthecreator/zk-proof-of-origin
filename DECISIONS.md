# Architectural Decisions

Lightweight decision log. Each entry records a choice, the alternatives considered, and why we chose what we chose. Ordered chronologically.

---

## D-001: MVP scope — Human provenance (Branch A) first

**Date:** 2026-04-17
**Status:** Accepted

**Context:** The project has two branches — Branch A (human-made proof via httpz) and Branch B (AI-generated proof via zkML). Both are valuable, but building both simultaneously risks shipping neither.

**Decision:** Ship Branch A (human provenance) first. Branch B becomes Phase 2.

**Rationale:**
- httpz is more mature on Mina than zkML. The httpz primitive has working examples and documentation.
- zkML on Mina (ONNX model verification inside o1js circuits) is still early — circuit sizes for meaningful models are large, tooling is evolving.
- A working "I made this, here's cryptographic proof tied to my identity" demo is shippable faster and more compelling for grant reviewers.
- Branch A alone solves a real creator problem (proving human authorship). Branch B adds transparency for AI content but isn't required for initial value.
- Grant applications are stronger with a working demo than a theoretical dual-branch pitch.

**Consequences:** Phase 1 delivers human provenance only. Phase 2 adds AI branch once zkML tooling stabilizes. The zkProgram architecture must be designed to accommodate both branches (recursive composition) even though only one is implemented initially.

---

## D-002: Monorepo with packages/

**Date:** 2026-04-17
**Status:** Accepted

**Context:** The project has two distinct concerns — zk circuits (o1js/TypeScript) and a browser UI (React). These could live in one repo or two.

**Decision:** Single monorepo with `packages/circuits` and `packages/web`.

**Rationale:**
- One repo is easier for grant reviewers to clone, build, and evaluate.
- Circuits and web share TypeScript types (proof inputs, verification results). Co-location makes type sharing trivial.
- npm workspaces handle dependency management cleanly.
- The project is small enough that repo splitting would be premature organizational overhead.
- Can always split later if the project grows significantly.

**Consequences:** Root `package.json` uses npm workspaces. Shared types live in `packages/circuits/src/types.ts` and are imported by `packages/web`.

---

## D-003: Client-side proving first, optional proving service later

**Date:** 2026-04-17
**Status:** Accepted

**Context:** o1js proof generation is computationally intensive. Recursive proofs in-browser can take 30-120 seconds depending on circuit complexity and device. A server-side proving service would be faster but introduces a backend (contradicting the "no backend" principle).

**Decision:** MVP ships with client-side-only proof generation. Architecture accommodates an optional proving API without requiring one.

**Rationale:**
- Client-side proving honors the zero-trust, no-backend principle — the user's content never leaves their browser.
- 30-120s is acceptable for a "generate once, verify forever" flow. Creators aren't generating proofs every minute.
- A proving service introduces trust assumptions (the service sees your content), infrastructure costs, and operational complexity.
- The proof generation interface will be abstracted behind a `ProofProvider` boundary so a remote prover can be swapped in later without touching circuit or UI logic.

**Consequences:** Initial UX includes a progress indicator during proof generation. If user testing shows the wait is a dealbreaker, Phase 2+ can add an optional proving service. The `ProofProvider` abstraction is designed from day one.

---

## D-004: o1js as sole framework (no circom, no noir)

**Date:** 2026-04-17
**Status:** Accepted

**Context:** Multiple zk frameworks exist (circom/snarkjs, noir, o1js). Mina's native framework is o1js.

**Decision:** Use o1js exclusively.

**Rationale:**
- o1js is Mina-native — proofs generated with o1js can be verified on-chain by Mina validators without bridges or adapters.
- httpz (web proofs) is built on o1js. Using another framework would require proof composition across systems.
- zkML libraries for Mina target o1js.
- The project's value prop is "built on Mina's native primitives." Using non-native frameworks undermines that claim.
- o1js TypeScript-first approach matches the web package (React/Vite/TS).

**Consequences:** All circuit development uses o1js APIs. No circom or R1CS toolchain. Testing uses o1js's built-in proof simulation.

---

## D-005: Reclaim Protocol as the Phase 1 credential provider ("httpz" realization)

**Date:** 2026-04-17
**Status:** Accepted

**Context:** [D-001](#d-001-mvp-scope--human-provenance-branch-a-first) assumed "httpz" was an importable primitive. Research ([docs/analysis/httpz-reality-check.md](docs/analysis/httpz-reality-check.md)) showed httpz is Mina Foundation's brand for their zkOracle vision, not an npm package. The actual Mina-funded primitives are the three zkOracle integrations (Reclaim, zkPass, ZKON) from Core Grants RFP #22.

**Decision:** Use Reclaim Protocol as the Phase 1 credential provider. Vendor the Mina integration code from [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration). Compose the Reclaim claim as witness data (not a recursive sub-proof) inside our OriginProof ZkProgram. Frame the grant proposal as "realizing the httpz vision via the Mina-funded Reclaim stack."

**Rationale:**
- Production-ready in April 2026 with broad provider coverage (250+ HTTPS sources including GitHub, Twitter/X, employment, education).
- Directly aligned with Mina Foundation's own funding signals — Reclaim is one of three teams funded specifically to enable applications like ours.
- Composition pattern is simpler than recursive sub-proofs (ECDSA signature verification in-circuit, see [docs/analysis/composition-pattern.md](docs/analysis/composition-pattern.md)).
- zkPass and ZKON remain viable fallbacks. zkEmail-in-o1js (zkIgnite Cohort 3) is the future pure-Mina upgrade path.

**Consequences:**
- Must disclose the Reclaim attestor trust model honestly in the grant proposal and UI (see [docs/analysis/grant-narrative-impact.md](docs/analysis/grant-narrative-impact.md)).
- Vendor — don't depend on — the Mina integration code (not published on npm). Pin to a specific commit and document it.
- The OriginProof ZkProgram takes `{ claimInfo, signedClaim }` as a private witness in the `proveHuman` method; calls `verifyProof` in-circuit.
- Grant proposal wording must be updated — remove bare "httpz" references, add trust-model disclosure.

---

## D-006: Build attestor verification ourselves; don't vendor Reclaim upstream

**Date:** 2026-04-17
**Status:** Accepted. Supersedes the "vendor upstream code" aspect of [D-005](#d-005-reclaim-protocol-as-the-phase-1-credential-provider-httpz-realization).

**Context:** Audit of [reclaimprotocol/mina-sdk-onchain-integration@bd758a9](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/commit/bd758a92f2f43497da7b6cd63f0531e694aee5b2) revealed the upstream is a scaffold, not a working attestor-signature verifier. See [docs/analysis/reclaim-upstream-audit.md](docs/analysis/reclaim-upstream-audit.md). Key findings:
- No ECDSA signature verification in-circuit.
- `Struct({ provider: String })` uses non-provable types; upstream tests run with `proofsEnabled = false` and never compile the circuit.
- Merkle witness check is a stub.
- Last commit 2026-01-28.

**Decision:** Do not vendor Reclaim upstream into our circuit. Build our own attestor-signature verification ZkProgram method using o1js's native `Ecdsa` + `ForeignField` primitives. Use `@reclaimprotocol/js-sdk` (the browser-side SDK) off-circuit only — for the user-facing QR/login flow and to fetch the attestor's signed claim. Our ZkProgram takes `(signature, pubKey, claimDigest, contentHash)` as witness, verifies ECDSA-secp256k1 in-circuit, and commits the attestor pubkey + content hash as public input.

**Rationale:**
- Vendoring broken code and calling it "integration" would be dishonest and fragile.
- The gap itself is a strong grant narrative: we build the primitive Mina Foundation's RFP exists to enable.
- o1js has first-class ECDSA-over-foreign-curves support; we don't need external libraries.
- Results in a contribution other Mina projects can build on (upstreaming candidate).

**Consequences:**
- Phase 1 implementation time grows by ~3–5 days vs the vendoring path.
- We need to write + test an ECDSA verification gadget in-circuit. Proving time may be substantial (foreign-field ops are expensive); budget accordingly.
- Grant proposal can honestly claim "first working Reclaim-compatible attestor verifier for Mina." Cite the upstream audit as evidence of the gap.
- Post-grant action item: open a PR upstream to contribute the verifier back.

---

## D-007: The primitive we build is an in-circuit ECDSA-secp256k1 attestor verifier

**Date:** 2026-04-17
**Status:** Accepted. Decision delegated to Claude by user with the instruction: "the most axiomatic, primitive approach possible."

**Context:** After the upstream audit ([D-006](#d-006-build-attestor-verification-ourselves-dont-vendor-reclaim-upstream)), three paths were viable: pure-Mina fallback (wallet sig + zkEmail), narrow hand-tuned circuit per HTTPS source, or general ECDSA attestor verifier. Full reasoning in [docs/analysis/pivot-decision.md](docs/analysis/pivot-decision.md).

**Decision:** Build the general ECDSA-secp256k1 attestor verifier as `OriginProof.proveHumanWithAttestor`. Use o1js native `Ecdsa`, `createForeignCurve`, and `Keccak.ethereum`. Consume `@reclaimprotocol/js-sdk` off-circuit in the browser only, to fetch the attestor's signed claim for feeding into our ZkProgram. Keep the existing wallet-only `proveHuman` as a simpler fallback path.

**Rationale:** Matches the project's axiomatic-primitive thesis. Produces a reusable contribution rather than a special case. Directly addresses the gap Mina Foundation's zkOracle RFP was funded to close. The two alternative paths each compromise the primitive principle — one by dropping HTTPS identity, the other by specializing to a single source.

**Consequences:**
- Phase 1 adds ~3–5 days for the ECDSA implementation and its spike.
- Browser proving may exceed the 30–120s budget from [D-003](#d-003-client-side-proving-first-optional-proving-service-later). Measure, then decide whether to narrow the demo or relax the budget.
- Public output of the proof includes an `attestorCommitment` (Poseidon hash of the attestor's secp256k1 pubkey), so verifiers can check "this proof was validated by attestor X" without revealing which claim was signed.
- Opens a clean post-grant path: upstream the verifier to [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) as a PR.