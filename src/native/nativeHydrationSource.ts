import type { HydrationEnvelope } from '../hydration';
import type { HydrationSource, HydrationTrigger } from '../provider';
import { extractReqIdFromUrl } from './extractReqId';
import { mapNativeError } from './mapNativeError';
import {
  getNativeHydratorModule,
  requireNativeHydratorModule,
} from './PrismNexusHydratorModule';
import type { NativeHydrationEnvelope } from './types';

export interface NativeHydrationSourceOptions {
  /**
   * When `true`, throws `NATIVE_MODULE_UNAVAILABLE` if the Expo module is not
   * linked. Defaults to `true` for production hydration paths.
   */
  requireNative?: boolean;
}

function toHydrationEnvelope(
  envelope: NativeHydrationEnvelope
): HydrationEnvelope {
  return {
    reqId: envelope.reqId,
    claims: envelope.claims,
    state: envelope.state,
  };
}

/**
 * Production {@link HydrationSource} backed by the Expo native bridge.
 *
 * The native layer owns secure storage, decryption, signature verification,
 * TTL enforcement, and chunk reassembly. This adapter only maps the native
 * envelope into the JS {@link HydrationEnvelope} shape expected by
 * `runHydration`.
 */
export function createNativeHydrationSource(
  options: NativeHydrationSourceOptions = {}
): HydrationSource {
  const requireNative = options.requireNative ?? true;

  return {
    async resolve(
      trigger: HydrationTrigger
    ): Promise<HydrationEnvelope | null> {
      const module = requireNative
        ? requireNativeHydratorModule()
        : getNativeHydratorModule();

      if (module === null) {
        return null;
      }

      try {
        const envelope = await module.resolveEnvelope(trigger);
        return envelope === null ? null : toHydrationEnvelope(envelope);
      } catch (cause) {
        throw mapNativeError(cause);
      }
    },
  };
}

/**
 * Extract a request id from a deep link, preferring the native implementation
 * when available and falling back to the pure-JS parser.
 */
export function extractHydrationReqId(url: string): string | null {
  const module = getNativeHydratorModule();
  if (module !== null) {
    return module.extractReqId(url);
  }
  return extractReqIdFromUrl(url);
}

/** Invoke the native TTL purge sweep. Returns the number of entries removed. */
export async function purgeExpiredHydrationEntries(): Promise<number> {
  const module = requireNativeHydratorModule();
  try {
    return await module.purgeExpired();
  } catch (cause) {
    throw mapNativeError(cause);
  }
}

/** Inspect native ephemeral storage (primarily for `testMode` / diagnostics). */
export async function inspectNativeHydrationStorage(): Promise<{
  stored: string[];
  cached: number;
}> {
  const module = requireNativeHydratorModule();
  try {
    return await module.inspectStorage();
  } catch (cause) {
    throw mapNativeError(cause);
  }
}
