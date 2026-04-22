import {
  ContentHash,
  OriginProof,
  OriginProofClass,
  OriginPublicInput,
} from '@zk-proof-of-origin/circuits';
import { Poseidon, PrivateKey, Signature } from 'o1js';
import { idbCache, warmCircuitCache } from './idbCache';

export type ProveProgress =
  | { stage: 'compiling' }
  | { stage: 'hashing' }
  | { stage: 'signing' }
  | { stage: 'proving' }
  | { stage: 'verifying' }
  | { stage: 'done' };

export type ProveResult = {
  proof: InstanceType<typeof OriginProofClass>;
  contentHash: string;
  walletAddress: string;
  proofTimeMs: number;
};

let compiled = false;
let compilePromise: Promise<void> | null = null;

async function ensureCompiled(
  onProgress: (p: ProveProgress) => void
): Promise<void> {
  if (compiled) return;
  if (compilePromise) {
    await compilePromise;
    return;
  }
  onProgress({ stage: 'compiling' });
  compilePromise = (async () => {
    // Warm the IDB-backed cache before compile so a returning visitor
    // skips the prover-key generation entirely. First-ever visit still
    // pays the full compile cost; subsequent visits are seconds.
    await warmCircuitCache();
    await OriginProof.compile({ cache: idbCache });
    compiled = true;
  })();
  await compilePromise;
}

export async function proveHumanFlow(
  text: string,
  onProgress: (p: ProveProgress) => void
): Promise<ProveResult> {
  await ensureCompiled(onProgress);

  onProgress({ stage: 'hashing' });
  const contentHash = ContentHash.fromText(text);

  onProgress({ stage: 'signing' });
  const walletKey = PrivateKey.random();
  const walletPubKey = walletKey.toPublicKey();
  const credentialCommitment = Poseidon.hash(walletPubKey.toFields());
  const walletSig = Signature.create(walletKey, [contentHash.hash]);

  const publicInput = OriginPublicInput.forHuman(
    contentHash,
    credentialCommitment
  );

  onProgress({ stage: 'proving' });
  const t0 = performance.now();
  const { proof } = await OriginProof.proveHuman(
    publicInput,
    walletSig,
    walletPubKey
  );
  const proofTimeMs = performance.now() - t0;

  onProgress({ stage: 'done' });
  return {
    proof,
    contentHash: contentHash.hash.toString(),
    walletAddress: walletPubKey.toBase58(),
    proofTimeMs,
  };
}

export async function verifyOriginProof(
  proofJson: unknown
): Promise<{
  valid: boolean;
  contentHash: string;
  credentialCommitment: string;
  originType: string;
  verifyTimeMs: number;
}> {
  await ensureCompiled(() => {});

  const proof = await OriginProofClass.fromJSON(
    proofJson as Parameters<typeof OriginProofClass.fromJSON>[0]
  );

  const t0 = performance.now();
  const valid = await OriginProof.verify(proof);
  const verifyTimeMs = performance.now() - t0;

  return {
    valid,
    contentHash: proof.publicInput.contentHash.toString(),
    credentialCommitment: proof.publicInput.credentialCommitment.toString(),
    originType: proof.publicInput.originType.toString(),
    verifyTimeMs,
  };
}
