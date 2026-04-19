import { beforeAll, describe, expect, it } from 'vitest';
import {
  AccountUpdate,
  Field,
  Mina,
  PrivateKey,
  Poseidon,
  PublicKey,
  Signature,
  UInt64,
} from 'o1js';
import { ContentHash } from './ContentHash.js';
import {
  ORIGIN_TYPE_HUMAN,
  OriginProof,
  OriginPublicInput,
} from './OriginProof.js';
import {
  AnchorRecord,
  ProofCommitmentRegistry,
} from './ProofCommitmentRegistry.js';

const TIMEOUT = 15 * 60 * 1000;

describe('ProofCommitmentRegistry', () => {
  let deployer: Mina.TestPublicKey;
  let deployerKey: PrivateKey;
  let zkAppKey: PrivateKey;
  let zkAppAddr: PublicKey;
  let zkApp: ProofCommitmentRegistry;

  beforeAll(async () => {
    await OriginProof.compile();
    await ProofCommitmentRegistry.compile();

    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    deployer = Local.testAccounts[0];
    deployerKey = deployer.key;
    zkAppKey = PrivateKey.random();
    zkAppAddr = zkAppKey.toPublicKey();
    zkApp = new ProofCommitmentRegistry(zkAppAddr);

    const tx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await zkApp.deploy();
    });
    await tx.prove();
    await tx.sign([deployerKey, zkAppKey]).send();
  }, TIMEOUT);

  it('initializes with zeroed anchors and deployer-as-owner', () => {
    expect(zkApp.lastProofDigest.get().toBigInt()).toBe(0n);
    expect(zkApp.proofCount.get().toBigInt()).toBe(0n);
    expect(zkApp.lastOriginType.get().toBigInt()).toBe(0n);
    expect(zkApp.owner.get().toBase58()).toBe(deployer.toBase58());
  });

  it('anchors a valid wallet-only OriginProof and increments the counter', async () => {
    const walletKey = PrivateKey.random();
    const walletPubKey = walletKey.toPublicKey();
    const contentHash = ContentHash.fromText(
      'anchored content: hello Mina devnet'
    );
    const credentialCommitment = Poseidon.hash(walletPubKey.toFields());
    const walletSig = Signature.create(walletKey, [contentHash.hash]);

    const publicInput = OriginPublicInput.forHuman(
      contentHash,
      credentialCommitment
    );
    const { proof } = await OriginProof.proveHuman(
      publicInput,
      walletSig,
      walletPubKey
    );

    const tx = await Mina.transaction(deployer, async () => {
      await zkApp.anchor(proof);
    });
    await tx.prove();
    await tx.sign([deployerKey]).send();

    expect(zkApp.proofCount.get().toBigInt()).toBe(1n);
    expect(zkApp.lastOriginType.get().toBigInt()).toBe(
      ORIGIN_TYPE_HUMAN.toBigInt()
    );

    const record = new AnchorRecord({
      contentHash: contentHash.hash,
      credentialCommitment,
      originType: ORIGIN_TYPE_HUMAN,
      sequence: UInt64.zero,
    });
    const expectedDigest = record.digest();
    expect(zkApp.lastProofDigest.get().toBigInt()).toBe(
      expectedDigest.toBigInt()
    );
  }, TIMEOUT);

  it('assertMatchesLatest rejects a stale record', async () => {
    const record = new AnchorRecord({
      contentHash: Field(0),
      credentialCommitment: Field(0),
      originType: Field(0),
      sequence: UInt64.zero,
    });
    await expect(
      (async () => {
        const tx = await Mina.transaction(deployer, async () => {
          await zkApp.assertMatchesLatest(record);
        });
        await tx.prove();
      })()
    ).rejects.toThrow();
  }, TIMEOUT);
});
