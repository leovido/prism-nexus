import { describe, expect, it } from '@jest/globals';
import { formatBenchmarkTable, runPatchBenchmarks } from '../patchBenchmark';

describe('patch benchmarks', () => {
  it('computes diff and applyPatch within sanity budgets', () => {
    const samples = runPatchBenchmarks({
      itemCount: 200,
      diffIterations: 50,
      applyIterations: 50,
    });

    console.log(`\n${formatBenchmarkTable(samples)}\n`);

    const diff = samples.find((sample) =>
      sample.name.startsWith('computeDiff')
    );
    const apply = samples.find((sample) =>
      sample.name.startsWith('applyPatch')
    );

    expect(diff?.meanMs).toBeLessThan(50);
    expect(apply?.meanMs).toBeLessThan(50);
  });
});
