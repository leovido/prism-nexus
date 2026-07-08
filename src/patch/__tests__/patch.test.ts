import { describe, expect, it } from '@jest/globals';
import type { DeepPatch } from '../../types';
import { applyPatch } from '../applyPatch';
import { computeDiff, deepEqual } from '../diff';
import {
  buildPointer,
  escapeToken,
  parsePointer,
  unescapeToken,
} from '../jsonPointer';

describe('jsonPointer', () => {
  it('escapes and unescapes reserved characters', () => {
    expect(escapeToken('a/b~c')).toBe('a~1b~0c');
    expect(unescapeToken('a~1b~0c')).toBe('a/b~c');
  });

  it('parses the empty pointer as the whole document', () => {
    expect(parsePointer('')).toEqual([]);
  });

  it('round-trips tokens through build and parse', () => {
    const tokens = ['users', '0', 'first/last'];
    expect(parsePointer(buildPointer(tokens))).toEqual(tokens);
  });

  it('rejects pointers that do not start with a slash', () => {
    expect(() => parsePointer('nope')).toThrow(/Invalid JSON Pointer/);
  });
});

describe('deepEqual', () => {
  it('treats NaN as equal to NaN', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it('compares nested structures by value', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('computeDiff + applyPatch round-trip', () => {
  const cases: Array<{ name: string; base: unknown; next: unknown }> = [
    { name: 'primitive replace', base: { n: 1 }, next: { n: 2 } },
    { name: 'add key', base: { a: 1 }, next: { a: 1, b: 2 } },
    { name: 'remove key', base: { a: 1, b: 2 }, next: { a: 1 } },
    {
      name: 'nested object',
      base: { a: { b: { c: 1 } } },
      next: { a: { b: { c: 9 } } },
    },
    {
      name: 'array element change',
      base: { xs: [1, 2, 3] },
      next: { xs: [1, 5, 3] },
    },
    { name: 'array grow', base: { xs: [1] }, next: { xs: [1, 2, 3] } },
    { name: 'array shrink', base: { xs: [1, 2, 3] }, next: { xs: [1] } },
    { name: 'no change', base: { a: 1 }, next: { a: 1 } },
  ];

  it.each(cases)('re-derives $name via patch', ({ base, next }) => {
    const patch = computeDiff(base, next);
    expect(applyPatch(base, patch)).toEqual(next);
  });

  it('produces no operations when values are equal', () => {
    expect(computeDiff({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe('applyPatch immutability', () => {
  it('returns a new reference and leaves the source untouched', () => {
    const base = { a: { b: 1 }, c: 2 };
    const patch: DeepPatch<typeof base>[] = [
      { op: 'replace', path: '/a/b', value: 99 },
    ];
    const result = applyPatch(base, patch);

    expect(result).not.toBe(base);
    expect(result.a).not.toBe(base.a);
    expect(base.a.b).toBe(1);
    expect(result.a.b).toBe(99);
  });

  it('shares untouched branches by reference', () => {
    const base = { a: { keep: true }, b: { change: 1 } };
    const patch: DeepPatch<typeof base>[] = [
      { op: 'replace', path: '/b/change', value: 2 },
    ];
    const result = applyPatch(base, patch);

    expect(result.a).toBe(base.a);
    expect(result.b).not.toBe(base.b);
  });

  it('supports the array append token', () => {
    const base = { xs: [1, 2] };
    const patch: DeepPatch<typeof base>[] = [
      { op: 'add', path: '/xs/-', value: 3 },
    ];
    expect(applyPatch(base, patch).xs).toEqual([1, 2, 3]);
  });

  it('replaces the document root', () => {
    expect(
      applyPatch({ a: 1 }, [{ op: 'replace', path: '', value: { b: 2 } }])
    ).toEqual({ b: 2 });
  });

  it('throws on out-of-bounds array replace', () => {
    expect(() =>
      applyPatch({ xs: [1] }, [{ op: 'replace', path: '/xs/5', value: 0 }])
    ).toThrow();
  });
});
