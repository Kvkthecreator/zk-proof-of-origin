import { beforeAll, describe, expect, it } from 'vitest';
import { Field, PrivateKey, Signature } from 'o1js';
import { ContentHash } from './ContentHash.js';
import {
  AttestorDigest,
  EcdsaSecp256k1,
  Secp256k1,
} from './ecdsa.js';
import {
  ORIGIN_TYPE_HUMAN_RECLAIM,
  OriginProof,
  OriginPublicInput,
} from './OriginProof.js';
import {
  claimCommitment,
} from './OriginProof.js';
import {
  ethAddressFromRecoveredPubKey,
  ethAddressToField,
  prepareReclaimWitness,
  reclaimClaimDigest,
  recoverSecp256k1PubKey,
} from './reclaimClaim.js';

const COMPILE_TIMEOUT = 15 * 60 * 1000;
const PROVE_TIMEOUT = 15 * 60 * 1000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('OriginProof.proveHumanWithReclaimAttestor', () => {
  beforeAll(async () => {
    const t0 = performance.now();
    await OriginProof.compile();
    // eslint-disable-next-line no-console
    console.log(
      `[OriginProof+Reclaim] compile: ${((performance.now() - t0) / 1000).toFixed(2)}s`
    );
  }, COMPILE_TIMEOUT);

  it('ecrecover round-trips: sign → recover → Ethereum address matches', () => {
    const attestorPriv = Secp256k1.Scalar.random();
    const attestorPubBig = Secp256k1.generator.scale(attestorPriv);
    const pubKey = Secp256k1.from({
      x: attestorPubBig.x.toBigInt(),
      y: attestorPubBig.y.toBigInt(),
    });

    const claim = {
      provider: 'github',
      parameters: '{"username":"kvkthecreator"}',
      context: '{"contextAddress":"0x0"}',
    };
    const digest = reclaimClaimDigest(claim);

    const sigBig = EcdsaSecp256k1.signHash(
      AttestorDigest.from(digest),
      attestorPriv.toBigInt()
    );
    const r = sigBig.r.toBigInt();
    const s = sigBig.s.toBigInt();

    // Test both recovery IDs — one will match, one won't
    for (const v of [27, 28]) {
      try {
        const recovered = recoverSecp256k1PubKey(digest, { r, s, v });
        if (
          recovered.x === pubKey.x.toBigInt() &&
          recovered.y === pubKey.y.toBigInt()
        ) {
          const expectedAddr = ethAddressFromRecoveredPubKey({
            x: pubKey.x.toBigInt(),
            y: pubKey.y.toBigInt(),
          });
          const recoveredAddr = ethAddressFromRecoveredPubKey(recovered);
          expect(recoveredAddr).toBe(expectedAddr);
          return;
        }
      } catch {
        // try next v
      }
    }
    throw new Error('no recovery id produced the correct pubkey');
  });

  it('generates a full Reclaim-style proof binding Ethereum attestor address', async () => {
    const walletKey = PrivateKey.random();
    const walletPubKey = walletKey.toPublicKey();

    const attestorPriv = Secp256k1.Scalar.random();
    const attestorPubBig = Secp256k1.generator.scale(attestorPriv);
    const attestorPubKey = Secp256k1.from({
      x: attestorPubBig.x.toBigInt(),
      y: attestorPubBig.y.toBigInt(),
    });
    const attestorAddress = ethAddressFromRecoveredPubKey({
      x: attestorPubKey.x.toBigInt(),
      y: attestorPubKey.y.toBigInt(),
    });
    const attestorAddressHex =
      '0x' + attestorAddress.toString(16).padStart(40, '0');

    const claim = {
      provider: 'github',
      parameters: '{"username":"kvkthecreator"}',
      context: '{"contextAddress":"0x0","extractedParameters":{"username":"kvkthecreator"}}',
    };
    const digest = reclaimClaimDigest(claim);

    const sigBig = EcdsaSecp256k1.signHash(
      AttestorDigest.from(digest),
      attestorPriv.toBigInt()
    );
    const attestorSig = EcdsaSecp256k1.from({
      r: sigBig.r.toBigInt(),
      s: sigBig.s.toBigInt(),
    });

    const contentHash = ContentHash.fromText(
      'Verified-human content signed with a real Reclaim-shaped attestor claim.'
    );
    const walletSig = Signature.create(walletKey, [contentHash.hash]);

    const claimDigest = AttestorDigest.from(digest);
    const claimHashPublic = claimCommitment(digest);

    const publicInput = OriginPublicInput.forHumanReclaim(
      contentHash,
      ethAddressToField(attestorAddressHex)
    );

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
    // eslint-disable-next-line no-console
    console.log(
      `[OriginProof+Reclaim] prove: ${(
        (performance.now() - t0) /
        1000
      ).toFixed(2)}s`
    );

    const ok = await OriginProof.verify(proof);
    expect(ok).toBe(true);
    expect(proof.publicInput.originType.toBigInt()).toBe(
      ORIGIN_TYPE_HUMAN_RECLAIM.toBigInt()
    );
    expect(proof.publicInput.credentialCommitment.toBigInt()).toBe(
      attestorAddress
    );
    expect(proof.publicOutput.toBigInt()).toBe(contentHash.hash.toBigInt());
  }, PROVE_TIMEOUT);

  it('prepareReclaimWitness validates and shapes a full ReclaimClaim → prover-ready bundle', () => {
    const attestorPriv = Secp256k1.Scalar.random();
    const attestorPubBig = Secp256k1.generator.scale(attestorPriv);
    const attestorAddress = ethAddressFromRecoveredPubKey({
      x: attestorPubBig.x.toBigInt(),
      y: attestorPubBig.y.toBigInt(),
    });
    const attestorAddressHex =
      '0x' + attestorAddress.toString(16).padStart(40, '0');

    const claim = {
      provider: 'github',
      parameters: '{"username":"kvkthecreator"}',
      context: '{}',
    };
    const digest = reclaimClaimDigest(claim);
    const sigBig = EcdsaSecp256k1.signHash(
      AttestorDigest.from(digest),
      attestorPriv.toBigInt()
    );

    // Try both recovery ids to produce a full Ethereum-style signature string
    let signatureHex: string | null = null;
    for (const v of [27, 28]) {
      const sigHex =
        '0x' +
        bytesToHex(
          Uint8Array.from([
            ...hexToBytes(
              sigBig.r.toBigInt().toString(16).padStart(64, '0')
            ),
            ...hexToBytes(
              sigBig.s.toBigInt().toString(16).padStart(64, '0')
            ),
            v,
          ])
        );
      try {
        const bundle = prepareReclaimWitness(
          { ...claim, signature: sigHex },
          attestorAddressHex
        );
        signatureHex = sigHex;
        expect(bundle.attestorAddressField).toBeInstanceOf(Field);
        expect(bundle.digest.length).toBe(32);
        expect(bundle.signature.r).toBe(sigBig.r.toBigInt());
        expect(bundle.signature.s).toBe(sigBig.s.toBigInt());
        break;
      } catch {
        // try next v
      }
    }
    expect(signatureHex).not.toBeNull();
  });

  it('prepareReclaimWitness throws on a mismatched expected address', () => {
    const attestorPriv = Secp256k1.Scalar.random();
    const digest = reclaimClaimDigest({
      provider: 'x',
      parameters: '{}',
      context: '{}',
    });
    const sigBig = EcdsaSecp256k1.signHash(
      AttestorDigest.from(digest),
      attestorPriv.toBigInt()
    );
    const sigHex =
      '0x' +
      sigBig.r.toBigInt().toString(16).padStart(64, '0') +
      sigBig.s.toBigInt().toString(16).padStart(64, '0') +
      '1b';

    expect(() =>
      prepareReclaimWitness(
        {
          provider: 'x',
          parameters: '{}',
          context: '{}',
          signature: sigHex,
        },
        '0x0000000000000000000000000000000000000000'
      )
    ).toThrow();
  });
});

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}
