import { mapNativeError } from './mapNativeError';
import { requireNativeHydratorModule } from './PrismNexusHydratorModule';
import type { HydrationWirePayload } from './wirePayload';

/** Persist a signed wire payload in native ephemeral storage. */
export async function storeHydrationPayload(
  payload: HydrationWirePayload
): Promise<void> {
  const module = requireNativeHydratorModule();
  try {
    await module.storePayload(payload);
  } catch (cause) {
    throw mapNativeError(cause);
  }
}

export interface SealAndStorePayloadInput {
  reqId: string;
  state: unknown;
  ctx: string;
  version?: number;
  ts?: number;
}

/**
 * Encrypt, sign, and store a payload using device-bound native keys.
 * Requires native `testMode` (via {@link configureNativeHydrator}) until a
 * trusted external signer is integrated.
 */
export async function sealAndStoreHydrationPayload(
  input: SealAndStorePayloadInput
): Promise<HydrationWirePayload> {
  const module = requireNativeHydratorModule();
  try {
    return await module.sealAndStorePayload(input);
  } catch (cause) {
    throw mapNativeError(cause);
  }
}
