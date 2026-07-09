import { Platform } from 'react-native';
import { createNativeHydrationSource } from 'prism-nexus';
import {
  TestHydrationStore,
  createMockHydrationSource,
} from 'prism-nexus/testing';

const webTestStore = new TestHydrationStore();

/** Platform-aware hydration source for the example app. */
export function createExampleHydrationSource() {
  if (Platform.OS === 'web') {
    return createMockHydrationSource(webTestStore);
  }
  return createNativeHydrationSource();
}

export function getWebTestStore(): TestHydrationStore {
  return webTestStore;
}

export function usesNativeHydrator(): boolean {
  return Platform.OS !== 'web';
}
