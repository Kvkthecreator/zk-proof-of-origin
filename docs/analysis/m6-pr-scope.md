# M6 — Upstream PR Scope

**Status:** Pre-work planning. Before touching a fork.
**Target repo:** [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration)
**Upstream HEAD reviewed:** `bd758a9` (2026-01-28, 3 months stale as of session)

## Goal

Contribute our in-circuit ECDSA-secp256k1 attestor-signature verifier as the missing primitive in Reclaim's Mina integration. Do this in a way that:

1. Produces a **working circuit-compiled verifier** — the upstream scaffold declares `Struct({ provider: String })` which prevents circuit compilation, so the upstream's own tests run with `proofsEnabled = false` and never exercise the zk path.
2. **Extends rather than rewrites.** The upstream has real engineering effort in the witness-selection / Merkle-root scaffolding. We replace what's broken (signature verification, non-provable struct fields) and keep what's structural (the public API shape, the `Reclaim`/`Proof`/`ClaimInfo` class names).
3. **Stays collaborative in tone.** The PR description frames this as "adds in-circuit ECDSA verification to complete the integration," not "fixes broken code." Our audit doc in our own repo is separate engineering documentation; the upstream PR does not link to it.

## What the upstream has (keep)

- `Reclaim` SmartContract class with `@method addNewEpoch` (owner-gated witness root rotation). Solid; leave alone.
- `Proof` / `ClaimInfo` / `Claim` / `SignedClaim` class names and public shape. Consumers of the SDK use these names.
- `hashClaimInfo(provider, parameters, context)` off-chain helper — computes keccak256 of the canonical `provider\nparameters\ncontext` serialization. This is right; we reuse the algorithm.
- `getExpectedWitnesses` / `circuitSwitch` / `hexStringToFields` utility methods. Not all needed for our change but not worth removing.
- Test data format (Steam-provider claim with a real attestor signature).

## What's broken (fix)

1. **`ClaimInfo` declares `provider: String`, `parameters: String`, `context: String`.** `String` is not a provable type — `Struct` requires provable types. This is why upstream tests use `proofsEnabled = false`.
   - **Fix:** change to provable types. Options:
     - `Bytes(N)` where N is a ceiling on the string size — clean, provable, constrained.
     - Pass as an off-circuit argument used only for the keccak digest computation, with the digest (already 32 bytes) as the in-circuit input.
   - **Decision:** use the second approach. The circuit consumes `claimDigest: Bytes(32)` directly. The strings are off-circuit inputs to `hashClaimInfo` only. Matches how real Reclaim claims arrive (the SDK returns strings, we keccak them once off-chain, the proof binds the digest).

2. **`signatures: [String]` in `SignedClaim` — same problem.** And nothing in `verifyProof` ever passes this signature to a cryptographic primitive.
   - **Fix:** introduce `EcdsaSecp256k1` (our existing import from `o1js`) as the provable signature type. Keep the `signatures` field in the public API for backward compat, but accept a parallel `ecdsaSignatures: EcdsaSecp256k1[]` for the actual in-circuit verification path.

3. **Witness-set Merkle check is a tautology:** `witnessProof.assertEquals(witnessesRoot)` where `witnessProof = witnessesRoot`.
   - **Fix:** out of scope for this PR. Real Merkle proof input is a meaningful change that deserves its own focused PR. We explicitly call this out in our PR description as "Merkle witness verification left intact pending a separate PR." Keeping scope tight.

4. **`verifyProof` never calls `signature.verify(digest, pubKey)`.**
   - **Fix:** add the call. Pass the attestor pubkey as a witness (`Secp256k1` point), compute `keccak256(pubKey_xy_bytes)[12:]` in-circuit to derive the Ethereum address, assert it matches the witness address declared in the claim. This is exactly what our `proveHumanWithReclaimAttestor` does.

## What changes in files

Single-file scope if possible: `src/Reclaim.ts`. Possibly:
- Minor test additions in `src/Reclaim.test.ts` — one new test with `proofsEnabled = true` that exercises the full ECDSA path. Leave all existing `proofsEnabled = false` tests untouched.
- New file `src/ecdsa.ts` (or inline) with the `Secp256k1` / `EcdsaSecp256k1` / helper class exports, mirroring our own `packages/circuits/src/ecdsa.ts`.

## What stays out of the PR (even if we fixed it in our repo)

- The Poseidon commitment of the attestor pubkey. Upstream uses Ethereum addresses (20-byte keccak-truncated), which is the canonical Reclaim convention. Our own `proveHumanWithAttestor` method (Poseidon-over-pubkey) is our specific design choice — not a Reclaim primitive. Do not upstream it.
- Our `OriginPublicInput` structure. That's our zkApp's shape; Reclaim's consumers don't want it.
- Our `ProofCommitmentRegistry`. Same reason.
- The `keccakOutputToScalar` / `verifySignedHash` vs `verify` nuance — we use `verifySignedHash` because Reclaim signs the digest directly (not the pre-image). Document this in a code comment; it's a correctness subtlety anyone re-implementing needs to know.

## Test strategy

Upstream runs tests with `proofsEnabled = false` — fast but doesn't exercise the circuit. Our addition:

- One new `describe` block: `verifyProof (real circuit)`
- `beforeAll`: `await Reclaim.compile()` (honest, slow — add appropriate `vi.setConfig({ testTimeout: 600_000 })` or similar)
- Test: generate a real attestor key, sign a test claim, pass the full pubkey + signature + digest to `verifyProof`, assert the zkApp tx proves and submits successfully.

Aiming to have the new test complete in under 90s locally.

## PR description (draft)

```markdown
## Summary

Adds in-circuit ECDSA-secp256k1 verification to `verifyProof()` so the
Reclaim Mina integration produces a real zero-knowledge proof of
attestor signature validity — completing the integration the Mina
Foundation zkOracle RFP funded.

## Changes

- **ECDSA verification**: `verifyProof()` now calls
  `signature.verifySignedHash(claimDigest, attestorPubKey)` using
  o1js's native `createEcdsa(Secp256k1)`. The attestor's public key
  is passed as a witness; its derived Ethereum address
  (`keccak256(pubKey)[12:]`) is computed in-circuit and matched
  against the claim's declared witness address.
- **Provable Struct fields**: `ClaimInfo` string fields move out of
  the provable struct. `verifyProof` now consumes the 32-byte
  keccak claim digest directly, which matches how real Reclaim
  claims arrive (SDK returns strings, consumer keccaks them once,
  proof binds the digest).
- **New test with `proofsEnabled = true`** exercising the full
  circuit-compiled ECDSA path against a synthesized claim.

## What this does not change

- The `Reclaim` / `Proof` / `ClaimInfo` / `SignedClaim` public class
  shape — existing consumers don't need code changes beyond adopting
  the new verify-time arguments.
- `addNewEpoch` and owner-gated witness root rotation — unchanged.
- The Merkle witness verification path — unchanged, pending a
  separate focused PR.

## Testing

- `npm test` — existing suite still passes (no `proofsEnabled` change).
- New `verifyProof (real circuit)` test compiles the contract and
  proves a full ECDSA-signed claim verification. Completes in ~90s
  locally.

## Context

This PR is submitted as Milestone 6 of the [zk-proof-of-origin](https://github.com/Kvkthecreator/zk-proof-of-origin)
project — a creator-provenance zkApp built on this Reclaim Mina
integration. Happy to iterate on any of the structural choices.
```

## Risks and mitigations

- **Changing `ClaimInfo` struct shape is a breaking change** for any existing consumer. Mitigation: keep the old struct exported as `ClaimInfoOffchain` (or similar), provide a migration path in the PR description, ask maintainers for guidance on their versioning preference in the PR itself.
- **o1js version drift.** Upstream `package.json` pins `o1js ^2.1.0`; we target `^2.2.0`. Should be compatible but verify at fork time; if not, bump upstream's pin in the same PR (document why).
- **Maintainer engagement.** Upstream's last commit is 3 months stale. If no response in 2 weeks, we leave the PR open as a shipping signal (grant reviewers still see it) and continue using our own circuit. Not a deliverable failure — it's the "we did the work; upstream's velocity is outside our control" story.

## Out-of-scope in this session

- Actually doing the fork.
- Writing the code.
- Filing the PR.

This doc is the plan. Next step: get user sign-off before touching Reclaim's repo.
