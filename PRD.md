# PRD: `@react-native/hydrator` SDK
**Version:** 0.1.0 (MVP)  
**Status:** Final Draft  
**Principles:** First Principles Design | Low Coupling / High Cohesion | Strict Validation | Declarative DX

---
## 🔹 1. Problem & Goals
**Problem:** React Native apps lack a secure, type-safe, and transport-agnostic state hydration mechanism that operates offline, survives app lifecycle transitions, and avoids URL leakage. Existing solutions either couple tightly to specific stores, leak routing context to query parameters, or lack cryptographic guarantees.

**Goals:**
- Provide a pure transport & validation layer that returns `Patch<T>` for client-controlled state application.
- Enforce strict schema versioning with zero silent fallbacks.
- Support payloads >20KB via secure chunking + async JSI reassembly.
- Route hydration context (`session`/`guest`) via payload claims, not URL parameters.
- Maintain 300s TTL with automatic storage cleanup.
- Expose declarative API, test utilities, and `onWarn`/`onError` hooks.

**Non-Goals:**
- Network sync, server reconciliation, or per-session key derivation (MVP uses single device-bound key).
- Farcaster, blockchain, or Web3 context.
- Native React Error Boundary bubbling for hydration failures.

---
## 🔹 2. Architecture & Data Flow
```
[Deep Link / URI] 
  → Extract reqId 
  → Native Storage Bridge (Expo Modules) 
  → Async JSI Reassembly 
  → Validate Schema & Claims 
  → Compute Diff → Return Patch<T> 
  → onHydrate Callback 
  → Client Apply Patch
```
**Layer Separation:**
- **JS/TS Layer:** Orchestration, schema validation, diff computation, claim routing, callback dispatch.
- **Native Layer (Expo Modules):** Secure ephemeral storage, AES-GCM encryption/decryption, Ed25519 signature verification, TTL enforcement, hardware-backed key access.

---
## 🔹 3. Core Components & API Surface

### Types
```ts
export type HydrationContext = 'session' | 'guest' | 'ephemeral';

export interface DeepPatch<T> {
  op: 'replace' | 'add' | 'remove';
  path: string; // JSON Pointer (RFC 6902)
  value?: unknown;
}

export interface HydrationResult<T> {
  ok: true;
  patch: DeepPatch<T>[];
  version: number;
  context: HydrationContext;
  warnings?: string[];
} | {
  ok: false;
  error: HydrationError;
  fallback: Partial<T>;
};

export interface HydrationOptions<T> {
  schema: z.ZodType<T> | JsonSchema;
  minVersion: number;
  maxVersion: number;
  strategy: 'deep-merge' | 'last-write-wins' | CustomResolver;
  chunkThreshold?: number; // default: 20 * 1024
  onHydrate: (result: HydrationResult<T>) => void;
  onWarn?: (msg: string) => void;
  onError?: (err: HydrationError) => void;
  testMode?: boolean;
}
```

### Declarative Provider (Approach A)
```tsx
<HydratorProvider<T>
  schema={appSchema}
  minVersion={1}
  maxVersion={1}
  strategy="deep-merge"
  onHydrate={(result) => {
    if (!result.ok) return;
    useAppStore.setState((prev) => applyPatch(prev, result.patch));
  }}
  onWarn={(msg) => console.warn('[Hydrator]', msg)}
  onError={(err) => logger.error('Hydration failed', err)}
/>
```

### Experimental Patch Application (Approach C Helper)
```ts
/** @experimental applyPatch merges a JSON Patch into a target object. 
 *  Marked experimental due to dynamic typing limits in RN. 
 *  Use with caution in production state slices. */
export function applyPatch<T>(target: T, patch: DeepPatch<T>[]): T {
  // RFC 6902 compliant implementation
  // Returns new object reference to preserve React reconciliation
}
```

---
## 🔹 4. Security & Cryptography Model (MVP)
- **Key Management:** Single device-bound key per app.
  - iOS: `kSecAttrAccessibleWhenUnlocked` in Keychain
  - Android: Hardware-backed Keystore (`setUserAuthenticationRequired(false)`)
  - `kid: "v1"` embedded in unencrypted header for future migration routing
- **Claims Routing:** `ctx` field in unencrypted payload header dictates decryption path. No query params for routing.
- **Integrity:** Ed25519 signature over `v + ts + ctx + kid + chunksHMAC`
- **Encryption:** AES-GCM per chunk. IV stored per chunk metadata.
- **TTL:** 300s from creation. Monotonic clock used for calculation to prevent timezone bypass.
- **Validation:** Strict `minVersion`/`maxVersion` enforcement. Mismatch throws `HydrationError`.

---
## 🔹 5. Transport & Chunking (>20KB)
- **Threshold:** `>20KB` encrypted payload triggers chunking.
- **Chunk Structure:**
  ```json
  {
    "reqId": "<24-byte-crypto-random>",
    "v": 1, "ts": <unix>, "ctx": "<context>", "kid": "v1",
    "sig": "<ed25519>",
    "chunks": [
      { "seq": 0, "size": 4096, "iv": "<base64>", "hmac": "<sha256>", "data": "<base64url>" }
    ]
  }
  ```
- **Async JSI Reassembly:** 
  - Reassembly runs on JSI worker thread pool
  - Validates sequence order, size, and HMAC before decryption
  - Fails fast on corruption/mismatch
  - Prevents main thread blocking during large payload reconstruction
- **Storage Bridge:** 
  - iOS: `Library/Caches/Hydrator/` + `FileProtectionComplete`
  - Android: `EncryptedFile` (AES-GCM) or `EncryptedSharedPreferences`
  - TTL purge via native background task (Expo Modules API)

---
## 🔹 6. Lifecycle & State Application
- **Triggers:** `appLaunch`, `onAppStateChange` (background → active), explicit `hydrateNow()`
- **Debounce/Queue:** Concurrent hydration requests are queued. Only the latest `reqId` is applied. Stale requests are discarded with `onWarn`.
- **Patch Application:** SDK returns `Patch<T>`. Client owns application timing, batching, and error boundaries. `applyPatch` is bundled for DX but marked `@experimental`.
- **Conflict Resolution:** SDK does not enforce merge. Client provides `strategy` (defaults to `'deep-merge'`).

---
## 🔹 7. DX, Testing & Debugging
- **Test Utilities:**
  ```ts
  export const mockHydratorExtractor = (payload: any) => ({ reqId, url });
  export const inspectHydrationState = () => ({ stored, cached, errors });
  export const simulateTTLExpiry = () => void;
  ```
- **Logging:** SDK emits to `onWarn`/`onError`. Client handles all logging. No console/network leakage.
- **DevTools:** Optional `testMode: true` enables payload inspection middleware and skips TTL/cleanup.

---
## 🔹 8. Platform Constraints & Expo Modules Strategy
- **Expo Modules API:** Native bridge built with Expo Modules (Swift/Kotlin). Compatible with Expo SDK 50+ & RN 0.73+.
- **JSI Integration:** Async reassembly uses `expo-modules-core` JSI bridge. No blocking on main thread.
- **Bundle Size:** ~45KB gzipped (JS) + ~120KB native. Crypto libs tree-shaken.
- **Fallbacks:** If native module fails to load, SDK throws `HydrationError(code: 'NATIVE_MODULE_UNAVAILABLE')` and bails out safely.

---
## 🔹 9. Second-Order Thinking
1. **Key Rotation at Scale:** Single `v1` key creates legacy payload lock-in. *Mitigation:* Design `kid` fallback chain in v1.1 spec. Document migration window.
2. **Diff Performance on Large State:** JSON Patch computation is O(n) in depth/width. *Mitigation:* Cap path depth, memoize `applyPatch`, profile with `react-native-performance`.
3. **Storage Bridge Race Conditions:** Background purge vs active hydration. *Mitigation:* Atomic file rename on cleanup, read-lock `reqId` during hydration phase.
4. **Chunk Corruption Detection:** HMAC per chunk prevents silent corruption. *Mitigation:* Validate chunk count + reassembly timeout. Reject if `seq` gaps detected.
5. **TTL Bypass via Timezone Manipulation:** `ts` is susceptible to clock skew. *Mitigation:* Use monotonic clock (`process.hrtime` / `CFAbsoluteTimeGetCurrent`) for TTL calculation.
6. **Expo Compatibility:** Native modules require `expo prebuild` or EAS. *Mitigation:* Provide `react-native` standalone fallback in docs. Use `expo-modules-core` strictly.

---
## 🔹 10. Inversion Analysis (Catastrophic Failure Modes)
| Failure Mode | Root Cause | Mitigation |
|--------------|------------|------------|
| **Unbounded Memory Leak** | Chunks not purged on crash/app death | Enforce TTL + background cleanup + max storage quota (50MB) |
| **Weak Encryption / Key Compromise** | Keystore fallback to software key | Enforce hardware-backed keystore, reject non-hardware keys at runtime |
| **Store Race Conditions** | Multiple hydration triggers overlapping | Debounce triggers, queue hydration requests, use atomic state swaps |
| **URI Scheme Hijacking** | Malicious app intercepts `app://hydrate` | Require `kid` + signature validation, reject unverified payloads |
| **Silent Fallback Corruption** | Client ignores `HydrationError` | Enforce callback contract, provide `fallback()` helper with explicit warnings |
| **Schema Drift** | App updates schema, older links break | Strict versioning + explicit migration path in docs + deprecation warnings |
| **JSI Thread Deadlock** | Async reassembly blocks main thread | Isolate JSI work queue, add timeout fallback to `onError` |

---
## 🔹 11. Implementation Roadmap
1. **Phase 1 (Core):** JS/TS pipeline, schema validation, `HydrationResult<T>` types, declarative provider (`onHydrate`/`onWarn`/`onError`)
2. **Phase 2 (Native Bridge):** Expo Modules for secure storage, AES-GCM, Ed25519, TTL enforcement, `kid` routing
3. **Phase 3 (Chunking & JSI):** Async reassembly worker, HMAC validation, >20KB threshold logic, memory cleanup
4. **Phase 4 (DX & Testing):** `applyPatch` (experimental), test utilities, docs, benchmark suite, EAS build templates
5. **Phase 5 (Stabilization):** Performance profiling, race condition hardening, v1.0 release

---
### ✅ Next Steps
1. Confirm `applyPatch` experimental scope (v1.0 vs v1.1)
2. Approve Expo Modules architecture for native bridge (Swift/Kotlin + JSI worker)
3. Lock `HydrationError` code taxonomy & warning thresholds
4. I'll generate: 
   - Complete TypeScript type definitions
   - Expo Native Module scaffolding (Swift/Kotlin)
   - Async JSI reassembly implementation spec
   - Test utility & mock extraction pipeline

Reply with approvals or adjustments. I'll proceed to specification artifacts.