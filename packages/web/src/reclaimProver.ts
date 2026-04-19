import {
  AttestorDigest,
  ContentHash,
  EcdsaSecp256k1,
  ORIGIN_TYPE_HUMAN_RECLAIM,
  OriginProof,
  OriginProofClass,
  OriginPublicInput,
  RECLAIM_CANONICAL_ATTESTOR_ADDRESS,
  Secp256k1,
  claimCommitment,
  ethAddressToField,
  prepareReclaimWitness,
  type ReclaimClaim,
} from '@zk-proof-of-origin/circuits';
import { PrivateKey, Signature } from 'o1js';

export type ReclaimProveProgress =
  | { stage: 'compiling' }
  | { stage: 'parsing' }
  | { stage: 'hashing' }
  | { stage: 'signing' }
  | { stage: 'recovering' }
  | { stage: 'proving' }
  | { stage: 'done' };

export type ReclaimProveResult = {
  proof: InstanceType<typeof OriginProofClass>;
  contentHash: string;
  walletAddress: string;
  attestorAddress: string;
  provider: string;
  proofTimeMs: number;
  extractedUsername?: string;
};

let compiled = false;
let compilePromise: Promise<void> | null = null;

async function ensureCompiled(
  onProgress: (p: ReclaimProveProgress) => void
): Promise<void> {
  if (compiled) return;
  if (compilePromise) {
    await compilePromise;
    return;
  }
  onProgress({ stage: 'compiling' });
  compilePromise = OriginProof.compile().then(() => {
    compiled = true;
  });
  await compilePromise;
}

export type ReclaimJsonShape = {
  claimData?: {
    provider?: string;
    parameters?: string;
    context?: string;
    extractedParameters?: Record<string, string>;
  };
  signatures?: string[];
  witnesses?: Array<{ id?: string }>;
  extractedParameters?: Record<string, string>;
  identifier?: string;
};

export function parseReclaimJson(
  rawJson: string,
  expectedAttestorAddressHex: string = RECLAIM_CANONICAL_ATTESTOR_ADDRESS
): {
  claim: ReclaimClaim;
  expectedAttestorAddress: string;
  extractedUsername?: string;
} {
  let parsed: ReclaimJsonShape;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(
      `Could not parse Reclaim JSON: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
  const provider = parsed.claimData?.provider;
  const parameters = parsed.claimData?.parameters;
  const context = parsed.claimData?.context;
  const signature = parsed.signatures?.[0];
  if (!provider || parameters === undefined || context === undefined) {
    throw new Error(
      'Reclaim JSON missing claimData.provider / parameters / context'
    );
  }
  if (!signature) {
    throw new Error('Reclaim JSON missing signatures[0]');
  }
  const witnessAddress = parsed.witnesses?.[0]?.id;
  const expectedAttestorAddress =
    witnessAddress ?? expectedAttestorAddressHex;
  const extractedUsername =
    parsed.extractedParameters?.username ??
    parsed.claimData?.extractedParameters?.username;
  return {
    claim: { provider, parameters, context, signature },
    expectedAttestorAddress,
    extractedUsername,
  };
}

export async function proveReclaimFlow(
  content: string,
  reclaimJson: string,
  onProgress: (p: ReclaimProveProgress) => void
): Promise<ReclaimProveResult> {
  onProgress({ stage: 'parsing' });
  const { claim, expectedAttestorAddress, extractedUsername } =
    parseReclaimJson(reclaimJson);

  onProgress({ stage: 'recovering' });
  const bundle = prepareReclaimWitness(claim, expectedAttestorAddress);

  await ensureCompiled(onProgress);

  onProgress({ stage: 'hashing' });
  const contentHash = ContentHash.fromText(content);

  onProgress({ stage: 'signing' });
  const walletKey = PrivateKey.random();
  const walletPubKey = walletKey.toPublicKey();
  const walletSig = Signature.create(walletKey, [contentHash.hash]);

  const attestorPubKey = Secp256k1.from({
    x: bundle.pubKey.x,
    y: bundle.pubKey.y,
  });
  const attestorSig = EcdsaSecp256k1.from({
    r: bundle.signature.r,
    s: bundle.signature.s,
  });
  const claimDigest = AttestorDigest.from(bundle.digest);
  const claimHashPublic = claimCommitment(bundle.digest);

  const publicInput = OriginPublicInput.forHumanReclaim(
    contentHash,
    ethAddressToField(expectedAttestorAddress)
  );

  onProgress({ stage: 'proving' });
  const t0 = performance.now();
  const { proof } = await OriginProof.proveHumanWithReclaimAttestor(
    publicInput,
    walletSig,
    walletPubKey,
    attestorSig,
    attestorPubKey,
    claimDigest,
    claimHashPublic
  );
  const proofTimeMs = performance.now() - t0;

  onProgress({ stage: 'done' });

  const normalizedAddress = expectedAttestorAddress.startsWith('0x')
    ? expectedAttestorAddress
    : '0x' + expectedAttestorAddress;

  void ORIGIN_TYPE_HUMAN_RECLAIM;

  return {
    proof,
    contentHash: contentHash.hash.toString(),
    walletAddress: walletPubKey.toBase58(),
    attestorAddress: normalizedAddress,
    provider: claim.provider,
    proofTimeMs,
    extractedUsername,
  };
}
