/**
 * Canonical taxonomy of hydration failure codes.
 *
 * Codes are stable string identifiers so that clients can branch on
 * `error.code` without depending on message text. New codes may be added in
 * minor releases; existing codes never change meaning.
 */
export const HYDRATION_ERROR_CODES = [
  'SCHEMA_VERSION_MISMATCH',
  'SCHEMA_VALIDATION_FAILED',
  'SIGNATURE_INVALID',
  'DECRYPTION_FAILED',
  'CHUNK_CORRUPTION',
  'CHUNK_SEQUENCE_GAP',
  'REASSEMBLY_TIMEOUT',
  'TTL_EXPIRED',
  'STORAGE_QUOTA_EXCEEDED',
  'CONTEXT_ROUTING_FAILED',
  'NATIVE_MODULE_UNAVAILABLE',
  'STALE_REQUEST',
  'MALFORMED_PAYLOAD',
] as const;

export type HydrationErrorCode = (typeof HYDRATION_ERROR_CODES)[number];

export interface HydrationErrorOptions {
  /** Machine-readable, stable failure code. */
  code: HydrationErrorCode;
  /** Optional structured detail for diagnostics (never logged by the SDK). */
  details?: Readonly<Record<string, unknown>>;
  /** Underlying error, preserved for `onError` handlers. */
  cause?: unknown;
}

/**
 * Error raised for every hydration failure. Carries a stable {@link HydrationErrorCode}
 * so callers can react without string matching. The SDK never logs; it surfaces
 * these to the client via `onError`.
 */
export class HydrationError extends Error {
  readonly code: HydrationErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(message: string, options: HydrationErrorOptions) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined
    );
    this.name = 'HydrationError';
    this.code = options.code;
    this.details = options.details;

    // Restore prototype chain for reliable `instanceof` across transpile targets.
    Object.setPrototypeOf(this, HydrationError.prototype);
  }

  static is(value: unknown): value is HydrationError {
    return value instanceof HydrationError;
  }
}
