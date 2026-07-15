# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-10

First stable release of the Prism Nexus hydrator SDK — a secure, transport-agnostic
state hydration layer for React Native.

### Added

- **Core pipeline:** `runHydration`, `HydrationResult<T>`, schema/version validation, claims routing, and JSON Patch diff computation.
- **Declarative provider:** `HydratorProvider`, `useHydrator`, lifecycle triggers (`appLaunch`, foreground resume, `hydrateNow()`).
- **Native bridge (Expo Modules):** AES-GCM encryption, Ed25519 signatures, device-bound keys, 300s TTL, secure ephemeral storage (iOS Keychain + Android Keystore).
- **Chunking:** Automatic split above 20 KiB with async background reassembly, per-chunk HMAC validation, and configurable timeout.
- **DX:** `@experimental applyPatch`, `prism-nexus/testing` utilities, benchmark suite (`yarn benchmark`), example app, and EAS build templates.
- **Stabilization:** Serialized `HydrationQueue` with generation-based stale detection, overlapping dispatch coalescing, and native TTL purge that skips in-flight `reqId`s.

### Security

- Routing context (`session` / `guest` / `ephemeral`) travels in signed payload claims, never URL query parameters.
- Strict `minVersion` / `maxVersion` enforcement with no silent fallbacks.
- Storage quota cap (50 MiB) and monotonic-clock TTL to resist timezone manipulation.

[1.0.0]: https://github.com/leovidogithub.com/leovido/prism-nexus/releases/tag/v1.0.0
