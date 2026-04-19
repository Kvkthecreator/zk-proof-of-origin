import {
  AccountUpdate,
  Field,
  Poseidon,
  PublicKey,
  SmartContract,
  State,
  Struct,
  UInt64,
  method,
  state,
} from 'o1js';
import { OriginProofClass } from './OriginProof.js';

/**
 * Compact per-proof anchoring record we expose on-chain.
 * Anchoring a proof updates:
 *   - lastProofDigest   = Poseidon(contentHash, credentialCommitment, originType, sequence)
 *   - proofCount        += 1
 *   - lastOriginType    = the proof's originType
 *
 * The `sequence` field in the digest is `proofCount` *before* this anchor,
 * giving an append-only monotonic marker. Block time is recorded by the
 * chain itself (tx inclusion block) for verifiers that need absolute time.
 */
export class AnchorRecord extends Struct({
  contentHash: Field,
  credentialCommitment: Field,
  originType: Field,
  sequence: UInt64,
}) {
  digest(): Field {
    return Poseidon.hash([
      this.contentHash,
      this.credentialCommitment,
      this.originType,
      ...this.sequence.toFields(),
    ]);
  }
}

/**
 * Minimal on-chain registry for OriginProof commitments.
 *
 * Design goals:
 *   - Anyone can submit a valid OriginProof; the zkApp verifies it on-chain
 *     and anchors a compact Poseidon digest. Proof inputs never hit the chain.
 *   - State is 4 Field elements total: lastProofDigest, proofCount,
 *     lastOriginType, lastTimestamp. Fits under the 8-Field zkApp state cap
 *     with room to grow.
 *   - `owner` gates a future `reset()` escape hatch; not used by `anchor()`.
 *
 * This contract is intentionally shallow. Serious on-chain provenance would
 * maintain a Merkle root of digests with an append-only witness. That is a
 * post-grant milestone (see DECISIONS.md).
 */
export class ProofCommitmentRegistry extends SmartContract {
  @state(Field) lastProofDigest = State<Field>();
  @state(UInt64) proofCount = State<UInt64>();
  @state(Field) lastOriginType = State<Field>();
  @state(PublicKey) owner = State<PublicKey>();

  init() {
    super.init();
    this.lastProofDigest.set(Field(0));
    this.proofCount.set(UInt64.zero);
    this.lastOriginType.set(Field(0));
    this.owner.set(this.sender.getAndRequireSignature());
  }

  @method async anchor(proof: OriginProofClass) {
    proof.verify();

    const prevCount = this.proofCount.getAndRequireEquals();

    const record = new AnchorRecord({
      contentHash: proof.publicInput.contentHash,
      credentialCommitment: proof.publicInput.credentialCommitment,
      originType: proof.publicInput.originType,
      sequence: prevCount,
    });

    this.lastProofDigest.set(record.digest());
    this.lastOriginType.set(proof.publicInput.originType);
    this.proofCount.set(prevCount.add(UInt64.one));
  }

  /**
   * Owner-gated escape hatch to zero state without redeploying.
   */
  @method async reset() {
    const callerPublicKey = this.sender.getAndRequireSignature();
    const senderUpdate = AccountUpdate.create(callerPublicKey);
    senderUpdate.requireSignature();

    const owner = this.owner.getAndRequireEquals();
    callerPublicKey.equals(owner).assertTrue('only owner can reset');

    this.lastProofDigest.set(Field(0));
    this.proofCount.set(UInt64.zero);
    this.lastOriginType.set(Field(0));
  }

  /**
   * Read-only helper: asserts that a given AnchorRecord matches `lastProofDigest`.
   */
  @method async assertMatchesLatest(record: AnchorRecord) {
    const latest = this.lastProofDigest.getAndRequireEquals();
    record
      .digest()
      .equals(latest)
      .assertTrue('record does not match latest anchor');
  }
}
