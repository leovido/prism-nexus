import { describe, expect, it } from '@jest/globals';
import { HydrationError } from '../../errors';
import { isHydrationContext, routeContext } from '../claims';

describe('isHydrationContext', () => {
  it('accepts known contexts', () => {
    expect(isHydrationContext('session')).toBe(true);
    expect(isHydrationContext('guest')).toBe(true);
    expect(isHydrationContext('ephemeral')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isHydrationContext('admin')).toBe(false);
    expect(isHydrationContext(undefined)).toBe(false);
    expect(isHydrationContext(1)).toBe(false);
  });
});

describe('routeContext', () => {
  it('routes a recognised claim', () => {
    expect(routeContext({ ctx: 'session' })).toBe('session');
  });

  it('throws CONTEXT_ROUTING_FAILED with no default context', () => {
    try {
      routeContext({ ctx: 'unknown' });
      throw new Error('expected throw');
    } catch (err) {
      expect(HydrationError.is(err)).toBe(true);
      expect((err as HydrationError).code).toBe('CONTEXT_ROUTING_FAILED');
    }
  });
});
