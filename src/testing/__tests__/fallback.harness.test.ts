import { describe, expect, it, jest } from '@jest/globals';
import { HydrationError } from '../../errors';
import { applyPatch } from '../../patch';
import {
  createTestHydratorHarness,
  mergeHydrationFallback,
  resolveHydrationResult,
} from '../index';

describe('mergeHydrationFallback', () => {
  it('merges fallback partials and emits a warning', () => {
    const onWarn = jest.fn();
    const current = { count: 1, label: 'keep' };
    const error = new HydrationError('schema failed', {
      code: 'SCHEMA_VALIDATION_FAILED',
    });
    const next = mergeHydrationFallback(
      current,
      { ok: false, error, fallback: { count: 0 } },
      onWarn
    );

    expect(next).toEqual({ count: 0, label: 'keep' });
    expect(onWarn).toHaveBeenCalledWith(
      expect.stringContaining('SCHEMA_VALIDATION_FAILED')
    );
  });
});

describe('resolveHydrationResult', () => {
  it('routes successful results to onSuccess', () => {
    const current = { count: 1 };
    const next = resolveHydrationResult(
      current,
      {
        ok: true,
        patch: [{ op: 'replace', path: '/count', value: 5 }],
        version: 1,
        context: 'session',
      },
      {
        onSuccess: (result) =>
          applyPatch(current, result.patch) as typeof current,
      }
    );
    expect(next).toEqual({ count: 5 });
  });

  it('routes failures through mergeHydrationFallback', () => {
    const onWarn = jest.fn();
    const current = { count: 1, label: 'x' };
    const next = resolveHydrationResult(
      current,
      {
        ok: false,
        error: new HydrationError('bad', { code: 'TTL_EXPIRED' }),
        fallback: { count: 9 },
      },
      {
        onSuccess: () => ({ count: 0, label: 'x' }),
        onWarn,
      }
    );
    expect(next).toEqual({ count: 9, label: 'x' });
    expect(onWarn).toHaveBeenCalled();
  });
});

describe('createTestHydratorHarness', () => {
  it('seeds envelopes consumed by the mock source', async () => {
    const harness = createTestHydratorHarness();
    harness.seed({ reqId: 'r1', state: { ok: true } });

    const envelope = await harness.source.resolve('appLaunch');
    expect(envelope?.reqId).toBe('r1');
    expect(harness.store.inspect().cached).toBe(0);
  });

  it('reset clears the store', () => {
    const harness = createTestHydratorHarness();
    harness.seed({ reqId: 'r1', state: {} });
    harness.reset();
    expect(harness.store.inspect()).toMatchObject({ stored: [], cached: 0 });
  });
});
