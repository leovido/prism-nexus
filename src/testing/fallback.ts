import type { HydrationResult } from '../types';

/**
 * Merge a failed hydration's `fallback` partial into `current`, emitting an
 * explicit warning so callers never silently ignore {@link HydrationError}s.
 */
export function mergeHydrationFallback<T extends object>(
  current: T,
  result: Extract<HydrationResult<T>, { ok: false }>,
  onWarn?: (message: string) => void
): T {
  onWarn?.(
    `[Hydrator] Applying fallback after ${result.error.code}: ${result.error.message}`
  );
  return { ...current, ...result.fallback };
}

/**
 * Route a {@link HydrationResult} to success or fallback handlers. Use inside
 * `onHydrate` to keep failure handling explicit and warning-backed.
 */
export function resolveHydrationResult<T extends object>(
  current: T,
  result: HydrationResult<T>,
  handlers: {
    onSuccess: (patch: Extract<HydrationResult<T>, { ok: true }>) => T;
    onWarn?: (message: string) => void;
  }
): T {
  if (result.ok) {
    return handlers.onSuccess(result);
  }
  return mergeHydrationFallback(current, result, handlers.onWarn);
}
