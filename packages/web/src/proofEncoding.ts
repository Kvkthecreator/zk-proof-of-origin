import type { OriginProofClass } from '@zk-proof-of-origin/circuits';

export const PROOF_URL_PARAM = 'p';
export const PROOF_VERSION = 1;

export type SerializedProof = {
  v: number;
  proof: unknown;
};

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const padded = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeProofToUrl(
  baseUrl: string,
  proof: InstanceType<typeof OriginProofClass>
): string {
  const payload: SerializedProof = {
    v: PROOF_VERSION,
    proof: proof.toJSON(),
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = `${PROOF_URL_PARAM}=${encoded}`;
  return url.toString();
}

export function decodeProofFromString(encoded: string): SerializedProof {
  const json = fromBase64Url(encoded);
  const parsed = JSON.parse(json) as SerializedProof;
  if (parsed.v !== PROOF_VERSION) {
    throw new Error(
      `Unsupported proof version: ${parsed.v} (expected ${PROOF_VERSION})`
    );
  }
  return parsed;
}

export function readProofFromLocation(
  search: string,
  hash: string
): string | null {
  const hashFragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const fromHash = new URLSearchParams(hashFragment).get(PROOF_URL_PARAM);
  if (fromHash) return fromHash;
  return new URLSearchParams(search).get(PROOF_URL_PARAM);
}
