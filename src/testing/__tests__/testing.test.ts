import { describe, expect, it } from '@jest/globals';
import {
  createMockEnvelope,
  createMockHydrationSource,
  defaultTestStore,
  inspectHydrationState,
  mockHydratorExtractor,
  simulateTTLExpiry,
  TestHydrationStore,
} from '../index';

describe('mockHydratorExtractor', () => {
  it('keeps the routing context out of the url', () => {
    const { reqId, url } = mockHydratorExtractor({
      reqId: 'abc',
      scheme: 'demo',
    });
    expect(url).toBe('demo://hydrate/abc');
    expect(url).not.toContain('ctx');
    expect(reqId).toBe('abc');
  });

  it('generates a request id when none is given', () => {
    expect(mockHydratorExtractor().reqId).toMatch(/^[0-9a-f]{48}$/);
  });
});

describe('TestHydrationStore', () => {
  it('reports stored ids and live count, and consumes entries in order', () => {
    const store = new TestHydrationStore();
    store.put(createMockEnvelope({ reqId: 'r1', state: { a: 1 } }));
    store.put(createMockEnvelope({ reqId: 'r2', state: { a: 2 } }));

    expect(store.inspect()).toMatchObject({ stored: ['r1', 'r2'], cached: 2 });
    expect(store.takeNextLive()?.reqId).toBe('r1');
    expect(store.inspect().cached).toBe(1);
  });

  it('stops yielding entries after expiry', () => {
    const store = new TestHydrationStore();
    store.put(createMockEnvelope({ reqId: 'r1', state: {} }));
    store.expireAll();

    expect(store.takeNextLive()).toBeNull();
    expect(store.inspect().cached).toBe(0);
  });
});

describe('inspectHydrationState / simulateTTLExpiry', () => {
  it('reflects the shared default test store', () => {
    defaultTestStore.reset();
    defaultTestStore.put(createMockEnvelope({ reqId: 'shared', state: {} }));

    expect(inspectHydrationState().cached).toBe(1);

    simulateTTLExpiry();
    expect(inspectHydrationState().cached).toBe(0);

    defaultTestStore.reset();
  });
});

describe('createMockHydrationSource', () => {
  it('resolves the next live envelope for any trigger', async () => {
    const store = new TestHydrationStore();
    store.put(createMockEnvelope({ reqId: 'r1', state: { hello: 'world' } }));
    const source = createMockHydrationSource(store);

    const envelope = await source.resolve('appLaunch');
    expect(envelope?.reqId).toBe('r1');
    expect(await source.resolve('manual')).toBeNull();
  });
});
