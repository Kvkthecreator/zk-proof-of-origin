import {
  Bool,
  Bytes,
  Field,
  Keccak,
  Poseidon,
  PublicKey,
  Signature,
  Struct,
  UInt8,
  ZkProgram,
} from 'o1js';
import { ContentHash } from './ContentHash.js';
import {
  AttestorDigest,
  EcdsaSecp256k1,
  Secp256k1,
  attestorCommitment as attestorCommitmentHash,
  claimCommitment,
} from './ecdsa.js';

export const ORIGIN_TYPE_HUMAN = Field(0);
export const ORIGIN_TYPE_HUMAN_ATTESTED = Field(2);
export const ORIGIN_TYPE_HUMAN_RECLAIM = Field(3);
export const ORIGIN_TYPE_AI = Field(1);

export class OriginPublicInput extends Struct({
  contentHash: Field,
  credentialCommitment: Field,
  originType: Field,
}) {
  static forHuman(
    contentHash: ContentHash,
    credentialCommitment: Field
  ): OriginPublicInput {
    return new OriginPublicInput({
      contentHash: contentHash.hash,
      credentialCommitment,
      originType: ORIGIN_TYPE_HUMAN,
    });
  }

  static forHumanAttested(
    contentHash: ContentHash,
    credentialCommitment: Field
  ): OriginPublicInput {
    return new OriginPublicInput({
      contentHash: contentHash.hash,
      credentialCommitment,
      originType: ORIGIN_TYPE_HUMAN_ATTESTED,
    });
  }

  static forHumanReclaim(
    contentHash: ContentHash,
    attestorEthAddressField: Field
  ): OriginPublicInput {
    return new OriginPublicInput({
      contentHash: contentHash.hash,
      credentialCommitment: attestorEthAddressField,
      originType: ORIGIN_TYPE_HUMAN_RECLAIM,
    });
  }
}

export const OriginProof = ZkProgram({
  name: 'OriginProof',
  publicInput: OriginPublicInput,
  publicOutput: Field,

  methods: {
    proveHuman: {
      privateInputs: [Signature, PublicKey],

      async method(
        publicInput: OriginPublicInput,
        signature: Signature,
        walletPubKey: PublicKey
      ) {
        publicInput.originType.assertEquals(ORIGIN_TYPE_HUMAN);

        signature
          .verify(walletPubKey, [publicInput.contentHash])
          .assertTrue('wallet signature over contentHash is invalid');

        const expectedCommitment = Poseidon.hash(walletPubKey.toFields());
        publicInput.credentialCommitment.assertEquals(expectedCommitment);

        return { publicOutput: publicInput.contentHash };
      },
    },

    proveHumanWithAttestor: {
      privateInputs: [
        Signature,
        PublicKey,
        EcdsaSecp256k1,
        Secp256k1,
        AttestorDigest,
        Field,
      ],

      async method(
        publicInput: OriginPublicInput,
        walletSig: Signature,
        walletPubKey: PublicKey,
        attestorSig: EcdsaSecp256k1,
        attestorPubKey: Secp256k1,
        claimDigest: AttestorDigest,
        claimHashPublic: Field
      ) {
        publicInput.originType.assertEquals(ORIGIN_TYPE_HUMAN_ATTESTED);

        walletSig
          .verify(walletPubKey, [publicInput.contentHash])
          .assertTrue('wallet signature over contentHash is invalid');

        attestorSig
          .verify(claimDigest, attestorPubKey)
          .assertTrue('attestor ECDSA signature invalid');

        const expectedAttestorCommitment = attestorCommitmentHash(attestorPubKey);
        publicInput.credentialCommitment.assertEquals(
          expectedAttestorCommitment,
          'credentialCommitment must equal Poseidon hash of attestor pubkey'
        );

        const digestFields = claimDigest.bytes.map((b) => b.value);
        const digestHash = Poseidon.hash(digestFields);
        claimHashPublic.assertEquals(
          digestHash,
          'claim digest hash mismatch'
        );

        return { publicOutput: publicInput.contentHash };
      },
    },

    proveHumanWithReclaimAttestor: {
      privateInputs: [
        Signature,
        PublicKey,
        EcdsaSecp256k1,
        Secp256k1,
        AttestorDigest,
        Field,
      ],

      async method(
        publicInput: OriginPublicInput,
        walletSig: Signature,
        walletPubKey: PublicKey,
        attestorSig: EcdsaSecp256k1,
        attestorPubKey: Secp256k1,
        claimDigest: AttestorDigest,
        claimHashPublic: Field
      ) {
        publicInput.originType.assertEquals(ORIGIN_TYPE_HUMAN_RECLAIM);

        walletSig
          .verify(walletPubKey, [publicInput.contentHash])
          .assertTrue('wallet signature over contentHash is invalid');

        // Reclaim signatures are over keccak256(provider || "\n" || parameters || "\n" || context).
        // We pass that 32-byte digest directly — no double-hash.
        attestorSig
          .verifySignedHash(claimDigest, attestorPubKey)
          .assertTrue('attestor ECDSA signature invalid');

        const pubKeyBytes = pubKeyToBigEndianBytes(attestorPubKey);
        const ethAddrDigest = Keccak.ethereum(Bytes.from(pubKeyBytes));

        let attestorEthAddr = Field(0);
        const TWO_POW_8 = Field(256);
        for (let i = 12; i < 32; i++) {
          attestorEthAddr = attestorEthAddr
            .mul(TWO_POW_8)
            .add(ethAddrDigest.bytes[i].value);
        }
        publicInput.credentialCommitment.assertEquals(
          attestorEthAddr,
          'credentialCommitment must equal attestor Ethereum address'
        );

        const digestFields = claimDigest.bytes.map((b) => b.value);
        const digestHash = Poseidon.hash(digestFields);
        claimHashPublic.assertEquals(
          digestHash,
          'claim digest hash mismatch'
        );

        return { publicOutput: publicInput.contentHash };
      },
    },
  },
});

function pubKeyToBigEndianBytes(pubKey: Secp256k1): UInt8[] {
  const xBits = pubKey.x.toBits(256);
  const yBits = pubKey.y.toBits(256);
  return [...coordBitsToBytesBE(xBits), ...coordBitsToBytesBE(yBits)];
}

function coordBitsToBytesBE(bits: Bool[]): UInt8[] {
  const bytes: UInt8[] = [];
  for (let byteIdx = 0; byteIdx < 32; byteIdx++) {
    const leByteOffset = (31 - byteIdx) * 8;
    const byteBits = bits.slice(leByteOffset, leByteOffset + 8);
    bytes.push(UInt8.fromBits(byteBits));
  }
  return bytes;
}

export class OriginProofClass extends ZkProgram.Proof(OriginProof) {}

export { attestorCommitmentHash as attestorCommitment, claimCommitment };
