import { beforeAll, describe, expect, it } from 'vitest';
import { Bytes, Field, Keccak, Poseidon } from 'o1js';
import {
  ClaimDigest,
  EcdsaAttestorPublicInput,
  EcdsaAttestorSpike,
  EcdsaSecp256k1,
  Secp256k1,
} from './EcdsaAttestor.js';

const COMPILE_TIMEOUT = 15 * 60 * 1000;
const PROVE_TIMEOUT = 15 * 60 * 1000;

describe('EcdsaAttestorSpike', () => {
  let compileMs: number;

  beforeAll(async () => {
    const t0 = performance.now();
    await EcdsaAttestorSpike.compile();
    compileMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[spike] compile: ${(compileMs / 1000).toFixed(2)}s`);
  }, COMPILE_TIMEOUT);

  it('produces a valid proof for a genuine attestor signature', async () => {
    const attestorPriv = Secp256k1.Scalar.random();
    const attestorPubBig = Secp256k1.generator.scale(attestorPriv);

    const messageString =
      'provider=github\nparameters={"username":"example"}\ncontext={"contextAddress":"0x0"}';
    const messageBytes = new TextEncoder().encode(messageString);
    const digest = Keccak.ethereum(Bytes.from(messageBytes));
    const digestBytes = Uint8Array.from(
      digest.bytes.map((b) => Number(b.toBigInt()))
    );
    const claimDigest = ClaimDigest.from(digestBytes);

    const signatureBig = EcdsaSecp256k1.sign(
      digestBytes,
      attestorPriv.toBigInt()
    );

    const attestorPubKey = Secp256k1.from({
      x: attestorPubBig.x.toBigInt(),
      y: attestorPubBig.y.toBigInt(),
    });
    const signature = EcdsaSecp256k1.from({
      r: signatureBig.r.toBigInt(),
      s: signatureBig.s.toBigInt(),
    });

    const attestorCommitment = Poseidon.hash([
      ...attestorPubKey.x.value,
      ...attestorPubKey.y.value,
    ] as Field[]);
    const claimHash = Poseidon.hash(
      Array.from(digestBytes).map((b) => Field(b))
    );

    const publicInput = new EcdsaAttestorPublicInput({
      attestorCommitment,
      claimHash,
    });

    const t0 = performance.now();
    const { proof } = await EcdsaAttestorSpike.verifyAttestor(
      publicInput,
      signature,
      attestorPubKey,
      claimDigest
    );
    const proveMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[spike] prove: ${(proveMs / 1000).toFixed(2)}s`);

    const t1 = performance.now();
    const ok = await EcdsaAttestorSpike.verify(proof);
    const verifyMs = performance.now() - t1;
    // eslint-disable-next-line no-console
    console.log(`[spike] verify: ${(verifyMs / 1000).toFixed(2)}s`);

    expect(ok).toBe(true);
    expect(proof.publicOutput.toBigInt()).toBe(attestorCommitment.toBigInt());
  }, PROVE_TIMEOUT);

  it('rejects a signature from a wrong key', async () => {
    const realPriv = Secp256k1.Scalar.random();
    const realPubBig = Secp256k1.generator.scale(realPriv);
    const attackerPriv = Secp256k1.Scalar.random();

    const messageBytes = new TextEncoder().encode('tampered claim');
    const digest = Keccak.ethereum(Bytes.from(messageBytes));
    const digestBytes = Uint8Array.from(
      digest.bytes.map((b) => Number(b.toBigInt()))
    );
    const claimDigest = ClaimDigest.from(digestBytes);

    const wrongSignatureBig = EcdsaSecp256k1.sign(
      digestBytes,
      attackerPriv.toBigInt()
    );

    const attestorPubKey = Secp256k1.from({
      x: realPubBig.x.toBigInt(),
      y: realPubBig.y.toBigInt(),
    });
    const signature = EcdsaSecp256k1.from({
      r: wrongSignatureBig.r.toBigInt(),
      s: wrongSignatureBig.s.toBigInt(),
    });

    const attestorCommitment = Poseidon.hash([
      ...attestorPubKey.x.value,
      ...attestorPubKey.y.value,
    ] as Field[]);
    const claimHash = Poseidon.hash(
      Array.from(digestBytes).map((b) => Field(b))
    );

    const publicInput = new EcdsaAttestorPublicInput({
      attestorCommitment,
      claimHash,
    });

    await expect(
      EcdsaAttestorSpike.verifyAttestor(
        publicInput,
        signature,
        attestorPubKey,
        claimDigest
      )
    ).rejects.toThrow();
  }, PROVE_TIMEOUT);
});
