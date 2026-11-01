import { describe, expect, it } from 'vitest';
import { HEART_BURST_SECONDS, MAX_HEARTS, heartBurst, risingHearts, SPARKLE_SECONDS, sparkleBurst } from '../../src/render/effects';

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

describe('heartBurst', () => {
  it('is empty before and after the burst', () => {
    expect(heartBurst(-0.01)).toEqual([]);
    expect(heartBurst(HEART_BURST_SECONDS)).toEqual([]);
    expect(heartBurst(Infinity)).toEqual([]);
  });

  it('shows a few hearts that rise and fade out', () => {
    const early = heartBurst(0.1 * HEART_BURST_SECONDS);
    const late = heartBurst(0.9 * HEART_BURST_SECONDS);
    expect(early.length).toBe(3);
    expect(late[0]!.y).toBeLessThan(early[0]!.y);
    expect(late[0]!.alpha).toBeLessThan(early[0]!.alpha);
    for (const h of [...early, ...late]) {
      expect(h.alpha).toBeGreaterThanOrEqual(0);
      expect(h.alpha).toBeLessThanOrEqual(1);
    }
  });
});

describe('sparkleBurst', () => {
  it('is empty before and after the sparkle', () => {
    expect(sparkleBurst(-0.01)).toEqual([]);
    expect(sparkleBurst(SPARKLE_SECONDS)).toEqual([]);
    expect(sparkleBurst(Infinity)).toEqual([]);
  });

  it('stars burst outward around the cat and fade', () => {
    const early = sparkleBurst(0.1 * SPARKLE_SECONDS);
    const late = sparkleBurst(0.9 * SPARKLE_SECONDS);
    expect(early.length).toBe(6);
    const reach = (s: { x: number; y: number }): number => Math.hypot(s.x, s.y + 16);
    expect(reach(late[0]!)).toBeGreaterThan(reach(early[0]!));
    expect(late[0]!.alpha).toBeLessThan(early[0]!.alpha);
    for (const s of [...early, ...late]) {
      expect(s.alpha).toBeGreaterThanOrEqual(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
  });
});
