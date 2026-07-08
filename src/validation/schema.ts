import { HydrationError } from '../errors';
import type { SchemaValidator } from '../types';

/**
 * Enforce strict, inclusive `[minVersion, maxVersion]` version bounds.
 *
 * There are no silent fallbacks: a version outside the window, or a
 * non-integer version, throws {@link HydrationError} with
 * `SCHEMA_VERSION_MISMATCH`.
 */
export function assertVersionInRange(
  version: number,
  minVersion: number,
  maxVersion: number
): void {
  if (!Number.isInteger(version)) {
    throw new HydrationError(
      `Payload version must be an integer, received ${version}`,
      {
        code: 'SCHEMA_VERSION_MISMATCH',
        details: { version },
      }
    );
  }
  if (version < minVersion || version > maxVersion) {
    throw new HydrationError(
      `Payload version ${version} outside accepted range [${minVersion}, ${maxVersion}]`,
      {
        code: 'SCHEMA_VERSION_MISMATCH',
        details: { version, minVersion, maxVersion },
      }
    );
  }
}

/**
 * Validate and narrow `input` using `schema`, translating any thrown validation
 * error into a {@link HydrationError} with `SCHEMA_VALIDATION_FAILED` while
 * preserving the original error as `cause`.
 */
export function validateWithSchema<T>(
  schema: SchemaValidator<T>,
  input: unknown
): T {
  try {
    return schema.parse(input);
  } catch (cause) {
    throw new HydrationError('Payload failed schema validation', {
      code: 'SCHEMA_VALIDATION_FAILED',
      cause,
    });
  }
}
