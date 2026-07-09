import { TestHydrationStore } from './store';

export { TestHydrationStore } from './store';
export type { HydrationStateSnapshot, StoredEntry } from './store';

export {
  createMockEnvelope,
  createMockHydrationSource,
  mockHydratorExtractor,
  randomReqId,
} from './mock';
export type {
  ExtractedRequest,
  MockEnvelopeInput,
  MockExtractorInput,
} from './mock';

export { mergeHydrationFallback, resolveHydrationResult } from './fallback';
export { createTestHydratorHarness } from './harness';
export type { TestHydratorHarness } from './harness';

/** Shared store powering the module-level inspection helpers below. */
export const defaultTestStore = new TestHydrationStore();

/** Snapshot of the shared test store: stored ids, live count, and errors. */
export function inspectHydrationState() {
  return defaultTestStore.inspect();
}

/** Expire every entry in the shared test store, simulating a TTL sweep. */
export function simulateTTLExpiry(): void {
  defaultTestStore.expireAll();
}
