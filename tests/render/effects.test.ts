import { describe, expect, it } from 'vitest';
import { MAX_HEARTS, risingHearts } from '../../src/render/effects';

describe('risingHearts', () => {
  it('shows nothing before purring starts', () => {
    expect(risingHearts(-0.1)).toEqual([]);
  });

  it('never has more than 6 hearts alive', () => {
    expect(MAX_HEARTS).toBeLessThanOrEqual(6);
    for (let t = 0; t < 10; t += 0.05) {
      expect(risingHearts(t).length).toBeLessThanOrEqual(MAX_HEARTS);
    }
  });

  it('rises and fades within 0..1 alpha', () => {
    const a = risingHearts(0.1)[0]!;
    const b = risingHearts(0.5)[0]!;
    expect(b.y).toBeLessThan(a.y);
    for (let t = 0; t < 5; t += 0.1) {
      for (const h of risingHearts(t)) {
        expect(h.alpha).toBeGreaterThanOrEqual(0);
        expect(h.alpha).toBeLessThanOrEqual(1);
      }
    }
  });

  it('staggers hearts so more appear as the purr goes on', () => {
    expect(risingHearts(0).length).toBe(1);
    expect(risingHearts(2).length).toBeGreaterThan(1);
  });
});
