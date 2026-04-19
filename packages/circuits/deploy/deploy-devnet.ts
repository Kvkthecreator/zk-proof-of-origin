#!/usr/bin/env node
/**
 * Deploy ProofCommitmentRegistry to Mina Devnet.
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY  Base58-encoded Mina private key with devnet MINA
 *                         (get from https://faucet.minaprotocol.com/)
 *   ZKAPP_PRIVATE_KEY     Base58-encoded private key to own the zkApp
 *                         (generate one with `PrivateKey.random()` if absent)
 *
 * Optional:
 *   MINA_GRAPHQL_URL      Default: https://api.minascan.io/node/devnet/v1/graphql
 *   TX_FEE_MINA           Default: 0.1
 *
 * Run:
 *   cd packages/circuits
 *   DEPLOYER_PRIVATE_KEY=EKE... ZKAPP_PRIVATE_KEY=EKE... \
 *     npx tsx deploy/deploy-devnet.ts
 *
 * Prints: the deployed zkApp public address + transaction hash.
 */
import {
  AccountUpdate,
  Mina,
  NetworkId,
  PrivateKey,
  fetchAccount,
} from 'o1js';
import { OriginProof } from '../src/OriginProof.js';
import { ProofCommitmentRegistry } from '../src/ProofCommitmentRegistry.js';

const GRAPHQL_URL =
  process.env.MINA_GRAPHQL_URL ??
  'https://api.minascan.io/node/devnet/v1/graphql';
const TX_FEE = BigInt(
  Math.floor(parseFloat(process.env.TX_FEE_MINA ?? '0.1') * 1e9)
);

function readBase58Key(envVar: string): PrivateKey {
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(
      `Environment variable ${envVar} is not set. See the script header for setup.`
    );
  }
  try {
    return PrivateKey.fromBase58(raw.trim());
  } catch (e) {
    throw new Error(
      `Could not parse ${envVar} as a base58 Mina private key: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

async function main() {
  const network = Mina.Network({
    networkId: 'testnet' as NetworkId,
    mina: GRAPHQL_URL,
  });
  Mina.setActiveInstance(network);

  const deployerKey = readBase58Key('DEPLOYER_PRIVATE_KEY');
  const deployerAddr = deployerKey.toPublicKey();

  let zkAppKey: PrivateKey;
  if (process.env.ZKAPP_PRIVATE_KEY) {
    zkAppKey = readBase58Key('ZKAPP_PRIVATE_KEY');
  } else {
    zkAppKey = PrivateKey.random();
    // eslint-disable-next-line no-console
    console.log(
      '[deploy] no ZKAPP_PRIVATE_KEY provided — generated a fresh one:'
    );
    // eslint-disable-next-line no-console
    console.log('[deploy]   ' + zkAppKey.toBase58());
    // eslint-disable-next-line no-console
    console.log('[deploy] save this before rerunning; it owns the deployed contract.');
  }
  const zkAppAddr = zkAppKey.toPublicKey();

  // eslint-disable-next-line no-console
  console.log('[deploy] fetching deployer account...');
  await fetchAccount({ publicKey: deployerAddr });

  // eslint-disable-next-line no-console
  console.log('[deploy] compiling OriginProof (this takes ~60s)...');
  await OriginProof.compile();

  // eslint-disable-next-line no-console
  console.log('[deploy] compiling ProofCommitmentRegistry...');
  const { verificationKey } = await ProofCommitmentRegistry.compile();

  // eslint-disable-next-line no-console
  console.log('[deploy] building deploy transaction...');
  const zkApp = new ProofCommitmentRegistry(zkAppAddr);

  const tx = await Mina.transaction(
    { sender: deployerAddr, fee: TX_FEE },
    async () => {
      AccountUpdate.fundNewAccount(deployerAddr);
      await zkApp.deploy({ verificationKey });
    }
  );

  // eslint-disable-next-line no-console
  console.log('[deploy] proving...');
  await tx.prove();

  // eslint-disable-next-line no-console
  console.log('[deploy] signing & sending...');
  const pending = await tx.sign([deployerKey, zkAppKey]).send();

  // eslint-disable-next-line no-console
  console.log(`\n[deploy] zkApp address: ${zkAppAddr.toBase58()}`);
  // eslint-disable-next-line no-console
  console.log(`[deploy] tx hash:      ${pending.hash}`);
  // eslint-disable-next-line no-console
  console.log(
    `[deploy] explorer:    https://minascan.io/devnet/tx/${pending.hash}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[deploy] account:     https://minascan.io/devnet/account/${zkAppAddr.toBase58()}`
  );
  // eslint-disable-next-line no-console
  console.log(
    '\n[deploy] waiting for tx to be included (may take 2-5 minutes)...'
  );
  await pending.wait();
  // eslint-disable-next-line no-console
  console.log('[deploy] included.');
}

void main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[deploy] ERROR:', e);
  process.exit(1);
});
