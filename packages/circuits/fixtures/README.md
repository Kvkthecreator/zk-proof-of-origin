# Fixtures

Reproducible test claims used by the web UI "Load demo claim" button and for Node-side circuit tests.

## `demo-reclaim-claim.json`

A Reclaim-shaped claim response signed by a freshly-generated demo secp256k1 key (not the canonical Reclaim attestor at `0x244897572368eadf65bfbc5aec98d8e5443a9072`). The `witnesses[0].id` is the demo attestor's Ethereum address — derived from `keccak256(pubKey)[12:]` — and the proof binds to that address in-circuit.

**Why a demo attestor instead of the canonical one?** Reclaim's canonical attestor only signs claims after a real user completes the QR/login flow against a real HTTPS provider. Capturing such a claim and re-using it as a fixture would expose someone's actual identity. The demo key lets reviewers exercise the full circuit path against a deterministic fixture without anyone signing in. The web app's **live mode** (`VITE_RECLAIM_BACKEND_URL`) hits the real Reclaim attestor network and the resulting `witnesses[0].id` will be the canonical address.

**Demo attestor address:** `0x9750148c76c1cf11014c90b9ba6b4b4fddb87766`
**Canonical Reclaim attestor (live mode):** `0x244897572368eadf65bfbc5aec98d8e5443a9072`

**Provider:** `github`
**Username:** `kvkthecreator`
**Context:** demo — `contextMessage: "demo"`

To regenerate (produces a new attestor key; paste the output into this file and update the address above):

```bash
cd packages/circuits
npx tsx src/generate-fixture.ts
```

For production-grade proofs, use the live Reclaim SDK against their attestor network (see [`packages/web/README.md`](../../web/README.md) for the live-mode setup, pending Milestone 3).
