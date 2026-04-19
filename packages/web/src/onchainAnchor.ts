import { Field, Poseidon, UInt64 } from 'o1js';

export const DEFAULT_DEVNET_GRAPHQL =
  'https://api.minascan.io/node/devnet/v1/graphql';

export const DEPLOYED_ZKAPP_ADDRESS =
  (import.meta.env.VITE_ZKAPP_ADDRESS as string | undefined) ??
  'B62qpPxWR3QXCuA4bEZTmtz5ZmFBfFPpZyCrxo4NuWS6uJ9nbHgNoVU';

export const DEPLOYED_GRAPHQL_URL =
  (import.meta.env.VITE_MINA_GRAPHQL_URL as string | undefined) ??
  DEFAULT_DEVNET_GRAPHQL;

/**
 * Reads `lastProofDigest` and `proofCount` from the deployed
 * ProofCommitmentRegistry account. The `appState` array returned by
 * Mina matches our state layout:
 *   appState[0] = lastProofDigest (Field)
 *   appState[1] = proofCount low-limb of UInt64 (Field)
 *   appState[2] = lastOriginType (Field)
 *   appState[3..4] = owner (PublicKey as 2 fields)
 *   appState[5..7] = 0 padding
 *
 * Mina's GraphQL returns appState as array of strings.
 */
export type OnchainAnchorState = {
  lastProofDigest: Field;
  proofCount: UInt64;
  lastOriginType: Field;
  fetchedAt: number;
};

export async function readAnchorState(
  zkAppAddress: string = DEPLOYED_ZKAPP_ADDRESS,
  graphqlUrl: string = DEPLOYED_GRAPHQL_URL
): Promise<OnchainAnchorState> {
  const query = `{account(publicKey:"${zkAppAddress}"){zkappState}}`;
  const resp = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = (await resp.json()) as {
    data?: {
      account?: {
        zkappState?: Array<string | { field: string }> | null;
      } | null;
    };
    errors?: unknown;
  };
  const account = json.data?.account;
  if (!account) {
    throw new Error(
      `zkApp account ${zkAppAddress} not found on this network`
    );
  }
  const stateRaw = account.zkappState;
  if (!stateRaw || stateRaw.length < 3) {
    throw new Error('zkappState missing or too short');
  }
  const state: string[] = stateRaw.map((s) =>
    typeof s === 'string' ? s : s.field
  );
  return {
    lastProofDigest: Field(state[0]),
    proofCount: UInt64.from(state[1]),
    lastOriginType: Field(state[2]),
    fetchedAt: Date.now(),
  };
}

/**
 * Compute the anchor digest for a given proof + sequence slot.
 * Matches AnchorRecord.digest() in packages/circuits/src/ProofCommitmentRegistry.ts.
 */
export function computeAnchorDigest(params: {
  contentHash: Field;
  credentialCommitment: Field;
  originType: Field;
  sequence: UInt64;
}): Field {
  return Poseidon.hash([
    params.contentHash,
    params.credentialCommitment,
    params.originType,
    ...params.sequence.toFields(),
  ]);
}

export type AnchorLookupResult =
  | { kind: 'anchored-latest'; sequence: UInt64 }
  | { kind: 'not-latest'; onchainDigest: Field; proofCount: UInt64 }
  | { kind: 'registry-offline'; message: string };

/**
 * Given a verified proof's public inputs, check whether it matches the
 * registry's `lastProofDigest`. We can only cheaply verify "is this the
 * latest anchored record" — historical anchors would require scanning
 * chain events. That's a Milestone 6+ expansion.
 */
export async function checkIsLatestAnchor(params: {
  contentHash: string;
  credentialCommitment: string;
  originType: string;
}): Promise<AnchorLookupResult> {
  let state: OnchainAnchorState;
  try {
    state = await readAnchorState();
  } catch (e) {
    return {
      kind: 'registry-offline',
      message: e instanceof Error ? e.message : String(e),
    };
  }
  // The sequence used in the digest was proofCount *before* incrementing.
  const latestSeq = state.proofCount.sub(UInt64.one);
  const expectedDigest = computeAnchorDigest({
    contentHash: Field(params.contentHash),
    credentialCommitment: Field(params.credentialCommitment),
    originType: Field(params.originType),
    sequence: latestSeq,
  });
  if (
    state.lastProofDigest.toString() === expectedDigest.toString()
  ) {
    return { kind: 'anchored-latest', sequence: latestSeq };
  }
  return {
    kind: 'not-latest',
    onchainDigest: state.lastProofDigest,
    proofCount: state.proofCount,
  };
}

export function explorerAccountUrl(
  addr: string = DEPLOYED_ZKAPP_ADDRESS
): string {
  return `https://minascan.io/devnet/account/${addr}/zk-txs`;
}
