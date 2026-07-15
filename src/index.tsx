export type { HydrationErrorCode, HydrationErrorOptions } from './errors';

export { HYDRATION_ERROR_CODES, HydrationError } from './errors';
export type { HydrationEnvelope, ScheduledRequest } from './hydration';
export { HydrationQueue, runHydration } from './hydration';
export { multiply } from './multiply';
export type {
  HydrationWireChunk,
  HydrationWirePayload,
  NativeHydrationClaims,
  NativeHydrationEnvelope,
  NativeHydrationSourceOptions,
  NativeHydrationTrigger,
  NativeHydratorConfigureOptions,
  NativeStorageSnapshot,
  PrismNexusHydratorNativeSpec,
  SealAndStorePayloadInput,
} from './native';
export {
  configureNativeHydrator,
  createNativeHydrationSource,
  estimateChunkCount,
  estimateSingleChunkCiphertextBytes,
  extractHydrationReqId,
  extractReqIdFromUrl,
  getNativeHydratorModule,
  inspectNativeHydrationStorage,
  isNativeHydratorAvailable,
  mapNativeError,
  NATIVE_CHUNK_PLAINTEXT_SLICE,
  NATIVE_CHUNK_THRESHOLD_BYTES,
  NATIVE_GCM_TAG_BYTES,
  NATIVE_REASSEMBLY_TIMEOUT_MS,
  purgeExpiredHydrationEntries,
  requireNativeHydratorModule,
  resolvePlaintextSliceSize,
  sealAndStoreHydrationPayload,
  shouldChunkPlaintext,
  storeHydrationPayload,
} from './native';
export {
  appendPointer,
  applyPatch,
  buildPointer,
  computeDiff,
  deepEqual,
  escapeToken,
  parsePointer,
  unescapeToken,
} from './patch';
export type {
  HydrationDispatchDeps,
  HydrationSource,
  HydrationTrigger,
  HydratorContextValue,
  HydratorController,
  HydratorControllerConfig,
  HydratorProviderProps,
} from './provider';
export {
  createHydrationDispatch,
  HydratorProvider,
  useHydrationController,
  useHydrator,
} from './provider';
export type { HydrationClaims } from './routing';
export {
  HYDRATION_CONTEXTS,
  isHydrationContext,
  routeContext,
} from './routing';
export type {
  CustomResolver,
  DeepPatch,
  HydrationContext,
  HydrationOptions,
  HydrationResult,
  MergeStrategy,
  SchemaValidator,
} from './types';
export { DEFAULT_CHUNK_THRESHOLD } from './types';
export { assertVersionInRange, validateWithSchema } from './validation';
