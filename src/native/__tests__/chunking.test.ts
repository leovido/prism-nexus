import { describe, expect, it } from '@jest/globals';
import {
  estimateChunkCount,
  estimateSingleChunkCiphertextBytes,
  NATIVE_CHUNK_PLAINTEXT_SLICE,
  NATIVE_CHUNK_THRESHOLD_BYTES,
  NATIVE_GCM_TAG_BYTES,
  resolvePlaintextSliceSize,
  shouldChunkPlaintext,
} from '../chunking';

describe('chunking threshold', () => {
  it('keeps small payloads in a single chunk', () => {
    const plaintext = NATIVE_CHUNK_THRESHOLD_BYTES - NATIVE_GCM_TAG_BYTES;
    expect(shouldChunkPlaintext(plaintext)).toBe(false);
    expect(resolvePlaintextSliceSize(plaintext)).toBe(plaintext);
    expect(estimateChunkCount(plaintext)).toBe(1);
  });

  it('splits payloads whose single-chunk ciphertext exceeds the threshold', () => {
    const plaintext = NATIVE_CHUNK_THRESHOLD_BYTES;
    expect(shouldChunkPlaintext(plaintext)).toBe(true);
    expect(resolvePlaintextSliceSize(plaintext)).toBe(
      NATIVE_CHUNK_PLAINTEXT_SLICE
    );
    expect(estimateChunkCount(plaintext)).toBe(
      Math.ceil(plaintext / NATIVE_CHUNK_PLAINTEXT_SLICE)
    );
  });

  it('estimates ciphertext as plaintext plus the GCM tag', () => {
    expect(estimateSingleChunkCiphertextBytes(100)).toBe(116);
  });

  it('honours a custom threshold', () => {
    const threshold = 1024;
    expect(shouldChunkPlaintext(900, threshold)).toBe(false);
    expect(shouldChunkPlaintext(1100, threshold)).toBe(true);
  });
});
