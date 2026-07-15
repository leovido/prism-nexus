import { useCallback, useEffect, useRef } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';
import { HydrationQueue } from '../hydration';
import type { HydrationOptions } from '../types';
import type { HydrationSource, HydrationTrigger } from './dispatch';
import { createHydrationDispatch } from './dispatch';

export interface HydratorControllerConfig<T> extends HydrationOptions<T> {
  /** Bridge/mocked source of hydration payloads. */
  source: HydrationSource;
  /** Current base state to diff against; defaults to an empty object. */
  getBaseState?: () => Partial<T>;
}

export interface HydratorController {
  /** Imperatively trigger a hydration attempt (the `hydrateNow()` API). */
  hydrateNow: () => void;
}

/**
 * Wires hydration triggers to React lifecycle: an initial `appLaunch` attempt,
 * a foreground (`background`/`inactive` -> `active`) subscription with cleanup,
 * and an imperative `hydrateNow`. Config is read through a ref so callback and
 * source changes never resubscribe or recreate the request queue.
 */
export function useHydrationController<T>(
  config: HydratorControllerConfig<T>
): HydratorController {
  const configRef = useRef(config);
  configRef.current = config;

  const queueRef = useRef<HydrationQueue<T> | null>(null);
  const inFlightRef = useRef(false);
  const pendingTriggerRef = useRef<HydrationTrigger | null>(null);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  if (queueRef.current === null) {
    queueRef.current = new HydrationQueue<T>(
      (result) => configRef.current.onHydrate(result),
      (msg) => configRef.current.onWarn?.(msg)
    );
  }

  const dispatch = useCallback((trigger: HydrationTrigger) => {
    const cfg = configRef.current;
    const run = createHydrationDispatch<T>({
      source: cfg.source,
      getBaseState: cfg.getBaseState ?? (() => ({})),
      options: cfg,
      queue: queueRef.current as HydrationQueue<T>,
    });
    return run(trigger);
  }, []);

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const coalescedDispatch = useCallback((trigger: HydrationTrigger) => {
    if (inFlightRef.current) {
      pendingTriggerRef.current = trigger;
      return inFlightPromiseRef.current ?? Promise.resolve();
    }

    inFlightRef.current = true;
    const loop = async () => {
      let current: HydrationTrigger | null = trigger;
      while (current !== null) {
        await dispatchRef.current(current);
        current = pendingTriggerRef.current;
        pendingTriggerRef.current = null;
      }
    };
    const promise = loop().finally(() => {
      inFlightRef.current = false;
      inFlightPromiseRef.current = null;
    });
    inFlightPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    coalescedDispatch('appLaunch').catch(() => undefined);
  }, [coalescedDispatch]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        const cameToForeground =
          (previous === 'background' || previous === 'inactive') &&
          next === 'active';
        previous = next;
        if (cameToForeground) {
          coalescedDispatch('appStateActive').catch(() => undefined);
        }
      }
    );
    return () => subscription.remove();
  }, [coalescedDispatch]);

  const hydrateNow = useCallback(() => {
    coalescedDispatch('manual').catch(() => undefined);
  }, [coalescedDispatch]);

  return { hydrateNow };
}
