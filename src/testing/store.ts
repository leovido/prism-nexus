import type { HydrationError } from '../errors';
import type { HydrationEnvelope } from '../hydration';

export interface StoredEntry {
  reqId: string;
  envelope: HydrationEnvelope;
  createdAt: number;
  expired: boolean;
}

export interface HydrationStateSnapshot {
  /** Request ids currently held, in insertion order. */
  stored: string[];
  /** Count of entries still live (not expired). */
  cached: number;
  /** Errors recorded during the session. */
  errors: HydrationError[];
}

/**
 * In-memory stand-in for the native secure store, used under `testMode`. It
 * lets tests seed payloads, inspect what is held, and simulate TTL expiry
 * without touching the native bridge, Keychain, or Keystore.
 */
export class TestHydrationStore {
  private readonly entries = new Map<string, StoredEntry>();
  private readonly errors: HydrationError[] = [];

  put(envelope: HydrationEnvelope, createdAt: number = Date.now()): void {
    this.entries.set(envelope.reqId, {
      reqId: envelope.reqId,
      envelope,
      createdAt,
      expired: false,
    });
  }

  recordError(error: HydrationError): void {
    this.errors.push(error);
  }

  /** Return and consume the oldest live entry, or `null` if none remain. */
  takeNextLive(): HydrationEnvelope | null {
    for (const entry of this.entries.values()) {
      if (!entry.expired) {
        this.entries.delete(entry.reqId);
        return entry.envelope;
      }
    }
    return null;
  }

  /** Mark every held entry expired, mirroring a TTL sweep. */
  expireAll(): void {
    for (const entry of this.entries.values()) {
      entry.expired = true;
    }
  }

  inspect(): HydrationStateSnapshot {
    const stored: string[] = [];
    let cached = 0;
    for (const entry of this.entries.values()) {
      stored.push(entry.reqId);
      if (!entry.expired) {
        cached += 1;
      }
    }
    return { stored, cached, errors: [...this.errors] };
  }

  reset(): void {
    this.entries.clear();
    this.errors.length = 0;
  }
}
