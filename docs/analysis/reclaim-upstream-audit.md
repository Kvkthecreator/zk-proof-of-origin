# Reclaim Upstream Audit

**Status:** Research finding. Supersedes naive assumptions in [httpz-reality-check.md](httpz-reality-check.md) and [credential-provider-options.md](credential-provider-options.md). Drives [DECISIONS.md D-006](../../DECISIONS.md).
**Date:** 2026-04-17
**Upstream reviewed:** [reclaimprotocol/mina-sdk-onchain-integration@bd758a9](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/commit/bd758a92f2f43497da7b6cd63f0531e694aee5b2) (last commit 2026-01-28)

## TL;DR

The upstream Reclaim Mina integration is **a scaffold, not a working attestor-signature verifier.** ECDSA signature verification is entirely absent from the circuit. Tests run with `proofsEnabled = false`, so the code's circuit-compile correctness has never been exercised by its own test suite. Dropping it into our project as a dependency would give us *less* than we need for the grant pitch, not more.

This is a strategic finding, not a blocker — it tells us exactly what we need to build, and the gap itself becomes a compelling grant narrative.

## What the upstream actually does

Looking at [Reclaim.ts](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/blob/main/src/Reclaim.ts), `verifyProof` performs:

1. ✅ Serializes `{provider, parameters, context}`, Keccak-hashes it, compares to `identifier` field. This is genuine claim-info binding.
2. ❌ **Signature verification: NONE.** The `signatures: [String]` field is never passed to any cryptographic primitive. It's structurally present but never validated.
3. ❌ **Witness set check: stub.** The loop `for (let i = 0; i < signedWitnesses.length; i++) { witnessProof.assertEquals(witnessesRoot) }` asserts `witnessesRoot === witnessesRoot` — a tautology. No actual Merkle path verification.
4. ✅ Deterministic witness selection via Poseidon-derived indices. Real logic, but only useful once the Merkle check is implemented.
5. ✅ Duplicate-signer detection. Real, but cheap given how few signers there are.

## Structural problems for our use case

1. **`SmartContract`, not `ZkProgram`.** `@method` on a SmartContract only runs as an on-chain account update. It cannot be composed as a sub-proof inside our own `OriginProof` ZkProgram. To use it, we'd either (a) deploy Reclaim's contract on testnet and have our UI call it as a second transaction after our `OriginProof` proves, or (b) port the verification logic into a ZkProgram method ourselves.

2. **`Struct({ provider: String, ... })`** ([Reclaim.ts:19-23](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/blob/main/src/Reclaim.ts#L19-L23)). `String` is not a provable type in o1js. `Struct` expects provable types. The upstream's test suite sets `proofsEnabled = false`, so their `describe('verifyProof')` never actually compiles the circuit — the String-typed Struct would throw during constraint system generation. This is a latent bug; it's also an indicator that the upstream has not been exercised as a real zk-proof pipeline.

3. **No ECDSA over secp256k1.** Reclaim attestors sign with Ethereum-style secp256k1 + keccak. o1js has `ForeignField` and `createForeignCurve` / `Ecdsa` primitives for exactly this — but the upstream doesn't use them. A real integration means calling `Ecdsa.verify` inside our circuit against a foreign-field pubkey derived from the witness address.

4. **Last commit 2026-01-28** (~3 months before this analysis). Not abandoned, but not actively shipping either.

## What this means for the grant

**Bad news:** we cannot "just use Reclaim" and declare victory. The upstream is not a production dependency.

**Good news (bigger than the bad):** *this gap is exactly the kind of work Mina Foundation pays for.* A working attestor-signature-verifying ZkProgram on Mina — with real ECDSA-secp256k1 verification in-circuit — is a contribution that fits directly under the zkOracle RFP theme. It's:

- A concrete improvement to a Mina Foundation-funded integration.
- The specific primitive that every "HTTPS credential on Mina" project needs.
- A publishable, citable piece of work that future projects can depend on.

This reframes zk-proof-of-origin from "consumer of Reclaim" to "the project that made Reclaim on Mina actually work." Stronger grant pitch, not weaker.

## Path forward

### Short path (Phase 1 demo-viable)
1. **Own the attestor verification.** Build a ZkProgram method `proveHumanWithAttestor` that takes:
   - `(signature: EcdsaSignature, pubKey: EcdsaPubKey, claimDigest: Field[], contentHash: Field)`
   - Verifies `ECDSA.verify(signature, pubKey, keccak(claimInfo))` in-circuit using o1js's `Ecdsa` + `ForeignField`.
   - Binds `contentHash` + a Poseidon commitment of the attestor pubKey as public input.

2. **Consume the Reclaim SDK off-circuit.** Use `@reclaimprotocol/js-sdk` in the browser only for the user flow (QR, login, claim fetch). Take the attestor's pubkey and claim from the SDK response, feed them into our ZkProgram as witness data. We don't vendor the broken upstream code at all.

3. **Acknowledge the gap explicitly.** In the grant proposal and README, cite the upstream's current state and explain our contribution.

### Longer path (post-grant, Phase 2+)
- Contribute the ECDSA-verifying ZkProgram back to Reclaim's upstream repo. Public goods. Looks great in retrospectives.

## Updated recommendation

Skip vendoring. Build our own attestor-verification ZkProgram method directly. It's a bigger chunk of work (~3–5 days instead of 1) but the result is something real, demoable, and cite-worthy for the grant.

Captured as [D-006](../../DECISIONS.md).

## Sources
- [reclaimprotocol/mina-sdk-onchain-integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) — source under review.
- [Reclaim.ts](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/blob/main/src/Reclaim.ts) — contract under review.
- [Reclaim.test.ts](https://github.com/reclaimprotocol/mina-sdk-onchain-integration/blob/main/src/Reclaim.test.ts) — tests run with `proofsEnabled = false`.
- o1js docs: [ECDSA + ForeignField](https://docs.minaprotocol.com/zkapps/o1js-reference/classes/Ecdsa) — the primitives we'll use.
