import { mapNativeError } from './mapNativeError';
import { requireNativeHydratorModule } from './PrismNexusHydratorModule';
import type { NativeHydratorConfigureOptions } from './wirePayload';

/** Push runtime options (e.g. testMode) to the native hydrator module. */
export async function configureNativeHydrator(
  options: NativeHydratorConfigureOptions
): Promise<void> {
  const module = requireNativeHydratorModule();
  try {
    await module.configure(options);
  } catch (cause) {
    throw mapNativeError(cause);
  }
}
