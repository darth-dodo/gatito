import { describe, expect, it } from 'vitest';
import { activeSeconds, clampFrameDelta } from '../../src/brain/clock';

describe('activeSeconds', () => {
  it('idle user stops the clock', () => {
    expect(activeSeconds(1, { userIdleSeconds: 301, napTime: false })).toBe(0);
    expect(activeSeconds(1, { userIdleSeconds: 299, napTime: false })).toBe(1);
    expect(activeSeconds(1, { userIdleSeconds: 300, napTime: false })).toBe(0);
  });
  it('nap time stops the clock', () => {
    expect(activeSeconds(1, { userIdleSeconds: 0, napTime: true })).toBe(0);
  });
  it('negative deltas count as zero', () => {
    expect(activeSeconds(-1, { userIdleSeconds: 0, napTime: false })).toBe(0);
  });
});

describe('clampFrameDelta', () => {
  it('huge deltas are clamped', () => {
    expect(clampFrameDelta(7200)).toBe(0.25);
  });
  it('passes small deltas and floors negatives', () => {
    expect(clampFrameDelta(0.016)).toBe(0.016);
    expect(clampFrameDelta(-3)).toBe(0);
  });
});
