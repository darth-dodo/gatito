import { describe, expect, it } from 'vitest';
import { isRetryableStatus, parseBody } from '../../scripts/art/retry';

describe('isRetryableStatus', () => {
  it('retries 408, 429 and 5xx only', () => {
    for (const s of [408, 429, 500, 502, 503]) expect(isRetryableStatus(s)).toBe(true);
    for (const s of [400, 401, 402, 403, 404, 422]) expect(isRetryableStatus(s)).toBe(false);
  });
});

describe('parseBody', () => {
  it('parses JSON and returns undefined for an HTML error page', () => {
    expect(parseBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseBody('<html>502 Bad Gateway</html>')).toBeUndefined();
  });
});
