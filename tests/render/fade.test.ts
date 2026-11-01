import { describe, expect, it } from 'vitest';
import { fadeKey, nextFade, NO_FADE, topAlpha, type FadeState } from '../../src/render/fade';

const MS = 150;

describe('cross-fade', () => {
  it('shows the first look at once, without a fade', () => {
    const s = nextFade(NO_FADE, 'puppet', 0, MS);
    expect(s).toMatchObject({ baseKey: 'puppet', dir: null });
    expect(topAlpha(s, 0, MS)).toBe(0);
  });

  it('fades the new look in over the old one at full alpha, then makes it the base', () => {
    let s = nextFade(NO_FADE, 'puppet', 0, MS);
    s = nextFade(s, 'sit', 1000, MS);
    expect(s).toMatchObject({ base: 0, baseKey: 'puppet', topKey: 'sit', dir: 'in' });
    expect(topAlpha(s, 1075, MS)).toBeCloseTo(0.5);
    s = nextFade(s, 'sit', 1200, MS);
    expect(s).toMatchObject({ base: 1, baseKey: 'sit', topKey: null, dir: null });
  });

  it('fades back out without a pop when the pose flips back mid-fade', () => {
    let s: FadeState = nextFade(NO_FADE, 'puppet', 0, MS);
    s = nextFade(s, 'sit', 1000, MS);
    const before = topAlpha(s, 1060, MS);
    s = nextFade(s, 'puppet', 1060, MS);
    expect(s).toMatchObject({ baseKey: 'puppet', topKey: 'sit', dir: 'out' });
    // Continuous: the top look keeps its alpha and then drops; the base never changed.
    expect(topAlpha(s, 1060, MS)).toBeCloseTo(before);
    expect(topAlpha(s, 1070, MS)).toBeLessThan(before);
    s = nextFade(s, 'puppet', 1300, MS);
    expect(s).toMatchObject({ base: 0, baseKey: 'puppet', dir: null });
  });

  it('treats the walk cycle frames as one look', () => {
    expect(fadeKey('walk-2')).toBe(fadeKey('walk-5'));
    expect(fadeKey('sit')).toBe('sit');
  });
});
