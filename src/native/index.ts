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
export { configureNativeHydrator } from './configure';
export { extractReqIdFromUrl, HYDRATE_PATH } from './extractReqId';
export { mapNativeError } from './mapNativeError';
export type { NativeHydrationSourceOptions } from './nativeHydrationSource';
export {
  createNativeHydrationSource,
  extractHydrationReqId,
  inspectNativeHydrationStorage,
  purgeExpiredHydrationEntries,
} from './nativeHydrationSource';
export {
  __resetNativeHydratorModuleCacheForTests,
  getNativeHydratorModule,
  isNativeHydratorAvailable,
  requireNativeHydratorModule,
} from './PrismNexusHydratorModule';
export type { SealAndStorePayloadInput } from './storePayload';
export {
  sealAndStoreHydrationPayload,
  storeHydrationPayload,
} from './storePayload';
export type {
  NativeHydrationClaims,
  NativeHydrationEnvelope,
  NativeHydrationErrorPayload,
  NativeHydrationTrigger,
  NativeStorageSnapshot,
  PrismNexusHydratorNativeSpec,
} from './types';
export { NATIVE_ERROR_CODE_MAP } from './types';
export type {
  HydrationWireChunk,
  HydrationWirePayload,
  NativeHydratorConfigureOptions,
} from './wirePayload';
export {
  buildSignatureMessage,
  computeChunksHmac,
  NATIVE_KID_V1,
  NATIVE_STORAGE_QUOTA_BYTES,
  NATIVE_TTL_SECONDS,
} from './wirePayload';
