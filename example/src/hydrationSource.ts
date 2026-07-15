import {
  createNativeHydrationSource,
  isNativeHydratorAvailable,
} from 'prism-nexus';
import {
  createMockHydrationSource,
  TestHydrationStore,
} from 'prism-nexus/testing';
import { Platform } from 'react-native';

const mockTestStore = new TestHydrationStore();

/** Platform-aware hydration source for the example app. */
export function createExampleHydrationSource() {
  if (usesNativeHydrator()) {
    return createNativeHydrationSource();
  }
  return createMockHydrationSource(mockTestStore);
}

export function getWebTestStore(): TestHydrationStore {
  return mockTestStore;
}

/** True when the Expo hydrator bridge is linked into this binary. */
export function usesNativeHydrator(): boolean {
  return Platform.OS !== 'web' && isNativeHydratorAvailable();
}
