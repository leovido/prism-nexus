import { describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';
import type { HydrationOptions, HydrationResult } from '../../types';
import type { HydrationEnvelope } from '../pipeline';
import { HydrationQueue, runHydration } from '../pipeline';

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

    const attempt = queue.beginAttempt();
    await queue.submit({ reqId: 'a', run: async () => result }, attempt);

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

    const firstAttempt = queue.beginAttempt();
    const firstSubmit = queue.submit(
      {
        reqId: 'old',
        run: () => first.promise,
      },
      firstAttempt
    );
    const secondAttempt = queue.beginAttempt();
    await queue.submit({ reqId: 'new', run: async () => fresh }, secondAttempt);

    first.resolve(stale);
    await firstSubmit;

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(fresh);
    expect(onWarn).toHaveBeenCalledWith(
      'Discarded stale hydration request: old'
    );
  });

  it('skips superseded work before run() when a newer request was queued', async () => {
    const onResult = jest.fn<(r: HydrationResult<AppState>) => void>();
    const onWarn = jest.fn<(msg: string) => void>();
    const queue = new HydrationQueue<AppState>(onResult, onWarn);
    const run = jest.fn(async () => ({
      ok: true as const,
      patch: [],
      version: 1,
      context: 'session' as const,
    }));

    const gate = deferred<void>();
    const firstAttempt = queue.beginAttempt();
    const blocked = queue.submit(
      {
        reqId: 'blocked',
        run: async () => {
          await gate.promise;
          return run();
        },
      },
      firstAttempt
    );
    const secondAttempt = queue.beginAttempt();
    await queue.submit({ reqId: 'latest', run }, secondAttempt);

    gate.resolve();
    await blocked;

    expect(run).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onWarn).toHaveBeenCalledWith(
      'Discarded stale hydration request: blocked'
    );
  });

  it('delivers only once when the same reqId overlaps in flight', async () => {
    const onResult = jest.fn<(r: HydrationResult<AppState>) => void>();
    const queue = new HydrationQueue<AppState>(onResult);
    const result: HydrationResult<AppState> = {
      ok: true,
      patch: [],
      version: 1,
      context: 'guest',
    };
    const gate = deferred<void>();

    const firstAttempt = queue.beginAttempt();
    const first = queue.submit(
      {
        reqId: 'dup',
        run: async () => {
          await gate.promise;
          return result;
        },
      },
      firstAttempt
    );
    const secondAttempt = queue.beginAttempt();
    await queue.submit(
      { reqId: 'dup', run: async () => result },
      secondAttempt
    );

    gate.resolve();
    await first;

    expect(onResult).toHaveBeenCalledTimes(1);
  });
});
