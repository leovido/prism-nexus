export {
  __resetNativeHydratorModuleCacheForTests,
  getNativeHydratorModule,
  isNativeHydratorAvailable,
  requireNativeHydratorModule,
} from './PrismNexusHydratorModule';
export {
  createNativeHydrationSource,
  extractHydrationReqId,
  inspectNativeHydrationStorage,
  purgeExpiredHydrationEntries,
} from './nativeHydrationSource';
export type { NativeHydrationSourceOptions } from './nativeHydrationSource';
export { extractReqIdFromUrl, HYDRATE_PATH } from './extractReqId';
export { mapNativeError } from './mapNativeError';
export { NATIVE_ERROR_CODE_MAP } from './types';
export { configureNativeHydrator } from './configure';
export {
  estimateChunkCount,
  estimateSingleChunkCiphertextBytes,
  NATIVE_CHUNK_PLAINTEXT_SLICE,
  NATIVE_CHUNK_THRESHOLD_BYTES,
  NATIVE_GCM_TAG_BYTES,
  NATIVE_REASSEMBLY_TIMEOUT_MS,
  resolvePlaintextSliceSize,
  shouldChunkPlaintext,
} from './chunking';
export {
  sealAndStoreHydrationPayload,
  storeHydrationPayload,
} from './storePayload';
export type { SealAndStorePayloadInput } from './storePayload';
export {
  buildSignatureMessage,
  computeChunksHmac,
  NATIVE_KID_V1,
  NATIVE_STORAGE_QUOTA_BYTES,
  NATIVE_TTL_SECONDS,
} from './wirePayload';
export type {
  HydrationWireChunk,
  HydrationWirePayload,
  NativeHydratorConfigureOptions,
} from './wirePayload';
export type {
  NativeHydrationClaims,
  NativeHydrationEnvelope,
  NativeHydrationErrorPayload,
  NativeHydrationTrigger,
  NativeStorageSnapshot,
  PrismNexusHydratorNativeSpec,
} from './types';
