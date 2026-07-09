/** AES-GCM authentication tag size appended to each encrypted chunk. */
export const NATIVE_GCM_TAG_BYTES = 16;

/** Plaintext slice size once multi-chunk transport is required. */
export const NATIVE_CHUNK_PLAINTEXT_SLICE = 4096;

/** Default encrypted-payload threshold before multi-chunk transport (20 KiB). */
export const NATIVE_CHUNK_THRESHOLD_BYTES = 20 * 1024;

/** Default async reassembly timeout passed to the native worker (30s). */
export const NATIVE_REASSEMBLY_TIMEOUT_MS = 30_000;

/**
 * Estimate ciphertext bytes for a single AES-GCM chunk sealing `plaintextBytes`
 * of state (plaintext + authentication tag).
 */
export function estimateSingleChunkCiphertextBytes(
  plaintextBytes: number
): number {
  return plaintextBytes + NATIVE_GCM_TAG_BYTES;
}

/**
 * Whether plaintext should be split into transport chunks. Payloads whose
 * single-chunk ciphertext fits within `threshold` stay as one chunk; larger
 * payloads are sliced at {@link NATIVE_CHUNK_PLAINTEXT_SLICE}.
 */
export function shouldChunkPlaintext(
  plaintextBytes: number,
  threshold = NATIVE_CHUNK_THRESHOLD_BYTES
): boolean {
  return estimateSingleChunkCiphertextBytes(plaintextBytes) > threshold;
}

/**
 * Plaintext bytes per transport chunk for a payload of `plaintextBytes`.
 * Returns the full payload size when chunking is not required.
 */
export function resolvePlaintextSliceSize(
  plaintextBytes: number,
  threshold = NATIVE_CHUNK_THRESHOLD_BYTES
): number {
  if (plaintextBytes <= 0) {
    return 0;
  }
  if (!shouldChunkPlaintext(plaintextBytes, threshold)) {
    return plaintextBytes;
  }
  return NATIVE_CHUNK_PLAINTEXT_SLICE;
}

/** Expected transport chunk count after sealing `plaintextBytes`. */
export function estimateChunkCount(
  plaintextBytes: number,
  threshold = NATIVE_CHUNK_THRESHOLD_BYTES
): number {
  if (plaintextBytes <= 0) {
    return 0;
  }
  const slice = resolvePlaintextSliceSize(plaintextBytes, threshold);
  return Math.ceil(plaintextBytes / slice);
}
