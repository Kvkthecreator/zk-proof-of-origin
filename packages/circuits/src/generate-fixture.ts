#!/usr/bin/env node
import {
  Crypto,
  Bytes,
  Keccak,
  createEcdsa,
  createForeignCurve,
} from 'o1js';

class Secp256k1 extends createForeignCurve(Crypto.CurveParams.Secp256k1) {}
class EcdsaSecp256k1 extends createEcdsa(Secp256k1) {}

function findRecoveryV(
  digest: Uint8Array,
  sig: { r: bigint; s: bigint },
  targetPubX: bigint,
  targetPubY: bigint
): number | null {
  const P =
    0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
  const N =
    0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const GX =
    0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
  const GY =
    0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

  const mod = (a: bigint, m: bigint): bigint => {
    const r = a % m;
    return r < 0n ? r + m : r;
  };
  const modPow = (b: bigint, e: bigint, m: bigint): bigint => {
    let r = 1n;
    let base = mod(b, m);
    let exp = e;
    while (exp > 0n) {
      if (exp & 1n) r = (r * base) % m;
      base = (base * base) % m;
      exp >>= 1n;
    }
    return r;
  };
  const invMod = (a: bigint, m: bigint): bigint => modPow(a, m - 2n, m);

  type Pt = { x: bigint; y: bigint } | null;
  const pointDouble = (p: Pt): Pt => {
    if (!p) return null;
    const m = mod(3n * p.x * p.x * invMod(mod(2n * p.y, P), P), P);
    const rx = mod(m * m - 2n * p.x, P);
    return { x: rx, y: mod(m * (p.x - rx) - p.y, P) };
  };
  const pointAdd = (p: Pt, q: Pt): Pt => {
    if (!p) return q;
    if (!q) return p;
    if (p.x === q.x) {
      if (mod(p.y + q.y, P) === 0n) return null;
      return pointDouble(p);
    }
    const m = mod((q.y - p.y) * invMod(mod(q.x - p.x, P), P), P);
    const rx = mod(m * m - p.x - q.x, P);
    return { x: rx, y: mod(m * (p.x - rx) - p.y, P) };
  };
  const pointMul = (k: bigint, p: Pt): Pt => {
    let r: Pt = null;
    let addend: Pt = p;
    let n = mod(k, N);
    while (n > 0n) {
      if (n & 1n) r = pointAdd(r, addend);
      addend = pointDouble(addend);
      n >>= 1n;
    }
    return r;
  };

  const z = BigInt(
    '0x' +
      Array.from(digest)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  );

  for (const v of [27, 28]) {
    const recId = (v - 27) & 1;
    const x = sig.r;
    const alpha = mod(x * x * x + 7n, P);
    const beta = modPow(alpha, (P + 1n) / 4n, P);
    const y = (beta & 1n) === BigInt(recId) ? beta : P - beta;
    const R: Pt = { x, y };
    const rInv = invMod(sig.r, N);
    const u1 = mod(-z * rInv, N);
    const u2 = mod(sig.s * rInv, N);
    const Q = pointAdd(pointMul(u1, { x: GX, y: GY }), pointMul(u2, R));
    if (Q && Q.x === targetPubX && Q.y === targetPubY) {
      return v;
    }
  }
  return null;
}

function ethAddress(pubX: bigint, pubY: bigint): string {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    bytes[31 - i] = Number((pubX >> BigInt(i * 8)) & 0xffn);
    bytes[63 - i] = Number((pubY >> BigInt(i * 8)) & 0xffn);
  }
  const digest = Keccak.ethereum(Bytes.from(bytes));
  let addr = 0n;
  for (let i = 12; i < 32; i++) {
    addr = (addr << 8n) | BigInt(Number(digest.bytes[i].toBigInt()));
  }
  return '0x' + addr.toString(16).padStart(40, '0');
}

async function main() {
  const priv = Secp256k1.Scalar.random();
  const pubBig = Secp256k1.generator.scale(priv);
  const pubX = pubBig.x.toBigInt();
  const pubY = pubBig.y.toBigInt();
  const attestorAddress = ethAddress(pubX, pubY);

  const provider = 'github';
  const parameters = '{"username":"kvkthecreator"}';
  const context =
    '{"contextAddress":"0x0","contextMessage":"demo","extractedParameters":{"username":"kvkthecreator"}}';

  const serialized = `${provider}\n${parameters}\n${context}`;
  const digest = Keccak.ethereum(Bytes.from(new TextEncoder().encode(serialized)));
  const digestBytes = Uint8Array.from(
    digest.bytes.map((b) => Number(b.toBigInt()))
  );

  const sig = EcdsaSecp256k1.signHash(digest, priv.toBigInt());
  const r = sig.r.toBigInt();
  const s = sig.s.toBigInt();

  const v = findRecoveryV(digestBytes, { r, s }, pubX, pubY);
  if (v === null) throw new Error('could not find recovery v');

  const rHex = r.toString(16).padStart(64, '0');
  const sHex = s.toString(16).padStart(64, '0');
  const vHex = v.toString(16).padStart(2, '0');
  const signature = '0x' + rHex + sHex + vHex;

  const reclaimProofShape = {
    identifier: '0x' + digestBytes.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), ''),
    claimData: {
      provider,
      parameters,
      context,
      owner: '0x' + '0'.repeat(40),
      timestampS: Math.floor(Date.now() / 1000),
      epoch: 1,
      identifier: '0x' + digestBytes.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), ''),
    },
    signatures: [signature],
    witnesses: [{ id: attestorAddress, url: 'https://demo-attestor.example' }],
    extractedParameters: { username: 'kvkthecreator' },
  };

  // eslint-disable-next-line no-console
  console.log('===== DEMO RECLAIM CLAIM FIXTURE =====');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(reclaimProofShape, null, 2));
  // eslint-disable-next-line no-console
  console.log('===== attestor private key (KEEP FOR REGEN) =====');
  // eslint-disable-next-line no-console
  console.log(priv.toBigInt().toString(16));
  // eslint-disable-next-line no-console
  console.log('===== attestor Ethereum address =====');
  // eslint-disable-next-line no-console
  console.log(attestorAddress);
}

void main();
