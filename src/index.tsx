export { multiply } from './multiply';

export { HYDRATION_ERROR_CODES, HydrationError } from './errors';
export type { HydrationErrorCode, HydrationErrorOptions } from './errors';

export { DEFAULT_CHUNK_THRESHOLD } from './types';
export type {
  CustomResolver,
  DeepPatch,
  HydrationContext,
  HydrationOptions,
  HydrationResult,
  MergeStrategy,
  SchemaValidator,
} from './types';

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

export { assertVersionInRange, validateWithSchema } from './validation';

export {
  HYDRATION_CONTEXTS,
  isHydrationContext,
  routeContext,
} from './routing';
export type { HydrationClaims } from './routing';

export { HydrationQueue, runHydration } from './hydration';
export type { HydrationEnvelope, ScheduledRequest } from './hydration';

export {
  createHydrationDispatch,
  HydratorProvider,
  useHydrationController,
  useHydrator,
} from './provider';
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
  configureNativeHydrator,
  createNativeHydrationSource,
  extractHydrationReqId,
  extractReqIdFromUrl,
  getNativeHydratorModule,
  inspectNativeHydrationStorage,
  isNativeHydratorAvailable,
  mapNativeError,
  purgeExpiredHydrationEntries,
  requireNativeHydratorModule,
  sealAndStoreHydrationPayload,
  storeHydrationPayload,
} from './native';
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
