import type { HydrationError } from './errors';

/**
 * Where a hydration payload is applied. Routed via signed payload claims,
 * never via URL query parameters.
 */
export type HydrationContext = 'session' | 'guest' | 'ephemeral';

/**
 * A single RFC 6902 JSON Patch operation. `T` is a phantom type used to keep
 * patches associated with their target state shape at call sites.
 */
export interface DeepPatch<T = unknown> {
  op: 'replace' | 'add' | 'remove';
  /** JSON Pointer (RFC 6901) into the target document. */
  path: string;
  /** Present for `add` and `replace`; omitted for `remove`. */
  value?: unknown;
  /**
   * Phantom marker binding a patch to its target state shape `T`. Never emitted
   * at runtime; exists only so `DeepPatch<T>` stays associated with `T`.
   */
  readonly __state?: T;
}

/**
 * Validates and narrows unknown input into `T`. `zod`'s `ZodType` satisfies
 * this structurally via its `parse` method, so schemas can be passed directly.
 */
export interface SchemaValidator<T> {
  parse(input: unknown): T;
}

/** User-supplied resolver for merging a decoded patch into current state. */
export type CustomResolver<T> = (current: T, patch: DeepPatch<T>[]) => T;

/** Conflict-resolution strategy applied by the client, not the SDK. */
export type MergeStrategy<T> =
  | 'deep-merge'
  | 'last-write-wins'
  | CustomResolver<T>;

/**
 * Result handed to `onHydrate`. A discriminated union on `ok`: success carries
 * a patch to apply, failure carries a typed error plus a partial fallback.
 */
export type HydrationResult<T> =
  | {
      ok: true;
      patch: DeepPatch<T>[];
      version: number;
      context: HydrationContext;
      warnings?: string[];
    }
  | {
      ok: false;
      error: HydrationError;
      fallback: Partial<T>;
    };

/** Declarative configuration for a hydration pipeline. */
export interface HydrationOptions<T> {
  /** Schema used to validate the decoded payload (e.g. a `zod` schema). */
  schema: SchemaValidator<T>;
  /** Lowest accepted payload schema version (inclusive). */
  minVersion: number;
  /** Highest accepted payload schema version (inclusive). */
  maxVersion: number;
  /** Merge strategy hint surfaced to the client; defaults to `deep-merge`. */
  strategy?: MergeStrategy<T>;
  /** Byte threshold above which payloads are chunked. Defaults to 20 KiB. */
  chunkThreshold?: number;
  /** Invoked exactly once per resolved hydration attempt. */
  onHydrate: (result: HydrationResult<T>) => void;
  /** Non-fatal diagnostics (e.g. stale request discarded). */
  onWarn?: (msg: string) => void;
  /** Fatal diagnostics. Mirrors the `error` on a failed result. */
  onError?: (err: HydrationError) => void;
  /** Enables inspection middleware and skips TTL/cleanup. */
  testMode?: boolean;
}

/** Default chunking threshold: 20 KiB of encrypted payload. */
export const DEFAULT_CHUNK_THRESHOLD = 20 * 1024;
