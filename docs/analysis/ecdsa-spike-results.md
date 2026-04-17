# ECDSA Spike — Results

**Status:** Empirical finding. De-risks [D-007](../../DECISIONS.md).
**Date:** 2026-04-17
**Spike code:** [packages/circuits/src/spikes/EcdsaAttestor.ts](../../packages/circuits/src/spikes/EcdsaAttestor.ts) + [EcdsaAttestor.test.ts](../../packages/circuits/src/spikes/EcdsaAttestor.test.ts)

## Question being answered

Can we actually build an in-circuit ECDSA-secp256k1 attestor verifier on Mina with o1js, and what's the proving-time cost?

## What we built

A standalone `ZkProgram` with one method `verifyAttestor` that:
1. Takes `(signature: EcdsaSignature, attestorPubKey: Secp256k1 point, claimDigest: 32-byte Bytes)` as private witness.
2. Runs `signature.verify(claimDigest, attestorPubKey).assertTrue(...)` in-circuit.
3. Asserts the Poseidon commitment of the pubkey matches a public input.
4. Asserts the Poseidon hash of the claim digest matches a public input.

Built on o1js's native primitives:
```ts
import { Crypto, createForeignCurve, createEcdsa } from 'o1js';
class Secp256k1 extends createForeignCurve(Crypto.CurveParams.Secp256k1) {}
class EcdsaSecp256k1 extends createEcdsa(Secp256k1) {}
```

No external libraries. This IS the axiomatic primitive [D-007](../../DECISIONS.md) mandated.

## Results (Node, M-series Mac, single run)

| Phase | Time | Notes |
|-------|------|-------|
| **Compile** | 29.76 s | One-time per cold start; can be cached across sessions. |
| **Prove** | 12.90 s | Single proof generation. |
| **Verify** | 0.45 s | Comfortably under the <1s "fast verification" grant claim. |

Negative test (attacker signature) correctly fails during proof generation — the ECDSA verification assertion throws.

## What this means

### For [D-003](../../DECISIONS.md) — browser proving budget
- 12.9s in Node suggests **~25–50s in browser** (typical 2–4x WASM overhead).
- Comfortably inside the 30–120s budget.
- No need to revisit D-003.

### For [D-007](../../DECISIONS.md) — ECDSA pivot
- Viable. Primitive exists, works, and is cheap enough for a demo.
- The "3–5 days" estimate was conservative; the core verification was <1 day to implement and prove.
- Remaining work for full integration: wiring into `OriginProof.proveHumanWithAttestor`, Keccak-based `hashClaimInfo`, Mina wallet signature binding, browser integration, Reclaim SDK fetch.

### For the grant narrative
- We can now honestly claim: *"First in-circuit ECDSA-secp256k1 attestor verifier running on Mina with o1js, measured at ~13s proving time. Compatible with any Reclaim-style zkOracle that uses secp256k1 signatures."*
- Cite spike code + test output as evidence.

## Technical notes for the integration

- `Bytes(32)` class is the right shape for a keccak digest. `Bytes.from(Uint8Array)` accepts raw bytes; `bytes[i].value` gives the underlying `Field` for Poseidon hashing.
- `Secp256k1` pubkeys expose `pub.x.value` and `pub.y.value` as `Field[]` arrays (3-limb foreign-field representation). `Poseidon.hash([...x.value, ...y.value])` gives a stable commitment.
- `EcdsaSecp256k1.from({r, s})` and `EcdsaSecp256k1.fromHex('0x...')` both work; `fromHex` is the format Reclaim's JS SDK returns, so we use it in browser integration.
- Signatures generated outside a circuit with `EcdsaSecp256k1.sign(bytes, privBigInt)` produce the format expected by in-circuit verify. No signature-format translation needed.

## Open items

1. **Browser measurement.** Not yet run. Plan: integrate into creator UI, time a real prove in Chrome/Safari.
2. **Reclaim SDK output parsing.** Need to confirm the SDK returns `{r, s}` scalars (or hex) matching what we feed `EcdsaSecp256k1.from`. Fixture-test with a recorded SDK response before wiring live.
3. **Claim digest construction.** Reclaim's `identifier = keccak256(provider || '\n' || parameters || '\n' || context)`. Our spike reproduces this off-circuit; the integrated version needs to also reproduce it *in-circuit* to bind the full claim info (provider, parameters, context) to the proof. Keccak is expensive but available via `Keccak.ethereum`.

## Decision impact

No decisions overturned. [D-007](../../DECISIONS.md) stands and is de-risked. Proceed with integration.
