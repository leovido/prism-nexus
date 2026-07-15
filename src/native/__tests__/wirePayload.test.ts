import { createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { sha256HexFromUtf8 } from '../sha256';
import {
  buildSignatureMessage,
  computeChunksHmac,
  type HydrationWireChunk,
} from '../wirePayload';

const chunks: HydrationWireChunk[] = [
  { seq: 0, size: 10, iv: 'aXY=', hmac: 'aa'.repeat(32), data: 'c2FsdA' },
  { seq: 1, size: 5, iv: 'aXYy', hmac: 'bb'.repeat(32), data: 'c2FsdDI' },
];

describe('sha256HexFromUtf8', () => {
  it('matches node:crypto for empty and ascii inputs', () => {
    for (const input of ['', 'abc', 'hello prism-nexus']) {
      const expected = createHash('sha256').update(input, 'utf8').digest('hex');
      expect(sha256HexFromUtf8(input)).toBe(expected);
    }
  });
});

describe('wirePayload canonicalization', () => {
  it('aggregates chunk hmacs in sequence order', () => {
    const reversed = [chunks[1]!, chunks[0]!];
    expect(computeChunksHmac(reversed)).toBe(computeChunksHmac(chunks));
  });

  it('builds the pipe-delimited signature message', () => {
    const message = buildSignatureMessage(
      { v: 1, ts: 1_700_000_000, ctx: 'session', kid: 'v1' },
      chunks
    );
    expect(message).toMatch(/^1\|1700000000\|session\|v1\|[0-9a-f]{64}$/);
  });
});
