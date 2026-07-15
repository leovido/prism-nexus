import { z } from 'zod';
import type { HydrationEnvelope } from '../hydration';
import { runHydration } from '../hydration';
import { type BenchmarkSample, measure } from './patchBenchmark';

const schema = z.object({
  meta: z.object({ version: z.number(), tags: z.array(z.string()) }),
  items: z.array(z.object({ id: z.number(), value: z.string() })),
});

type BenchState = z.infer<typeof schema>;

export interface HydrationBenchmarkOptions {
  itemCount?: number;
  iterations?: number;
}

const DEFAULT_ITEM_COUNT = 500;
const DEFAULT_ITERATIONS = 200;

function createEnvelope(itemCount: number): HydrationEnvelope {
  return {
    reqId: 'bench-req',
    claims: { v: 1, ts: 1_700_000_000, ctx: 'session', kid: 'v1' },
    state: {
      meta: { version: 2, tags: ['hydrator', 'benchmark'] },
      items: Array.from({ length: itemCount }, (_, id) => ({
        id,
        value: `item-${id}`,
      })),
    },
  };
}

function createBase(itemCount: number): Partial<BenchState> {
  return {
    meta: { version: 1, tags: ['hydrator', 'benchmark'] },
    items: Array.from({ length: itemCount }, (_, id) => ({
      id,
      value: `item-${id}`,
    })),
  };
}

/** Benchmark the JS validation + diff pipeline (`runHydration`). */
export function runHydrationBenchmarks(
  options: HydrationBenchmarkOptions = {}
): BenchmarkSample[] {
  const itemCount = options.itemCount ?? DEFAULT_ITEM_COUNT;
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const envelope = createEnvelope(itemCount);
  const base = createBase(itemCount);

  return [
    measure(
      `runHydration/${itemCount}-items`,
      () => {
        runHydration(envelope, base, {
          schema,
          minVersion: 1,
          maxVersion: 1,
          onHydrate: () => undefined,
        });
      },
      iterations
    ),
  ];
}
