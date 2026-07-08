import { describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';
import type { HydrationOptions, HydrationResult } from '../../types';
import { HydrationQueue, runHydration } from '../pipeline';
import type { HydrationEnvelope } from '../pipeline';

interface AppState {
  user: { id: string; name: string };
  count: number;
}

const schema = z.object({
  user: z.object({ id: z.string(), name: z.string() }),
  count: z.number(),
});

function makeOptions(
  overrides: Partial<HydrationOptions<AppState>> = {}
): HydrationOptions<AppState> {
  return {
    schema,
    minVersion: 1,
    maxVersion: 1,
    onHydrate: jest.fn(),
    ...overrides,
  };
}

function makeEnvelope(
  state: unknown,
  ctx = 'session',
  v = 1
): HydrationEnvelope {
  return {
    reqId: 'req-1',
    claims: { v, ts: 1_700_000_000, ctx, kid: 'v1' },
    state,
  };
}

const validState: AppState = { user: { id: 'u1', name: 'Ada' }, count: 3 };

describe('runHydration', () => {
  it('produces a patch from base to validated state on success', () => {
    const base: Partial<AppState> = {
      user: { id: 'u1', name: 'Ada' },
      count: 0,
    };
    const result = runHydration(makeEnvelope(validState), base, makeOptions());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version).toBe(1);
      expect(result.context).toBe('session');
      expect(result.patch).toEqual([
        { op: 'replace', path: '/count', value: 3 },
      ]);
    }
  });

  it('fails with SCHEMA_VERSION_MISMATCH and notifies onError', () => {
    const onError = jest.fn();
    const result = runHydration(
      makeEnvelope(validState, 'session', 2),
      {},
      makeOptions({ onError })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SCHEMA_VERSION_MISMATCH');
      expect(result.fallback).toEqual({});
    }
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('fails with SCHEMA_VALIDATION_FAILED on bad payload', () => {
    const result = runHydration(
      makeEnvelope({ user: { id: 1 } }),
      {},
      makeOptions()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SCHEMA_VALIDATION_FAILED');
    }
  });

  it('fails with CONTEXT_ROUTING_FAILED on unknown context', () => {
    const result = runHydration(
      makeEnvelope(validState, 'admin'),
      {},
      makeOptions()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONTEXT_ROUTING_FAILED');
    }
  });
});

describe('HydrationQueue', () => {
  const deferred = <V>() => {
    let resolve!: (value: V) => void;
    const promise = new Promise<V>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  it('delivers the result of the only request', async () => {
    const onResult = jest.fn<(r: HydrationResult<AppState>) => void>();
    const queue = new HydrationQueue<AppState>(onResult);
    const result: HydrationResult<AppState> = {
      ok: true,
      patch: [],
      version: 1,
      context: 'guest',
    };

    await queue.submit({ reqId: 'a', run: async () => result });

    expect(onResult).toHaveBeenCalledWith(result);
  });

  it('discards a stale request and warns when a newer one supersedes it', async () => {
    const onResult = jest.fn<(r: HydrationResult<AppState>) => void>();
    const onWarn = jest.fn<(msg: string) => void>();
    const queue = new HydrationQueue<AppState>(onResult, onWarn);

    const first = deferred<HydrationResult<AppState>>();
    const stale: HydrationResult<AppState> = {
      ok: true,
      patch: [],
      version: 1,
      context: 'session',
    };
    const fresh: HydrationResult<AppState> = {
      ok: true,
      patch: [],
      version: 1,
      context: 'guest',
    };

    const firstSubmit = queue.submit({
      reqId: 'old',
      run: () => first.promise,
    });
    await queue.submit({ reqId: 'new', run: async () => fresh });

    first.resolve(stale);
    await firstSubmit;

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(fresh);
    expect(onWarn).toHaveBeenCalledWith(
      'Discarded stale hydration request: old'
    );
  });
});
