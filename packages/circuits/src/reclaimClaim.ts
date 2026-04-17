import { Bytes, Field, Keccak } from 'o1js';

/**
 * Shape of a Reclaim session response, narrowed to fields we actually bind into the circuit.
 * The Reclaim SDK returns more — we only care about these.
 */
export type ReclaimClaim = {
  provider: string;
  parameters: string;
  context: string;
  signature: string;
};

/**
 * Build the 32-byte keccak256 digest that Reclaim attestors sign:
 *   keccak256(provider + "\n" + parameters + "\n" + context)
 */
export function reclaimClaimDigest(claim: {
  provider: string;
  parameters: string;
  context: string;
}): Uint8Array {
  const serialized = `${claim.provider}\n${claim.parameters}\n${claim.context}`;
  const bytes = new TextEncoder().encode(serialized);
  const digest = Keccak.ethereum(Bytes.from(bytes));
  return Uint8Array.from(digest.bytes.map((b) => Number(b.toBigInt())));
}

/**
 * Parse a Reclaim signature hex into (r, s, v).
 * Reclaim returns 65 bytes = r(32) || s(32) || v(1), Ethereum-style.
 * v may be {0,1} or {27,28} depending on SDK version; we normalize off-circuit.
 */
export function parseReclaimSignature(hex: string): {
  r: bigint;
  s: bigint;
  v: number;
} {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 130) {
    throw new Error(
      `Reclaim signature must be 65 bytes (130 hex chars), got ${clean.length}`
    );
  }
  const r = BigInt('0x' + clean.slice(0, 64));
  const s = BigInt('0x' + clean.slice(64, 128));
  let v = parseInt(clean.slice(128, 130), 16);
  if (v < 27) v += 27;
  return { r, s, v };
}

/**
 * Recover the uncompressed secp256k1 public key (x, y) from an Ethereum-style signature.
 * Pure JS — no dependencies. Uses the signed digest directly (the message hash).
 *
 * Called off-circuit only. The recovered (x, y) is fed into the ZkProgram as a witness.
 */
export function recoverSecp256k1PubKey(
  messageDigest: Uint8Array,
  sig: { r: bigint; s: bigint; v: number }
): { x: bigint; y: bigint } {
  const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const A = 0n;
  const B = 7n;
  const GX =
    0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
  const GY =
    0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

  const mod = (a: bigint, m: bigint): bigint => {
    const r = a % m;
    return r < 0n ? r + m : r;
  };
  const modPow = (base: bigint, exp: bigint, m: bigint): bigint => {
    let result = 1n;
    let b = mod(base, m);
    let e = exp;
    while (e > 0n) {
      if (e & 1n) result = (result * b) % m;
      b = (b * b) % m;
      e >>= 1n;
    }
    return result;
  };
  const invMod = (a: bigint, m: bigint): bigint => modPow(a, m - 2n, m);

  type Pt = { x: bigint; y: bigint } | null;
  const G: Pt = { x: GX, y: GY };
  const pointAdd = (p: Pt, q: Pt): Pt => {
    if (!p) return q;
    if (!q) return p;
    if (p.x === q.x) {
      if (mod(p.y + q.y, P) === 0n) return null;
      return pointDouble(p);
    }
    const m = mod((q.y - p.y) * invMod(mod(q.x - p.x, P), P), P);
    const rx = mod(m * m - p.x - q.x, P);
    const ry = mod(m * (p.x - rx) - p.y, P);
    return { x: rx, y: ry };
  };
  const pointDouble = (p: Pt): Pt => {
    if (!p) return null;
    const m = mod((3n * p.x * p.x + A) * invMod(mod(2n * p.y, P), P), P);
    const rx = mod(m * m - 2n * p.x, P);
    const ry = mod(m * (p.x - rx) - p.y, P);
    return { x: rx, y: ry };
  };
  const pointMul = (k: bigint, p: Pt): Pt => {
    let result: Pt = null;
    let addend: Pt = p;
    let n = mod(k, N);
    while (n > 0n) {
      if (n & 1n) result = pointAdd(result, addend);
      addend = pointDouble(addend);
      n >>= 1n;
    }
    return result;
  };

  const z = BigInt(
    '0x' +
      Array.from(messageDigest)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  );

  const recId = (sig.v - 27) & 1;
  const x = sig.r;
  const alpha = mod(x * x * x + A * x + B, P);
  const beta = modPow(alpha, (P + 1n) / 4n, P);
  const y = (beta & 1n) === BigInt(recId) ? beta : P - beta;

  const R: Pt = { x, y };
  const rInv = invMod(sig.r, N);
  const u1 = mod(-z * rInv, N);
  const u2 = mod(sig.s * rInv, N);
  const Q = pointAdd(pointMul(u1, G), pointMul(u2, R));
  if (!Q) throw new Error('pubkey recovery produced point at infinity');
  return { x: Q.x, y: Q.y };
}

/**
 * Compute the Ethereum address (20 bytes as bigint) from a recovered pubkey.
 * This is what Reclaim's `witnesses[i].id` should equal for a valid attestor signature.
 */
export function ethAddressFromRecoveredPubKey(pub: {
  x: bigint;
  y: bigint;
}): bigint {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    bytes[31 - i] = Number((pub.x >> BigInt(i * 8)) & 0xffn);
    bytes[63 - i] = Number((pub.y >> BigInt(i * 8)) & 0xffn);
  }
  const digest = Keccak.ethereum(Bytes.from(bytes));
  let addr = 0n;
  for (let i = 12; i < 32; i++) {
    addr = (addr << 8n) | BigInt(Number(digest.bytes[i].toBigInt()));
  }
  return addr;
}

/**
 * Convert a 20-byte Ethereum address (hex with or without 0x) to a Field.
 * 20 bytes = 160 bits, fits in a single 254-bit Field.
 */
export function ethAddressToField(addressHex: string): Field {
  const clean = addressHex.startsWith('0x')
    ? addressHex.slice(2)
    : addressHex;
  if (clean.length !== 40) {
    throw new Error(
      `Ethereum address must be 20 bytes (40 hex chars), got ${clean.length}`
    );
  }
  return Field(BigInt('0x' + clean));
}

/**
 * Given a Reclaim session response, return everything the prover needs.
 */
export function prepareReclaimWitness(
  claim: ReclaimClaim,
  expectedAttestorAddressHex: string
) {
  const digest = reclaimClaimDigest(claim);
  const sig = parseReclaimSignature(claim.signature);
  const pub = recoverSecp256k1PubKey(digest, sig);
  const recoveredAddr = ethAddressFromRecoveredPubKey(pub);
  const expected = BigInt(
    '0x' +
      (expectedAttestorAddressHex.startsWith('0x')
        ? expectedAttestorAddressHex.slice(2)
        : expectedAttestorAddressHex)
  );
  if (recoveredAddr !== expected) {
    throw new Error(
      `recovered attestor address ${recoveredAddr
        .toString(16)
        .padStart(40, '0')} does not match expected ${expected
        .toString(16)
        .padStart(40, '0')}`
    );
  }
  return {
    digest,
    signature: { r: sig.r, s: sig.s },
    pubKey: pub,
    attestorAddressField: ethAddressToField(expectedAttestorAddressHex),
  };
}

/**
 * Canonical Reclaim attestor address pinned by the Sui/Mina quickstarts.
 * We treat this as a trusted input — verifiers either trust it too or refuse the proof.
 */
export const RECLAIM_CANONICAL_ATTESTOR_ADDRESS =
  '0x244897572368eadf65bfbc5aec98d8e5443a9072';
