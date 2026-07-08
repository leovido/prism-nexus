/**
 * RFC 6901 JSON Pointer helpers.
 *
 * A pointer is a string of `/`-separated, escaped reference tokens. The empty
 * string points at the whole document. `~1` decodes to `/` and `~0` to `~`.
 */

/** Escape a single reference token for embedding in a pointer. */
export function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Decode a single escaped reference token. Order matters: `~1` before `~0`. */
export function unescapeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Parse a pointer into its decoded reference tokens. */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') {
    return [];
  }
  if (pointer[0] !== '/') {
    throw new Error(`Invalid JSON Pointer: ${JSON.stringify(pointer)}`);
  }
  return pointer.slice(1).split('/').map(unescapeToken);
}

/** Build a pointer from decoded reference tokens. */
export function buildPointer(tokens: readonly string[]): string {
  if (tokens.length === 0) {
    return '';
  }
  return `/${tokens.map(escapeToken).join('/')}`;
}

/** Append a decoded token to a pointer, returning a new pointer. */
export function appendPointer(pointer: string, token: string | number): string {
  return `${pointer}/${escapeToken(String(token))}`;
}
