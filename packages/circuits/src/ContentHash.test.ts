import { describe, it, expect } from 'vitest';
import { ContentHash } from './ContentHash.js';

describe('ContentHash', () => {
  it('produces a deterministic hash for the same text', () => {
    const a = ContentHash.fromText('hello world');
    const b = ContentHash.fromText('hello world');
    expect(a.hash.toBigInt()).toBe(b.hash.toBigInt());
  });

  it('produces different hashes for different text', () => {
    const a = ContentHash.fromText('hello world');
    const b = ContentHash.fromText('goodbye world');
    expect(a.hash.toBigInt()).not.toBe(b.hash.toBigInt());
  });

  it('handles empty string', () => {
    const h = ContentHash.fromText('');
    expect(h.hash.toBigInt()).toBeDefined();
  });

  it('handles long text (multiple Field chunks)', () => {
    const longText = 'a'.repeat(1000);
    const h = ContentHash.fromText(longText);
    expect(h.hash.toBigInt()).toBeDefined();
  });

  it('fromBytes produces same hash as fromText for ASCII', () => {
    const text = 'test content';
    const bytes = new TextEncoder().encode(text);
    const fromText = ContentHash.fromText(text);
    const fromBytes = ContentHash.fromBytes(bytes);
    expect(fromText.hash.toBigInt()).toBe(fromBytes.hash.toBigInt());
  });
});