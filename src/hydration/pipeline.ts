import { HydrationError } from '../errors';
import { computeDiff } from '../patch';
import type { HydrationClaims } from '../routing';
import { routeContext } from '../routing';
import type { HydrationOptions, HydrationResult } from '../types';
import { assertVersionInRange, validateWithSchema } from '../validation';

/**
 * JS-layer input to the pipeline: the decrypted, reassembled payload handed
 * up by the native bridge. The native layer owns decryption, signature, TTL,
 * and chunk reassembly; the pipeline owns validation, routing, and diffing.
 */
export interface HydrationEnvelope {
  /** Crypto-random request id used for debounce/queue de-duplication. */
  reqId: string;
  /** Unencrypted header claims used for version + context routing. */
  claims: HydrationClaims;
  /** Decoded state payload to validate against the schema. */
  state: unknown;
}

function coerceError(err: unknown): HydrationError {
  return HydrationError.is(err)
    ? err
    : new HydrationError('Unexpected hydration failure', {
        code: 'MALFORMED_PAYLOAD',
        cause: err,
      });
}

/**
 * Pure orchestration for a single hydration attempt.
 *
 * Enforces version bounds, routes the context, validates the payload, then
 * computes the {@link import('../types').DeepPatch} from `base` to the
 * validated state. Never applies the patch — the client owns application
 * timing. On failure, notifies `onError` and returns a typed failure result
 * carrying `base` as the fallback.
 */
export function runHydration<T>(
  envelope: HydrationEnvelope,
  base: Partial<T>,
  options: HydrationOptions<T>
): HydrationResult<T> {
  try {
    assertVersionInRange(
      envelope.claims.v,
      options.minVersion,
      options.maxVersion
    );
    const context = routeContext(envelope.claims);
    const validated = validateWithSchema(options.schema, envelope.state);
    const patch = computeDiff(base as T, validated);
    return {
      ok: true,
      patch,
      version: envelope.claims.v,
      context,
    };
  } catch (err) {
    const error = coerceError(err);
    options.onError?.(error);
    return { ok: false, error, fallback: base };
  }
}

export interface ScheduledRequest<T> {
  reqId: string;
  run: () => Promise<HydrationResult<T>>;
}

/**
 * Serialises overlapping hydration triggers so only the newest `reqId` is
 * applied. When an in-flight request resolves after a newer one was submitted,
 * its result is discarded and reported via `onWarn` (a stale request), never
 * delivered to `onResult`.
 */
export class HydrationQueue<T> {
  private latestReqId: string | null = null;

  constructor(
    private readonly onResult: (result: HydrationResult<T>) => void,
    private readonly onWarn?: (msg: string) => void
  ) {}

  async submit(request: ScheduledRequest<T>): Promise<void> {
    this.latestReqId = request.reqId;
    const result = await request.run();
    if (this.latestReqId !== request.reqId) {
      this.onWarn?.(`Discarded stale hydration request: ${request.reqId}`);
      return;
    }
    this.onResult(result);
  }
}
