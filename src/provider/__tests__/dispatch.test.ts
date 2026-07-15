import { describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';
import type { HydrationEnvelope } from '../../hydration';
import { HydrationQueue } from '../../hydration';
import type { HydrationOptions, HydrationResult } from '../../types';
import type { HydrationSource } from '../dispatch';
import { createHydrationDispatch } from '../dispatch';

interface AppState {
  count: number;
}

const schema = z.object({ count: z.number() });

function makeOptions(
  onHydrate: (r: HydrationResult<AppState>) => void,
  overrides: Partial<HydrationOptions<AppState>> = {}
): HydrationOptions<AppState> {
  return { schema, minVersion: 1, maxVersion: 1, onHydrate, ...overrides };
}

function envelope(state: unknown, reqId = 'req-1'): HydrationEnvelope {
  return { reqId, claims: { v: 1, ts: 1, ctx: 'session', kid: 'v1' }, state };
}

describe('createHydrationDispatch', () => {
  it('delivers a successful result to onHydrate', async () => {
    const onHydrate = jest.fn<(r: HydrationResult<AppState>) => void>();
    const source: HydrationSource = {
      resolve: async () => envelope({ count: 5 }),
    };
    const options = makeOptions(onHydrate);
    const queue = new HydrationQueue<AppState>(
      options.onHydrate,
      options.onWarn
    );

    const dispatch = createHydrationDispatch<AppState>({
      source,
      getBaseState: () => ({ count: 0 }),
      options,
      queue,
    });

    await dispatch('appLaunch');

    expect(onHydrate).toHaveBeenCalledTimes(1);
    const result = onHydrate.mock.calls[0]![0];
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toEqual([
        { op: 'replace', path: '/count', value: 5 },
      ]);
    }
  });

  it('is a silent no-op when the source returns null', async () => {
    const onHydrate = jest.fn<(r: HydrationResult<AppState>) => void>();
    const source: HydrationSource = { resolve: async () => null };
    const options = makeOptions(onHydrate);
    const queue = new HydrationQueue<AppState>(
      options.onHydrate,
      options.onWarn
    );

    const dispatch = createHydrationDispatch<AppState>({
      source,
      getBaseState: () => ({ count: 0 }),
      options,
      queue,
    });

    await dispatch('manual');

    expect(onHydrate).not.toHaveBeenCalled();
  });

  it('surfaces source-resolution errors as a coded failure result', async () => {
    const onHydrate = jest.fn<(r: HydrationResult<AppState>) => void>();
    const onError = jest.fn();
    const source: HydrationSource = {
      resolve: async () => {
        throw new Error('bridge offline');
      },
    };
    const options = makeOptions(onHydrate, { onError });
    const queue = new HydrationQueue<AppState>(
      options.onHydrate,
      options.onWarn
    );

    const dispatch = createHydrationDispatch<AppState>({
      source,
      getBaseState: () => ({ count: 0 }),
      options,
      queue,
    });

    await dispatch('appStateActive');

    expect(onError).toHaveBeenCalledTimes(1);
    const result = onHydrate.mock.calls[0]![0];
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MALFORMED_PAYLOAD');
      expect(result.fallback).toEqual({ count: 0 });
    }
  });

  it('applies only the latest result when dispatches overlap', async () => {
    const onHydrate = jest.fn<(r: HydrationResult<AppState>) => void>();
    const onWarn = jest.fn();
    let call = 0;
    const delayedSource: HydrationSource = {
      resolve: async () => {
        call += 1;
        if (call === 1) {
          await new Promise((r) => setTimeout(r, 30));
          return envelope({ count: 1 }, 'req-old');
        }
        return envelope({ count: 9 }, 'req-new');
      },
    };

    const options = makeOptions(onHydrate, { onWarn });
    const queue = new HydrationQueue<AppState>(
      options.onHydrate,
      options.onWarn
    );
    const dispatch = createHydrationDispatch<AppState>({
      source: delayedSource,
      getBaseState: () => ({ count: 0 }),
      options,
      queue,
    });

    const firstDispatch = dispatch('appLaunch');
    const secondDispatch = dispatch('manual');
    await Promise.all([firstDispatch, secondDispatch]);

    expect(onHydrate).toHaveBeenCalledTimes(1);
    const result = onHydrate.mock.calls[0]![0];
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toEqual([
        { op: 'replace', path: '/count', value: 9 },
      ]);
    }
    expect(onWarn).toHaveBeenCalledWith(
      'Discarded stale hydration request: req-old'
    );
  });
});
