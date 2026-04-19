# zk-proof-of-origin

**Cryptographic proof of content origin on Mina Protocol.** One zkProgram, one proof that binds a content hash to its origin — a verified human credential today, an AI model inference tomorrow. No server, no platform trust, no content exfiltration. Verify in under a second, in any browser.

Built on Mina's native primitives: recursive zk-SNARKs in [o1js](https://github.com/o1-labs/o1js), in-circuit ECDSA-secp256k1 via `createForeignCurve`, and native `Keccak.ethereum`. **18/18 tests passing.**

## The missing primitive

Mina Foundation has a public vision they call *httpz* — "the internet you can trust" via cryptographically verifiable HTTPS data. The concrete work toward that vision is [Core Grants RFP #22](https://github.com/MinaFoundation/Core-Grants/issues/22), which funded three zkOracle teams (Reclaim, zkPass, ZKON) to bridge HTTPS attestations onto Mina. We audited [Reclaim's Mina integration](https://github.com/reclaimprotocol/mina-sdk-onchain-integration) and found it's a scaffold: **ECDSA signature verification is absent, circuit compilation never runs in its own tests, and `Struct({provider: String})` would fail to compile as a circuit.** See [docs/analysis/reclaim-upstream-audit.md](docs/analysis/reclaim-upstream-audit.md).

We built the missing primitive. `OriginProof.proveHumanWithReclaimAttestor` takes a Reclaim-shaped claim, recovers the attestor's secp256k1 public key off-circuit, verifies the attestor's ECDSA signature over the keccak claim digest **in-circuit**, and computes `keccak256(attestorPubKey)[12:]` **in-circuit** to derive the attestor's 20-byte Ethereum address, which is bound to the proof's public input. Plus a Mina wallet signature over the content hash for user ownership.

This is the axiomatic primitive any Mina application wanting to consume Reclaim/zkPass/ZKON claims needs. It didn't exist before this project. We intend to upstream it as a PR post-grant.

## At a glance

| Piece | What it is | Where |
|---|---|---|
| `OriginProof` ZkProgram | 3 proof methods: wallet-only, wallet+attestor (Poseidon-committed), wallet+Reclaim-attestor (Ethereum-address-bound) | [`packages/circuits/src/OriginProof.ts`](packages/circuits/src/OriginProof.ts) |
| ECDSA + keccak primitives | Secp256k1, EcdsaSecp256k1, AttestorDigest, in-circuit keccak-of-pubkey | [`packages/circuits/src/ecdsa.ts`](packages/circuits/src/ecdsa.ts) |
| Off-circuit Reclaim helpers | keccak digest, 65-byte sig parser, pure-JS ecrecover, prover-bundle builder | [`packages/circuits/src/reclaimClaim.ts`](packages/circuits/src/reclaimClaim.ts) |
| `ProofCommitmentRegistry` zkApp | Verifies an OriginProof on-chain, anchors a Poseidon digest + counter | [`packages/circuits/src/ProofCommitmentRegistry.ts`](packages/circuits/src/ProofCommitmentRegistry.ts) |
| Browser UI | Two modes (wallet-only and paste-a-Reclaim-claim), in-browser proving, shareable-URL verification | [`packages/web/`](packages/web/) |
| Demo fixture | A Reclaim-shaped claim signed by a committed demo key | [`packages/circuits/fixtures/demo-reclaim-claim.json`](packages/circuits/fixtures/demo-reclaim-claim.json) |

## Measured performance

Node, M-series Mac. Browser proving is typically 2–4× slower.

| Operation | Time |
|---|---|
| Compile `OriginProof` | ~61s (one-time per cold cache) |
| Prove (wallet-only mode) | ~5–7s |
| Prove (ECDSA attestor, Poseidon-committed) | ~17s |
| Prove (Reclaim mode, keccak-of-pubkey → Ethereum address) | ~18s |
| Verify any mode | <1s |
| `anchor()` on-chain via `ProofCommitmentRegistry` | ~9.4s |

## Repo map

```
packages/
  circuits/              o1js package — all ZK + zkApp code
    src/                 library source (ContentHash, OriginProof, ecdsa, reclaimClaim,
                         ProofCommitmentRegistry, spikes/)
    fixtures/            committed demo Reclaim claim
    deploy/              Mina devnet deploy script + README
  web/                   React + Vite + Tailwind-free CSS UI
    src/components/      CreatorTab, VerifierTab, ModeSelector
    src/prover.ts, reclaimProver.ts, proofEncoding.ts
docs/
  architecture.md        system design
  grant-proposal.md      submission-ready grant proposal
  analysis/              research notes — httpz reality check, Reclaim audit,
                         ECDSA spike results, pivot decision, grant framing
DECISIONS.md             decision log (D-001 through D-007)
content/
  demo-script.md         60–90s demo video script
```

## Getting started

Requires Node.js ≥ 18.

```bash
# from repo root
npm install

# run the full test suite (circuits + zkApp, ~5 min cold)
cd packages/circuits && npm test

# start the web app with in-browser proving
cd packages/web && npm run dev
# open http://localhost:5173
```

The web app ships with a "Load demo claim" button that lets you generate a full Reclaim-mode proof in the browser without any external setup.

## Grant targeting

Targeting [Mina Builders Grants Program](https://minaprotocol.com/grants) and [zkIgnite Cohort 3](https://minaprotocol.com/zkignite). See [docs/grant-proposal.md](docs/grant-proposal.md) for the submission-ready proposal.

**Ask:** $11,000 for Milestones 3–5 (live Reclaim SDK wire-up, testnet zkApp deployment, demo + submission). **Post-grant continuation:** $34,000 for Milestones 6–9 (contribute primitive upstream, zkEmail integration, AI branch via zkML, mainnet + distribution).

## License

MIT. See [LICENSE](LICENSE) if present; otherwise MIT terms per [package.json](package.json).
