import {
  Bytes,
  Crypto,
  Field,
  Keccak,
  Poseidon,
  createEcdsa,
  createForeignCurve,
} from 'o1js';

export class Secp256k1 extends createForeignCurve(Crypto.CurveParams.Secp256k1) {}
export class EcdsaSecp256k1 extends createEcdsa(Secp256k1) {}

export const ATTESTOR_DIGEST_BYTES = 32;
export class AttestorDigest extends Bytes(ATTESTOR_DIGEST_BYTES) {}

export const SECP256K1_UNCOMPRESSED_BYTES = 64;
export class Secp256k1PubKeyBytes extends Bytes(
  SECP256K1_UNCOMPRESSED_BYTES
) {}

export function attestorCommitment(pubKey: Secp256k1): Field {
  return Poseidon.hash([...pubKey.x.value, ...pubKey.y.value] as Field[]);
}

export function digestFromBytes(bytes: Uint8Array): AttestorDigest {
  if (bytes.length !== ATTESTOR_DIGEST_BYTES) {
    throw new Error(
      `AttestorDigest must be ${ATTESTOR_DIGEST_BYTES} bytes, got ${bytes.length}`
    );
  }
  return AttestorDigest.from(bytes);
}

export function claimCommitment(digestBytes: Uint8Array): Field {
  const fields = Array.from(digestBytes).map((b) => Field(b));
  return Poseidon.hash(fields);
}

export function pubKeyTo64Bytes(pubKey: Secp256k1): Uint8Array {
  const x = pubKey.x.toBigInt();
  const y = pubKey.y.toBigInt();
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 32; i++) {
    bytes[31 - i] = Number((x >> BigInt(i * 8)) & 0xffn);
    bytes[63 - i] = Number((y >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}

export function ethAddressFromPubKey(pubKey: Secp256k1): bigint {
  const bytes = pubKeyTo64Bytes(pubKey);
  const digest = Keccak.ethereum(Bytes.from(bytes));
  let addr = 0n;
  for (let i = 12; i < 32; i++) {
    addr = (addr << 8n) | BigInt(Number(digest.bytes[i].toBigInt()));
  }
  return addr;
}

export function ethAddressHexToField(hex: string): Field {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length !== 40) {
    throw new Error(
      `Ethereum address must be 20 bytes (40 hex chars), got ${normalized.length}`
    );
  }
  return Field(BigInt('0x' + normalized));
}
