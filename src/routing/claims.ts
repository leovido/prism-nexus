import { HydrationError } from '../errors';
import type { HydrationContext } from '../types';

/** All routable hydration contexts, in precedence order. */
export const HYDRATION_CONTEXTS: readonly HydrationContext[] = [
  'session',
  'guest',
  'ephemeral',
];

/**
 * Unencrypted payload header claims used purely for routing. Routing never
 * reads URL query parameters; only these signed claims decide the context.
 */
export interface HydrationClaims {
  /** Schema version of the payload. */
  v: number;
  /** Creation timestamp (unix seconds). */
  ts: number;
  /** Target context. */
  ctx: string;
  /** Key id used to select the decryption key. */
  kid: string;
}

export function isHydrationContext(value: unknown): value is HydrationContext {
  return (
    typeof value === 'string' &&
    (HYDRATION_CONTEXTS as readonly string[]).includes(value)
  );
}

/**
 * Resolve the {@link HydrationContext} from payload claims. Throws
 * {@link HydrationError} with `CONTEXT_ROUTING_FAILED` when the `ctx` claim is
 * missing or unrecognised — there is no default context.
 */
export function routeContext(
  claims: Pick<HydrationClaims, 'ctx'>
): HydrationContext {
  if (!isHydrationContext(claims.ctx)) {
    throw new HydrationError(
      `Unroutable hydration context: ${JSON.stringify(claims.ctx)}`,
      {
        code: 'CONTEXT_ROUTING_FAILED',
        details: { ctx: claims.ctx, allowed: HYDRATION_CONTEXTS },
      }
    );
  }
  return claims.ctx;
}
