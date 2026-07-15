import type { HydrationEnvelope } from '../hydration';
import type { HydrationSource, HydrationTrigger } from '../provider';
import type { HydrationContext } from '../types';
import type { TestHydrationStore } from './store';

/** Result of extracting a request locator from a raw deep link payload. */
export interface ExtractedRequest {
  reqId: string;
  url: string;
}

export interface MockExtractorInput {
  reqId?: string;
  /** URI scheme for the synthesised locator; defaults to `app`. */
  scheme?: string;
}

export interface MockEnvelopeInput {
  reqId?: string;
  state: unknown;
  context?: HydrationContext;
  version?: number;
  ts?: number;
  kid?: string;
}

export function randomReqId(): string {
  let out = '';
  // 48 hex chars ~ 24 random bytes, matching the PRD reqId size for tests.
  for (let i = 0; i < 48; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/**
 * Deterministically shaped extractor for tests: turns a raw payload descriptor
 * into a `{ reqId, url }` locator. The routing context is never encoded in the
 * URL — only in signed claims — so the URL carries just the request id.
 */
export function mockHydratorExtractor(
  input: MockExtractorInput = {}
): ExtractedRequest {
  const reqId = input.reqId ?? randomReqId();
  const scheme = input.scheme ?? 'app';
  return { reqId, url: `${scheme}://hydrate/${reqId}` };
}

/** Build a fully-formed {@link HydrationEnvelope} for tests. */
export function createMockEnvelope(
  input: MockEnvelopeInput
): HydrationEnvelope {
  return {
    reqId: input.reqId ?? randomReqId(),
    claims: {
      v: input.version ?? 1,
      ts: input.ts ?? Math.floor(Date.now() / 1000),
      ctx: input.context ?? 'session',
      kid: input.kid ?? 'v1',
    },
    state: input.state,
  };
}

/**
 * A {@link HydrationSource} backed by a {@link TestHydrationStore}. Each trigger
 * consumes the next live entry, letting tests drive `appLaunch`/`hydrateNow`
 * flows deterministically.
 */
export function createMockHydrationSource(
  store: TestHydrationStore
): HydrationSource {
  return {
    resolve(_trigger: HydrationTrigger): Promise<HydrationEnvelope | null> {
      return Promise.resolve(store.takeNextLive());
    },
  };
}
