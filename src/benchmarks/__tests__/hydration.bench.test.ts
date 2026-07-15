import { describe, expect, it } from '@jest/globals';
import { runHydrationBenchmarks } from '../hydrationBenchmark';
import { formatBenchmarkTable } from '../patchBenchmark';

describe('hydration benchmarks', () => {
  it('runs validation and diff within sanity budgets', () => {
    const samples = runHydrationBenchmarks({
      itemCount: 200,
      iterations: 50,
    });

    console.log(`\n${formatBenchmarkTable(samples)}\n`);

    const pipeline = samples.find((sample) =>
      sample.name.startsWith('runHydration')
    );

    expect(pipeline?.meanMs).toBeLessThan(50);
  });
});
