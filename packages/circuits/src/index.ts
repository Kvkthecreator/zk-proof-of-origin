/**
 * zk-proof-of-origin circuits package
 *
 * Exports the OriginProof ZkProgram and related types.
 * Phase 1 human branch binds content hash to a Mina wallet signature;
 * Reclaim HTTPS-claim verification will be added in the next iteration
 * (see docs/analysis/composition-pattern.md).
 */

export { ContentHash } from './ContentHash.js';
export {
  OriginProof,
  OriginProofClass,
  OriginPublicInput,
  ORIGIN_TYPE_HUMAN,
  ORIGIN_TYPE_HUMAN_ATTESTED,
  ORIGIN_TYPE_HUMAN_RECLAIM,
  ORIGIN_TYPE_AI,
  attestorCommitment,
  claimCommitment,
} from './OriginProof.js';
export {
  Secp256k1,
  EcdsaSecp256k1,
  AttestorDigest,
  ATTESTOR_DIGEST_BYTES,
  digestFromBytes,
  ethAddressHexToField,
} from './ecdsa.js';
export {
  RECLAIM_CANONICAL_ATTESTOR_ADDRESS,
  ethAddressFromRecoveredPubKey,
  ethAddressToField,
  parseReclaimSignature,
  prepareReclaimWitness,
  reclaimClaimDigest,
  recoverSecp256k1PubKey,
  type ReclaimClaim,
} from './reclaimClaim.js';