import { HydrationError } from '../errors';
import type { HydrationEnvelope, HydrationQueue } from '../hydration';
import { runHydration } from '../hydration';
import type { HydrationOptions } from '../types';

/** What caused a hydration attempt. */
export type HydrationTrigger = 'appLaunch' | 'appStateActive' | 'manual';

/**
 * Supplies decrypted, reassembled payloads for a trigger. Implemented by the
 * native bridge in production and by mocks/tests otherwise. Returning `null`
 * means "nothing to hydrate" and is a normal, silent outcome.
 */
export interface HydrationSource {
  resolve(trigger: HydrationTrigger): Promise<HydrationEnvelope | null>;
}

export interface HydrationDispatchDeps<T> {
  source: HydrationSource;
  getBaseState: () => Partial<T>;
  options: HydrationOptions<T>;
  queue: HydrationQueue<T>;
}

/**
 * Build the trigger handler shared by the provider's lifecycle effects.
 *
 * Resolves an envelope from the source, then routes it through the queue so
 * only the newest request is applied. Source-resolution failures are surfaced
 * as a typed failure result (via `onHydrate`/`onError`); a `null` envelope is
 * a no-op. This function is pure with respect to React and unit-testable.
 */
export function createHydrationDispatch<T>(deps: HydrationDispatchDeps<T>) {
  const { source, getBaseState, options, queue } = deps;

  return async function dispatch(trigger: HydrationTrigger): Promise<void> {
    const attempt = queue.beginAttempt();
    const base = getBaseState();
    let envelope: HydrationEnvelope | null;
    try {
      envelope = await source.resolve(trigger);
    } catch (cause) {
      if (!queue.isCurrentAttempt(attempt)) {
        return;
      }
      const error = HydrationError.is(cause)
        ? cause
        : new HydrationError('Hydration source failed to resolve', {
            code: 'MALFORMED_PAYLOAD',
            cause,
          });
      options.onError?.(error);
      options.onHydrate({ ok: false, error, fallback: base });
      return;
    }

    if (!queue.isCurrentAttempt(attempt)) {
      if (envelope !== null) {
        options.onWarn?.(
          `Discarded stale hydration request: ${envelope.reqId}`
        );
      }
      return;
    }

    if (envelope === null) {
      return;
    }

    const resolved = envelope;
    await queue.submit(
      {
        reqId: resolved.reqId,
        run: async () => runHydration(resolved, base, options),
      },
      attempt
    );
  };
}
