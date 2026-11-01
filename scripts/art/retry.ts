/** Request failures worth retrying: timeouts, rate limits and server errors. Other 4xx fail fast. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Parses a response body as JSON, or undefined when it is not JSON (for example an HTML 502 page). */
export function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
