import { describe, expect, it } from 'vitest';
import { debugEnabled, FrameStats, formatSummary } from '../../src/render/frameStats';

describe('FrameStats', () => {
  it('sums up the last second only', () => {
    const s = new FrameStats();
    s.add(100, 9, 0);
    for (let i = 1; i <= 60; i++) s.add(i === 30 ? 33 : 16, i === 30 ? 6 : 2, 1000 + i * 16);
    const sum = s.summary();
    expect(sum.fps).toBe(60);
    expect(sum.worstMs).toBe(33);
    expect(sum.avgMs).toBeCloseTo((59 * 16 + 33) / 60);
    expect(sum.workWorstMs).toBe(6);
    expect(formatSummary(sum)).toBe('60 fps  avg 16.3 ms  worst 33.0 ms\nwork avg 2.1 ms  worst 6.0 ms');
  });

  it('is empty before any frame', () => {
    expect(new FrameStats().summary()).toEqual({ fps: 0, avgMs: 0, worstMs: 0, workAvgMs: 0, workWorstMs: 0 });
  });
});

describe('debugEnabled', () => {
  it('turns on from the query, local storage or the environment', () => {
    expect(debugEnabled('?speed=2&debug=1', null, undefined)).toBe(true);
    expect(debugEnabled('', '1', undefined)).toBe(true);
    expect(debugEnabled('', null, '1')).toBe(true);
    expect(debugEnabled('?debug=0', '0', '')).toBe(false);
  });
});
