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