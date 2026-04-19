# Deploying ProofCommitmentRegistry to Mina Devnet

This directory contains the deploy script for the on-chain zkApp.

## One-time setup

1. **Install workspace deps** (from repo root):
   ```bash
   npm install
   ```

2. **Generate a deployer keypair** (or reuse one you have):
   ```bash
   cd packages/circuits
   npx tsx -e "import { PrivateKey } from 'o1js'; const k = PrivateKey.random(); console.log('private:', k.toBase58()); console.log('public :', k.toPublicKey().toBase58());"
   ```
   Save both. The public key is what you'll fund; the private key goes in the env var below.

3. **Fund the deployer** on Mina Devnet:
   - Go to [https://faucet.minaprotocol.com/](https://faucet.minaprotocol.com/)
   - Select **Devnet**
   - Paste the deployer **public** key
   - Click Request. Wait ~5 minutes for the faucet payout to confirm.

4. **Generate a zkApp keypair** the same way (separate from the deployer):
   ```bash
   npx tsx -e "import { PrivateKey } from 'o1js'; const k = PrivateKey.random(); console.log('private:', k.toBase58()); console.log('public :', k.toPublicKey().toBase58());"
   ```
   The public key will be the deployed zkApp's on-chain address. The private key authorizes upgrades.

## Deploy

From `packages/circuits`:

```bash
DEPLOYER_PRIVATE_KEY=EKE...YOUR_DEPLOYER...\
ZKAPP_PRIVATE_KEY=EKE...YOUR_ZKAPP...\
npx tsx deploy/deploy-devnet.ts
```

The script will:

1. Fetch the deployer account from devnet.
2. Compile OriginProof (~60s).
3. Compile ProofCommitmentRegistry (~30s).
4. Build a deploy transaction that funds a new account (the zkApp account) and installs the verification key.
5. Prove the transaction.
6. Send it and print:
   - The zkApp's public address.
   - The tx hash.
   - A [MinaScan](https://minascan.io/devnet) explorer link.
7. Wait for inclusion (2–5 minutes).

## Record the address

After a successful deploy, copy the zkApp address into [`docs/grant-proposal.md`](../../../docs/grant-proposal.md) under the Links section.

## Anchoring proofs

Once deployed, calling `anchor(proof)` from a client with a funded account stores the proof's digest on-chain. A client integration will live in `packages/web` (post-grant Milestone — for the initial submission the local test in [`src/ProofCommitmentRegistry.test.ts`](../src/ProofCommitmentRegistry.test.ts) exercises the full flow against a LocalBlockchain instance).

## Troubleshooting

- **"account not found"** — faucet hasn't paid out yet. Wait longer or re-check on [MinaScan](https://minascan.io/devnet) using the deployer public key.
- **"insufficient funds"** — devnet faucet drops are small; if you already spent a lot of tx fees, request more from the faucet.
- **"verification key mismatch"** — if you redeploy with the same `ZKAPP_PRIVATE_KEY` but a changed `ProofCommitmentRegistry.ts`, you'll need to call `update` instead of `deploy`. For this MVP, just generate a fresh zkApp keypair and redeploy.
- **WASM / memory errors at compile** — ensure Node ≥ 18 and at least 4GB free RAM. On macOS, `NODE_OPTIONS=--max-old-space-size=8192` sometimes helps.
