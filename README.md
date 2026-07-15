# prism-nexus

A secure, type-safe SDK for hydrating React Native application state across app launches, background transitions, and offline sessions.

The hydrator is a **transport and validation layer**: it decrypts signed payloads from native storage, validates schema/version claims, computes an RFC 6902 JSON Patch, and delivers the result to your `onHydrate` callback. Your app owns when and how state is applied.

## Installation

```sh
yarn add prism-nexus zod
# or
npm install prism-nexus zod
```

**Expo (recommended):** the native bridge autolinks via `expo-module.config.json`. Run `npx expo prebuild` (or use EAS Build) before testing on device.

**Bare React Native:** autolinking picks up the iOS/Android modules when `expo-modules-core` is installed.

## Quick start

```tsx
import { z } from 'zod';
import {
  applyPatch,
  configureNativeHydrator,
  createNativeHydrationSource,
  HydratorProvider,
} from 'prism-nexus';

const appSchema = z.object({
  count: z.number(),
  label: z.string(),
});

type AppState = z.infer<typeof appSchema>;

export function App() {
  const [state, setState] = useState<AppState>({ count: 0, label: 'fresh' });

  useEffect(() => {
    configureNativeHydrator({ testMode: __DEV__ });
  }, []);

  return (
    <HydratorProvider<AppState>
      source={createNativeHydrationSource()}
      schema={appSchema}
      minVersion={1}
      maxVersion={1}
      getBaseState={() => state}
      onHydrate={(result) => {
        if (!result.ok) return;
        setState((prev) => applyPatch(prev, result.patch));
      }}
      onWarn={(msg) => console.warn('[Hydrator]', msg)}
      onError={(err) => console.error('[Hydrator]', err.code, err.message)}
    >
      {/* app tree */}
    </HydratorProvider>
  );
}
```

`HydratorProvider` hydrates on **app launch** and when returning to the **foreground**. Call `useHydrator().hydrateNow()` for manual triggers.

## Architecture

```
Deep link (app://hydrate/<reqId>)
  → native secure store lookup
  → async chunk reassembly + Ed25519 verify + AES-GCM decrypt
  → JS validation (version + schema + claims routing)
  → computeDiff → HydrationResult<Patch>
  → onHydrate → client applies patch
```

Routing context (`session` / `guest` / `ephemeral`) lives in **signed payload claims**, never in URL query parameters.

## Native bridge

| API | Purpose |
|-----|---------|
| `configureNativeHydrator({ testMode, chunkThreshold, reassemblyTimeoutMs })` | Runtime native options |
| `createNativeHydrationSource()` | Production `HydrationSource` |
| `extractHydrationReqId(url)` | Parse `reqId` from a deep link |
| `storeHydrationPayload(wire)` | Persist a pre-signed wire payload |
| `sealAndStoreHydrationPayload({ reqId, state, ctx })` | Encrypt/sign/store (requires `testMode` today) |
| `purgeExpiredHydrationEntries()` | TTL sweep |
| `inspectNativeHydrationStorage()` | Diagnostics snapshot |

Import native helpers from `prism-nexus` or `prism-nexus/native`.

### Chunking (>20 KiB)

Payloads whose single-chunk ciphertext exceeds **20 KiB** are split into **4 KiB** plaintext slices. Reassembly runs on a background worker with HMAC validation per chunk and a configurable timeout (`REASSEMBLY_TIMEOUT`).

## `@experimental applyPatch`

```ts
import { applyPatch } from 'prism-nexus';

const next = applyPatch(current, result.patch);
```

Returns a new object reference (structural sharing along mutated paths). Marked experimental because arbitrary JSON Pointer application against strongly-typed RN state can be error-prone — prefer typed reducers for critical slices.

## Testing (`prism-nexus/testing`)

```ts
import {
  createTestHydratorHarness,
  mockHydratorExtractor,
  inspectHydrationState,
  simulateTTLExpiry,
  mergeHydrationFallback,
  resolveHydrationResult,
} from 'prism-nexus/testing';
```

| Utility | Purpose |
|---------|---------|
| `mockHydratorExtractor()` | Synthesise `{ reqId, url }` locators |
| `createTestHydratorHarness()` | Store + mock `HydrationSource` for unit tests |
| `inspectHydrationState()` | Snapshot shared test store (`stored`, `cached`, `errors`) |
| `simulateTTLExpiry()` | Expire all in-memory test entries |
| `mergeHydrationFallback()` | Apply failure fallback with an explicit warning |
| `resolveHydrationResult()` | Route success/failure in `onHydrate` handlers |

On web or in Jest without native modules, use `createMockHydrationSource(store)` with `TestHydrationStore` instead of `createNativeHydrationSource()`.

## Error codes

| Code | Meaning |
|------|---------|
| `SCHEMA_VERSION_MISMATCH` | Payload version outside `minVersion`/`maxVersion` |
| `SCHEMA_VALIDATION_FAILED` | Zod/schema parse failed |
| `SIGNATURE_INVALID` | Ed25519 verification failed |
| `DECRYPTION_FAILED` | AES-GCM decrypt failed |
| `CHUNK_CORRUPTION` | Chunk HMAC or size mismatch |
| `CHUNK_SEQUENCE_GAP` | Missing chunk sequence |
| `REASSEMBLY_TIMEOUT` | Async reassembly exceeded timeout |
| `TTL_EXPIRED` | Ephemeral storage TTL (300s) elapsed |
| `STORAGE_QUOTA_EXCEEDED` | Native cache exceeded 50 MiB |
| `NATIVE_MODULE_UNAVAILABLE` | Expo module not linked |
| `STALE_REQUEST` | Superseded by a newer `reqId` |
| `MALFORMED_PAYLOAD` | Wire/storage shape invalid |

## Benchmarks

Profile `computeDiff`, `applyPatch`, and the JS hydration pipeline locally:

```sh
yarn benchmark
```

Sanity budgets are enforced in CI via `src/benchmarks/__tests__/patch.bench.test.ts` and `hydration.bench.test.ts` (< 50ms mean per op).

## Concurrency & race safety

- **`HydrationQueue`** serializes overlapping hydration attempts and applies only the latest submission. Superseded work is skipped when possible; stale completions emit `onWarn` and never reach `onHydrate`.
- **`HydratorProvider`** coalesces concurrent lifecycle triggers so a burst of `appLaunch` + foreground events results in a single native resolve pass followed by the newest queued result.
- **Native TTL purge** skips `reqId`s currently locked for decryption/reassembly, preventing background cleanup from racing active hydration.

## Example app

```sh
yarn example start          # Expo dev client
yarn example ios            # Run on iOS simulator (after prebuild)
yarn example android        # Run on Android emulator
```

The example demonstrates small and large (>20 KiB) payload seeding, native `testMode`, and mock fallback on web.

## EAS Build

`example/eas.json` ships development, preview, and production profiles for the example app:

```sh
cd example
npx eas-cli build --profile development --platform ios
npx eas-cli build --profile preview --platform all
```

Prerequisites:

1. `npx expo prebuild` (EAS runs this automatically)
2. `expo-dev-client` for the `development` profile
3. Configure `eas.json` submit credentials for production releases

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
