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
  console.log('[deploy] signing & sending via raw GraphQL (o1js send() wraps spurious 500s from the minascan proxy as hard failures even when the tx landed; raw call is more honest)...');
  const signed = tx.sign([deployerKey, zkAppKey]);
  const txJson = signed.toJSON();

  const raw = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation($input: SendZkappInput!){ sendZkapp(input: $input){ zkapp{ hash } } }',
      variables: { input: { zkappCommand: JSON.parse(txJson) } },
    }),
  });
  const rawBody = await raw.text();
  let parsed: { data?: { sendZkapp?: { zkapp?: { hash?: string } } }; errors?: unknown };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `GraphQL returned non-JSON body (status ${raw.status}): ${rawBody.slice(0, 300)}`
    );
  }
  const txHash = parsed.data?.sendZkapp?.zkapp?.hash;
  if (!txHash) {
    throw new Error(
      `GraphQL rejected the tx (status ${raw.status}): ${JSON.stringify(parsed).slice(0, 500)}`
    );
  }
  const pending = { hash: txHash };

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
  await waitForInclusion(zkAppAddr.toBase58());
  // eslint-disable-next-line no-console
  console.log('[deploy] included. zkApp account now exists on devnet.');
}

async function waitForInclusion(zkAppBase58: string): Promise<void> {
  const startedAt = Date.now();
  const maxMs = 10 * 60 * 1000;
  let lastLog = 0;
  while (Date.now() - startedAt < maxMs) {
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{account(publicKey:"${zkAppBase58}"){balance{total}}}`,
      }),
    });
    try {
      const json = (await resp.json()) as {
        data?: { account?: { balance?: { total?: string } } };
      };
      if (json.data?.account?.balance?.total) return;
    } catch {
      // ignore JSON parse noise
    }
    if (Date.now() - lastLog > 30_000) {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      // eslint-disable-next-line no-console
      console.log(`[deploy] still waiting for inclusion... (${secs}s elapsed)`);
      lastLog = Date.now();
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `zkApp account did not appear on devnet within ${maxMs / 1000}s — check MinaScan manually`
  );
}

void main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[deploy] ERROR:', e);
  process.exit(1);
});
