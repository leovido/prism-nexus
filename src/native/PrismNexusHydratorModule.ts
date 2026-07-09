import { requireNativeModule } from 'expo-modules-core';
import { HydrationError } from '../errors';
import type { PrismNexusHydratorNativeSpec } from './types';

const MODULE_NAME = 'PrismNexusHydrator';

let cachedModule: PrismNexusHydratorNativeSpec | null | undefined;

/** Reset the module cache. Intended for tests only. */
export function __resetNativeHydratorModuleCacheForTests(): void {
  cachedModule = undefined;
}

/**
 * Lazily load the Expo native module. Returns `null` when autolinking did not
 * register the module (e.g. web, Jest, or a non-Expo host).
 */
export function getNativeHydratorModule(): PrismNexusHydratorNativeSpec | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  try {
    cachedModule =
      requireNativeModule<PrismNexusHydratorNativeSpec>(MODULE_NAME);
    return cachedModule;
  } catch {
    cachedModule = null;
    return null;
  }
}

/** Whether the Expo hydrator native module is linked and loadable. */
export function isNativeHydratorAvailable(): boolean {
  return getNativeHydratorModule()?.isAvailable() ?? false;
}

/**
 * Require the native module or throw {@link HydrationError} with
 * `NATIVE_MODULE_UNAVAILABLE`. Use in production hydration paths.
 */
export function requireNativeHydratorModule(): PrismNexusHydratorNativeSpec {
  const module = getNativeHydratorModule();
  if (module === null) {
    throw new HydrationError('Hydrator native module is not available', {
      code: 'NATIVE_MODULE_UNAVAILABLE',
      details: { module: MODULE_NAME },
    });
  }
  return module;
}
