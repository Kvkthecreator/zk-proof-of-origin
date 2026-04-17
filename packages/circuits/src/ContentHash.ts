import { Field, Poseidon, Struct } from 'o1js';

/**
 * ContentHash — Poseidon hash of arbitrary content.
 *
 * This is the content's identity inside the zk circuit.
 * All origin proofs bind to a ContentHash, regardless of
 * whether the origin is human (Branch A) or AI (Branch B).
 *
 * Phase 0: text-only hashing (UTF-8 bytes → Field elements → Poseidon).
 * Future: chunked hashing for images/video via Merkle tree.
 */
export class ContentHash extends Struct({
  hash: Field,
}) {
  /**
   * Hash a string of text content.
   * Converts UTF-8 string to Field elements, then applies Poseidon.
   */
  static fromText(text: string): ContentHash {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    // Pack bytes into Field elements (31 bytes per Field to stay under the prime)
    const fields: Field[] = [];
    for (let i = 0; i < bytes.length; i += 31) {
      const chunk = bytes.slice(i, i + 31);
      let value = BigInt(0);
      for (let j = 0; j < chunk.length; j++) {
        value = value * BigInt(256) + BigInt(chunk[j]);
      }
      fields.push(Field(value));
    }

    // Poseidon hash all field elements
    const hash = Poseidon.hash(fields);
    return new ContentHash({ hash });
  }

  /**
   * Hash raw bytes (for images, files, etc. — future use).
   */
  static fromBytes(bytes: Uint8Array): ContentHash {
    const fields: Field[] = [];
    for (let i = 0; i < bytes.length; i += 31) {
      const chunk = bytes.slice(i, i + 31);
      let value = BigInt(0);
      for (let j = 0; j < chunk.length; j++) {
        value = value * BigInt(256) + BigInt(chunk[j]);
      }
      fields.push(Field(value));
    }

    const hash = Poseidon.hash(fields);
    return new ContentHash({ hash });
  }

  assertEquals(other: ContentHash) {
    this.hash.assertEquals(other.hash);
  }
}