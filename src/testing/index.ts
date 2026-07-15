import { TestHydrationStore } from './store';

export { mergeHydrationFallback, resolveHydrationResult } from './fallback';
export type { TestHydratorHarness } from './harness';
export { createTestHydratorHarness } from './harness';
export type {
  ExtractedRequest,
  MockEnvelopeInput,
  MockExtractorInput,
} from './mock';
export {
  createMockEnvelope,
  createMockHydrationSource,
  mockHydratorExtractor,
  randomReqId,
} from './mock';
export type { HydrationStateSnapshot, StoredEntry } from './store';
export { TestHydrationStore } from './store';

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
