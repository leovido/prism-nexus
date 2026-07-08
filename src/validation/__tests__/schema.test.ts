import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';
import { HydrationError } from '../../errors';
import { assertVersionInRange, validateWithSchema } from '../schema';

describe('assertVersionInRange', () => {
  it('accepts a version inside the inclusive window', () => {
    expect(() => assertVersionInRange(1, 1, 1)).not.toThrow();
    expect(() => assertVersionInRange(2, 1, 3)).not.toThrow();
  });

  it('rejects a version below the minimum', () => {
    expect(() => assertVersionInRange(0, 1, 3)).toThrow(HydrationError);
  });

  it('rejects a version above the maximum with a coded error', () => {
    try {
      assertVersionInRange(4, 1, 3);
      throw new Error('expected throw');
    } catch (err) {
      expect(HydrationError.is(err)).toBe(true);
      expect((err as HydrationError).code).toBe('SCHEMA_VERSION_MISMATCH');
    }
  });

  it('rejects a non-integer version', () => {
    expect(() => assertVersionInRange(1.5, 1, 3)).toThrow(HydrationError);
  });
});

describe('validateWithSchema', () => {
  const schema = z.object({ id: z.string(), count: z.number() });

  it('returns the parsed value on success', () => {
    expect(validateWithSchema(schema, { id: 'a', count: 2 })).toEqual({
      id: 'a',
      count: 2,
    });
  });

  it('wraps validation failures as SCHEMA_VALIDATION_FAILED with cause preserved', () => {
    try {
      validateWithSchema(schema, { id: 1 });
      throw new Error('expected throw');
    } catch (err) {
      expect(HydrationError.is(err)).toBe(true);
      expect((err as HydrationError).code).toBe('SCHEMA_VALIDATION_FAILED');
      expect((err as HydrationError).cause).toBeDefined();
    }
  });
});
