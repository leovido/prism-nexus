import type { HydrationEnvelope } from '../hydration';
import type { HydrationSource } from '../provider';
import {
  createMockEnvelope,
  createMockHydrationSource,
  type MockEnvelopeInput,
} from './mock';
import { TestHydrationStore } from './store';

export interface TestHydratorHarness {
  /** In-memory store backing the mock source. */
  store: TestHydrationStore;
  /** {@link HydrationSource} wired to `store` for `HydratorProvider`. */
  source: HydrationSource;
  /** Seed the next envelope the source will resolve. */
  seed(input: MockEnvelopeInput): HydrationEnvelope;
  /** Clear stored envelopes and recorded errors. */
  reset(): void;
}

/** Factory for deterministic unit/integration tests around the hydrator. */
export function createTestHydratorHarness(): TestHydratorHarness {
  const store = new TestHydrationStore();
  const source = createMockHydrationSource(store);

  return {
    store,
    source,
    seed(input) {
      const envelope = createMockEnvelope(input);
      store.put(envelope);
      return envelope;
    },
    reset() {
      store.reset();
    },
  };
}
