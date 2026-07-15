import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HydrationError } from '../../errors';
import { extractReqIdFromUrl } from '../extractReqId';
import { mapNativeError } from '../mapNativeError';
import {
  createNativeHydrationSource,
  extractHydrationReqId,
} from '../nativeHydrationSource';
import {
  __resetNativeHydratorModuleCacheForTests,
  getNativeHydratorModule,
  isNativeHydratorAvailable,
  requireNativeHydratorModule,
} from '../PrismNexusHydratorModule';
import type { PrismNexusHydratorNativeSpec } from '../types';

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
}));

import { requireNativeModule } from 'expo-modules-core';

const mockRequireNativeModule = requireNativeModule as jest.MockedFunction<
  typeof requireNativeModule
>;

function makeNativeModule(
  overrides: Partial<PrismNexusHydratorNativeSpec> = {}
): PrismNexusHydratorNativeSpec {
  return {
    isAvailable: () => true,
    extractReqId: (url) => extractReqIdFromUrl(url),
    configure: async () => undefined,
    storePayload: async () => undefined,
    sealAndStorePayload: async () => ({
      reqId: 'req-1',
      v: 1,
      ts: 1,
      ctx: 'session',
      kid: 'v1',
      sig: 'sig',
      chunks: [],
    }),
    resolveEnvelope: async () => null,
    purgeExpired: async () => 0,
    inspectStorage: async () => ({ stored: [], cached: 0 }),
    ...overrides,
  };
}

describe('extractReqIdFromUrl', () => {
  it('extracts the reqId without encoding routing context in the url', () => {
    expect(extractReqIdFromUrl('app://hydrate/abc123')).toBe('abc123');
    expect(extractReqIdFromUrl('demo://hydrate/deadbeef')).toBe('deadbeef');
    expect(extractReqIdFromUrl('app://other/path')).toBeNull();
  });
});

describe('mapNativeError', () => {
  it('maps coded native errors to HydrationError codes', () => {
    const mapped = mapNativeError({ code: 'TTL_EXPIRED', message: 'expired' });
    expect(mapped.code).toBe('TTL_EXPIRED');
    expect(mapped.message).toBe('expired');
  });

  it('falls back to MALFORMED_PAYLOAD for unknown native codes', () => {
    expect(mapNativeError({ code: 'WEIRD' }).code).toBe('MALFORMED_PAYLOAD');
  });
});

describe('PrismNexusHydratorModule loader', () => {
  beforeEach(() => {
    __resetNativeHydratorModuleCacheForTests();
    mockRequireNativeModule.mockReset();
  });

  it('returns null when autolinking did not register the module', () => {
    mockRequireNativeModule.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(getNativeHydratorModule()).toBeNull();
    expect(isNativeHydratorAvailable()).toBe(false);
  });

  it('throws NATIVE_MODULE_UNAVAILABLE from requireNativeHydratorModule', () => {
    mockRequireNativeModule.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(() => requireNativeHydratorModule()).toThrow(HydrationError);
    try {
      requireNativeHydratorModule();
    } catch (err) {
      expect(HydrationError.is(err)).toBe(true);
      expect((err as HydrationError).code).toBe('NATIVE_MODULE_UNAVAILABLE');
    }
  });
});

describe('createNativeHydrationSource', () => {
  beforeEach(() => {
    __resetNativeHydratorModuleCacheForTests();
    mockRequireNativeModule.mockReset();
  });

  it('maps a native envelope into HydrationEnvelope', async () => {
    mockRequireNativeModule.mockReturnValue(
      makeNativeModule({
        resolveEnvelope: async () => ({
          reqId: 'req-1',
          claims: { v: 1, ts: 1, ctx: 'session', kid: 'v1' },
          state: { count: 2 },
        }),
      })
    );

    const source = createNativeHydrationSource();
    const envelope = await source.resolve('appLaunch');

    expect(envelope).toEqual({
      reqId: 'req-1',
      claims: { v: 1, ts: 1, ctx: 'session', kid: 'v1' },
      state: { count: 2 },
    });
  });

  it('returns null when native has no pending envelope', async () => {
    mockRequireNativeModule.mockReturnValue(makeNativeModule());
    const source = createNativeHydrationSource();
    expect(await source.resolve('manual')).toBeNull();
  });

  it('maps native failures to HydrationError', async () => {
    mockRequireNativeModule.mockReturnValue(
      makeNativeModule({
        resolveEnvelope: async () => {
          throw { code: 'DECRYPTION_FAILED', message: 'bad key' };
        },
      })
    );

    const source = createNativeHydrationSource();
    await expect(source.resolve('appLaunch')).rejects.toMatchObject({
      code: 'DECRYPTION_FAILED',
    });
  });
});

describe('extractHydrationReqId', () => {
  beforeEach(() => {
    __resetNativeHydratorModuleCacheForTests();
    mockRequireNativeModule.mockReset();
  });

  it('prefers the native extractor when the module is linked', () => {
    mockRequireNativeModule.mockReturnValue(
      makeNativeModule({
        extractReqId: () => 'from-native',
      })
    );
    expect(extractHydrationReqId('app://hydrate/ignored')).toBe('from-native');
  });

  it('falls back to the pure-JS parser when native is unavailable', () => {
    mockRequireNativeModule.mockImplementation(() => {
      throw new Error('not found');
    });
    expect(extractHydrationReqId('app://hydrate/fallback')).toBe('fallback');
  });
});
