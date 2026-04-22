import {
  AccountUpdate,
  Mina,
  PublicKey,
  fetchAccount,
  type NetworkId,
} from 'o1js';
import {
  OriginProof,
  OriginProofClass,
  ProofCommitmentRegistry,
} from '@zk-proof-of-origin/circuits';
import {
  DEPLOYED_ZKAPP_ADDRESS,
  DEPLOYED_GRAPHQL_URL,
} from './onchainAnchor';
import { idbCache, warmCircuitCache } from './idbCache';

/**
 * Auro wallet integration for the on-chain anchor flow. The wallet
 * injects `window.mina`; we feature-detect, connect, then build the
 * `anchor(proof)` zkApp call as a Mina.transaction — sign + send via
 * Auro so the user pays the fee and signs with their own keys.
 *
 * No private keys ever touch our app. No backend involved.
 */

interface AuroProvider {
  requestAccounts: () => Promise<string[]>;
  getAccounts?: () => Promise<string[]>;
  requestNetwork?: () => Promise<{ networkID?: string }>;
  sendTransaction: (args: {
    transaction: string;
    feePayer?: { fee?: number; memo?: string };
  }) => Promise<{ hash: string } | { error: { code: number; message: string } }>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getAuro(): AuroProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { mina?: AuroProvider };
  return w.mina ?? null;
}

export const AURO_AVAILABLE = (() => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { mina?: unknown }).mina);
})();

export type AuroState =
  | { kind: 'unavailable' }
  | { kind: 'disconnected' }
  | { kind: 'connected'; address: string };

export async function detectAuroState(): Promise<AuroState> {
  const auro = getAuro();
  if (!auro) return { kind: 'unavailable' };
  try {
    const accs = await auro.getAccounts?.();
    if (accs && accs.length > 0) {
      return { kind: 'connected', address: accs[0] };
    }
  } catch {
    // fall through
  }
  return { kind: 'disconnected' };
}

export async function connectAuro(): Promise<{ address: string }> {
  const auro = getAuro();
  if (!auro) throw new Error('Auro wallet not detected. Install from aurowallet.com');
  const accounts = await auro.requestAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error('Auro returned no accounts');
  }
  return { address: accounts[0] };
}

/**
 * Anchor a verified OriginProof on-chain via the deployed
 * ProofCommitmentRegistry. Returns the tx hash + MinaScan URL.
 *
 * Compile cycle:
 *  - OriginProof must be compiled (verifies our proof inside anchor()).
 *  - ProofCommitmentRegistry must be compiled (zkApp itself).
 * Both happen lazily and cache for the session.
 */
let zkAppCompilePromise: Promise<void> | null = null;

async function ensureZkAppCompiled(
  onProgress: (label: string) => void
): Promise<void> {
  if (zkAppCompilePromise) {
    await zkAppCompilePromise;
    return;
  }
  zkAppCompilePromise = (async () => {
    await warmCircuitCache();
    onProgress('Compiling OriginProof verifier (cached after first visit)');
    await OriginProof.compile({ cache: idbCache });
    onProgress('Compiling ProofCommitmentRegistry zkApp');
    await ProofCommitmentRegistry.compile({ cache: idbCache });
  })();
  await zkAppCompilePromise;
}

export type AnchorResult = {
  txHash: string;
  explorerUrl: string;
};

export async function anchorProofViaAuro(
  proof: InstanceType<typeof OriginProofClass>,
  onProgress: (label: string) => void
): Promise<AnchorResult> {
  const auro = getAuro();
  if (!auro) throw new Error('Auro wallet not available');

  const accounts = await auro.requestAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error('Auro returned no accounts');
  }
  const senderBase58 = accounts[0];

  onProgress('Connecting to Mina devnet');
  const network = Mina.Network({
    networkId: 'testnet' as NetworkId,
    mina: DEPLOYED_GRAPHQL_URL,
  });
  Mina.setActiveInstance(network);

  const senderPublicKey = PublicKey.fromBase58(senderBase58);
  await fetchAccount({ publicKey: senderPublicKey });
  await fetchAccount({ publicKey: PublicKey.fromBase58(DEPLOYED_ZKAPP_ADDRESS) });

  await ensureZkAppCompiled(onProgress);

  onProgress('Building anchor transaction');
  const zkApp = new ProofCommitmentRegistry(
    PublicKey.fromBase58(DEPLOYED_ZKAPP_ADDRESS)
  );
  const tx = await Mina.transaction(
    { sender: senderPublicKey, fee: 100_000_000 },
    async () => {
      await zkApp.anchor(proof);
    }
  );

  onProgress('Proving anchor transaction (~10–20s)');
  await tx.prove();

  // AccountUpdate ref keeps tree-shaking from dropping the import we need
  // at runtime for the .toJSON() shape Auro consumes below.
  void AccountUpdate;

  onProgress('Submitting via Auro for signature');
  const result = await auro.sendTransaction({
    transaction: tx.toJSON(),
    feePayer: { fee: 0.1, memo: 'zk-proof-of-origin anchor' },
  });

  if ('error' in result) {
    throw new Error(`Auro rejected tx: ${result.error.message}`);
  }

  return {
    txHash: result.hash,
    explorerUrl: `https://minascan.io/devnet/tx/${result.hash}`,
  };
}
