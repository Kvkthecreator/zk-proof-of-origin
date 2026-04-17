import {
  Bytes,
  Crypto,
  Field,
  Keccak,
  Poseidon,
  Provable,
  Struct,
  ZkProgram,
  createEcdsa,
  createForeignCurve,
} from 'o1js';

export class Secp256k1 extends createForeignCurve(Crypto.CurveParams.Secp256k1) {}
export class EcdsaSecp256k1 extends createEcdsa(Secp256k1) {}

const CLAIM_DIGEST_BYTES = 32;
export class ClaimDigest extends Bytes(CLAIM_DIGEST_BYTES) {}

export class EcdsaAttestorPublicInput extends Struct({
  attestorCommitment: Field,
  claimHash: Field,
}) {}

export const EcdsaAttestorSpike = ZkProgram({
  name: 'EcdsaAttestorSpike',
  publicInput: EcdsaAttestorPublicInput,
  publicOutput: Field,

  methods: {
    verifyAttestor: {
      privateInputs: [EcdsaSecp256k1, Secp256k1, ClaimDigest],

      async method(
        publicInput: EcdsaAttestorPublicInput,
        signature: EcdsaSecp256k1,
        attestorPubKey: Secp256k1,
        claimDigest: ClaimDigest
      ) {
        signature
          .verify(claimDigest, attestorPubKey)
          .assertTrue('attestor ECDSA signature invalid');

        const pubKeyFields = [
          ...attestorPubKey.x.value,
          ...attestorPubKey.y.value,
        ];
        const expectedCommitment = Poseidon.hash(pubKeyFields);
        publicInput.attestorCommitment.assertEquals(expectedCommitment);

        const digestAsFields = claimDigest.bytes.map((b) => b.value);
        const claimHash = Poseidon.hash(digestAsFields);
        publicInput.claimHash.assertEquals(claimHash);

        return { publicOutput: publicInput.attestorCommitment };
      },
    },
  },
});

export function hashClaimInfoToDigest(
  provider: string,
  parameters: string,
  context: string
): Uint8Array {
  const serialized = `${provider}\n${parameters}\n${context}`;
  const bytes = new TextEncoder().encode(serialized);
  const hash = Keccak.ethereum(Bytes.from(bytes));
  return Uint8Array.from(hash.bytes.map((b) => Number(b.toBigInt())));
}

export function poseidonHashOfBytes(bytes: Uint8Array): Field {
  const fields = Array.from(bytes).map((b) => Field(b));
  return Poseidon.hash(fields);
}

export function poseidonHashOfPubKey(pub: {
  x: { value: Field[] | readonly Field[] };
  y: { value: Field[] | readonly Field[] };
}): Field {
  const fields = [...pub.x.value, ...pub.y.value] as Field[];
  return Poseidon.hash(fields);
}

Provable;
