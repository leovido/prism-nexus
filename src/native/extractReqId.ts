/** Path segment that locates a hydration request in a deep link. */
export const HYDRATE_PATH = '://hydrate/';

/**
 * Pure-JS deep-link extractor. Routing context is never read from the URL —
 * only the opaque `reqId` after `://hydrate/` is returned.
 */
export function extractReqIdFromUrl(url: string): string | null {
  const index = url.indexOf(HYDRATE_PATH);
  if (index === -1) {
    return null;
  }
  const reqId = url.slice(index + HYDRATE_PATH.length);
  return reqId.length > 0 ? reqId : null;
}
