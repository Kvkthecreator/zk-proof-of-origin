import { beforeAll, describe, expect, it } from 'vitest';
import { Bytes, Field, Keccak, Poseidon, PrivateKey, Signature } from 'o1js';
import { ContentHash } from './ContentHash.js';
import {
  AttestorDigest,
  EcdsaSecp256k1,
  Secp256k1,
  attestorCommitment,
  claimCommitment,
} from './ecdsa.js';
import {
  ORIGIN_TYPE_HUMAN,
  ORIGIN_TYPE_HUMAN_ATTESTED,
  OriginProof,
  OriginPublicInput,
} from './OriginProof.js';

const COMPILE_TIMEOUT = 15 * 60 * 1000;
const PROVE_TIMEOUT = 15 * 60 * 1000;

function keccakBytes(input: string): Uint8Array {
  const digest = Keccak.ethereum(Bytes.fromString(input));
  return Uint8Array.from(digest.bytes.map((b) => Number(b.toBigInt())));
}

describe('OriginProof', () => {
  beforeAll(async () => {
    const t0 = performance.now();
    await OriginProof.compile();
    // eslint-disable-next-line no-console
    console.log(
      `[OriginProof] compile: ${((performance.now() - t0) / 1000).toFixed(2)}s`
    );
  }, COMPILE_TIMEOUT);

  describe('proveHuman (wallet-only)', () => {
    it('produces a valid proof binding wallet signature to content hash', async () => {
      const walletKey = PrivateKey.random();
      const walletPubKey = walletKey.toPublicKey();

      const contentHash = ContentHash.fromText(
        'The first content signed by a human on zk-proof-of-origin.'
      );
      const credentialCommitment = Poseidon.hash(walletPubKey.toFields());
      const signature = Signature.create(walletKey, [contentHash.hash]);

      const publicInput = OriginPublicInput.forHuman(
        contentHash,
        credentialCommitment
      );

      const { proof } = await OriginProof.proveHuman(
        publicInput,
        signature,
        walletPubKey
      );

      const ok = await OriginProof.verify(proof);
      expect(ok).toBe(true);
      expect(proof.publicOutput.toBigInt()).toBe(contentHash.hash.toBigInt());
      expect(proof.publicInput.originType.toBigInt()).toBe(
        ORIGIN_TYPE_HUMAN.toBigInt()
      );
    }, PROVE_TIMEOUT);

    it('rejects a signature from a different wallet', async () => {
      const walletKey = PrivateKey.random();
      const attackerKey = PrivateKey.random();
      const walletPubKey = walletKey.toPublicKey();

      const contentHash = ContentHash.fromText('tampered origin');
      const credentialCommitment = Poseidon.hash(walletPubKey.toFields());
      const attackerSig = Signature.create(attackerKey, [contentHash.hash]);

      const publicInput = OriginPublicInput.forHuman(
        contentHash,
        credentialCommitment
      );

      await expect(
        OriginProof.proveHuman(publicInput, attackerSig, walletPubKey)
      ).rejects.toThrow();
    }, PROVE_TIMEOUT);
  });

  describe('proveHumanWithAttestor (wallet + attestor)', () => {
    it('produces a valid proof binding wallet, attestor, and content hash', async () => {
      const walletKey = PrivateKey.random();
      const walletPubKey = walletKey.toPublicKey();
      const contentHash = ContentHash.fromText(
        'Content posted with verified attestor-signed credential.'
      );

      const attestorPriv = Secp256k1.Scalar.random();
      const attestorPubBig = Secp256k1.generator.scale(attestorPriv);
      const attestorPubKey = Secp256k1.from({
        x: attestorPubBig.x.toBigInt(),
        y: attestorPubBig.y.toBigInt(),
      });

      const claimString =
        'github\n{"username":"kvkthecreator"}\n{"contextAddress":"0x0"}';
      const digestBytes = keccakBytes(claimString);
      const claimDigest = AttestorDigest.from(digestBytes);

      const attestorSigBig = EcdsaSecp256k1.sign(
        digestBytes,
        attestorPriv.toBigInt()
      );
      const attestorSig = EcdsaSecp256k1.from({
        r: attestorSigBig.r.toBigInt(),
        s: attestorSigBig.s.toBigInt(),
      });

      const walletSig = Signature.create(walletKey, [contentHash.hash]);

      const credentialCommitment = attestorCommitment(attestorPubKey);
      const claimHashPublic = claimCommitment(digestBytes);

      const publicInput = OriginPublicInput.forHumanAttested(
        contentHash,
        credentialCommitment
      );

      const t0 = performance.now();
      const { proof } = await OriginProof.proveHumanWithAttestor(
        publicInput,
        walletSig,
        walletPubKey,
        attestorSig,
        attestorPubKey,
        claimDigest,
        claimHashPublic
      );
      // eslint-disable-next-line no-console
      console.log(
        `[OriginProof] proveHumanWithAttestor: ${(
          (performance.now() - t0) /
          1000
        ).toFixed(2)}s`
      );

      const ok = await OriginProof.verify(proof);
      expect(ok).toBe(true);
      expect(proof.publicOutput.toBigInt()).toBe(contentHash.hash.toBigInt());
      expect(proof.publicInput.originType.toBigInt()).toBe(
        ORIGIN_TYPE_HUMAN_ATTESTED.toBigInt()
      );
      expect(proof.publicInput.credentialCommitment.toBigInt()).toBe(
        credentialCommitment.toBigInt()
      );
    }, PROVE_TIMEOUT);

    it('rejects a forged attestor signature', async () => {
      const walletKey = PrivateKey.random();
      const walletPubKey = walletKey.toPublicKey();
      const contentHash = ContentHash.fromText('forged attestor');

      const attestorPriv = Secp256k1.Scalar.random();
      const attackerPriv = Secp256k1.Scalar.random();
      const attestorPubBig = Secp256k1.generator.scale(attestorPriv);
      const attestorPubKey = Secp256k1.from({
        x: attestorPubBig.x.toBigInt(),
        y: attestorPubBig.y.toBigInt(),
      });

      const digestBytes = keccakBytes('forged\n{}\n{}');
      const claimDigest = AttestorDigest.from(digestBytes);

      const forgedSigBig = EcdsaSecp256k1.sign(
        digestBytes,
        attackerPriv.toBigInt()
      );
      const forgedSig = EcdsaSecp256k1.from({
        r: forgedSigBig.r.toBigInt(),
        s: forgedSigBig.s.toBigInt(),
      });

      const walletSig = Signature.create(walletKey, [contentHash.hash]);

      const credentialCommitment = attestorCommitment(attestorPubKey);
      const claimHashPublic = claimCommitment(digestBytes);

      const publicInput = OriginPublicInput.forHumanAttested(
        contentHash,
        credentialCommitment
      );

      await expect(
        OriginProof.proveHumanWithAttestor(
          publicInput,
          walletSig,
          walletPubKey,
          forgedSig,
          attestorPubKey,
          claimDigest,
          claimHashPublic
        )
      ).rejects.toThrow();
    }, PROVE_TIMEOUT);
  });
});
