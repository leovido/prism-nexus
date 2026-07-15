import type { DeepPatch } from '../types';
import { parsePointer } from './jsonPointer';

type Json = unknown;
type JsonObject = Record<string, Json>;

function isObject(value: Json): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneContainer(node: Json): Json {
  if (Array.isArray(node)) {
    return node.slice();
  }
  if (isObject(node)) {
    return { ...node };
  }
  return node;
}

function toArrayIndex(
  token: string,
  length: number,
  allowAppend: boolean
): number {
  if (token === '-') {
    return length;
  }
  if (!/^(0|[1-9][0-9]*)$/.test(token)) {
    throw new Error(`Invalid array index token: ${JSON.stringify(token)}`);
  }
  const index = Number(token);
  const upper = allowAppend ? length : length - 1;
  if (index > upper) {
    throw new Error(`Array index ${index} out of bounds (length ${length})`);
  }
  return index;
}

function applyLeaf(container: Json, token: string, patch: DeepPatch): void {
  if (Array.isArray(container)) {
    if (patch.op === 'add') {
      container.splice(
        toArrayIndex(token, container.length, true),
        0,
        patch.value
      );
      return;
    }
    if (patch.op === 'replace') {
      container[toArrayIndex(token, container.length, false)] = patch.value;
      return;
    }
    container.splice(toArrayIndex(token, container.length, false), 1);
    return;
  }

  if (isObject(container)) {
    if (patch.op === 'remove') {
      if (!Object.hasOwn(container, token)) {
        throw new Error(`Cannot remove missing key: ${JSON.stringify(token)}`);
      }
      delete container[token];
      return;
    }
    container[token] = patch.value;
    return;
  }

  throw new Error(`Cannot apply op at leaf: target is not a container`);
}

function updatePath(
  node: Json,
  tokens: string[],
  index: number,
  patch: DeepPatch
): Json {
  const clone = cloneContainer(node);
  const token = tokens[index] as string;

  if (index === tokens.length - 1) {
    applyLeaf(clone, token, patch);
    return clone;
  }

  if (Array.isArray(clone)) {
    const childIndex = toArrayIndex(token, clone.length, false);
    clone[childIndex] = updatePath(clone[childIndex], tokens, index + 1, patch);
    return clone;
  }
  if (isObject(clone)) {
    if (!Object.hasOwn(clone, token)) {
      throw new Error(`Path segment not found: ${JSON.stringify(token)}`);
    }
    clone[token] = updatePath(clone[token], tokens, index + 1, patch);
    return clone;
  }

  throw new Error(
    `Cannot traverse into non-container at ${JSON.stringify(token)}`
  );
}

function applyOne(root: Json, patch: DeepPatch): Json {
  const tokens = parsePointer(patch.path);
  if (tokens.length === 0) {
    if (patch.op === 'remove') {
      throw new Error('Cannot remove document root');
    }
    return patch.value;
  }
  return updatePath(root, tokens, 0, patch);
}

/**
 * @experimental Applies an RFC 6902 JSON Patch to `target`, returning a new
 * object reference so React reconciliation sees a changed value. Nodes along
 * each mutated path are shallow-cloned (structural sharing); untouched
 * branches keep their original references.
 *
 * Marked experimental due to the dynamic-typing limits of applying arbitrary
 * pointers against strongly-typed RN state slices. Prefer a typed reducer for
 * critical production slices.
 */
export function applyPatch<T>(target: T, patch: DeepPatch<T>[]): T {
  let result: Json = target;
  for (const op of patch) {
    result = applyOne(result, op);
  }
  return result as T;
}
