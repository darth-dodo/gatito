/**
 * Cross-fade between two looks of a pet. The base look is always drawn at full alpha; the top look fades in
 * over it (or back out, when the pose flips back mid-fade), so a cat is never see-through and never pops.
 */
export interface FadeState {
  /** Which of the two looks is the base, drawn underneath at full alpha. */
  base: 0 | 1;
  baseKey: string | null;
  topKey: string | null;
  dir: 'in' | 'out' | null;
  /** Top alpha when the current fade started, and when it started (ms). */
  from: number;
  start: number;
}

export const NO_FADE: FadeState = { base: 0, baseKey: null, topKey: null, dir: null, from: 0, start: 0 };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Pure: the top look's alpha at `now`. */
export function topAlpha(s: FadeState, now: number, ms: number): number {
  if (!s.dir) return 0;
  const d = (now - s.start) / ms;
  return clamp01(s.dir === 'in' ? s.from + d : s.from - d);
}

/** Pure: the fade after showing the look `key` at `now`. */
export function nextFade(prev: FadeState, key: string, now: number, ms: number): FadeState {
  let s = prev;
  if (s.dir) {
    const a = topAlpha(s, now, ms);
    if (s.dir === 'in' && a >= 1) {
      s = { base: s.base === 0 ? 1 : 0, baseKey: s.topKey, topKey: null, dir: null, from: 0, start: now };
    } else if (s.dir === 'out' && a <= 0) {
      s = { ...s, topKey: null, dir: null };
    }
  }
  if (s.baseKey === null) return { ...s, baseKey: key };
  if (!s.dir) return key === s.baseKey ? s : { ...s, topKey: key, dir: 'in', from: 0, start: now };
  const a = topAlpha(s, now, ms);
  if (key === s.topKey) return s.dir === 'out' ? { ...s, dir: 'in', from: a, start: now } : s;
  if (key === s.baseKey) return s.dir === 'in' ? { ...s, dir: 'out', from: a, start: now } : s;
  // A third look mid-fade takes over the layer it is replacing.
  return s.dir === 'in' ? { ...s, topKey: key } : { ...s, baseKey: key };
}

/** Looks that swap without a fade share a key: the walk cycle frames are one look. */
export function fadeKey(pose: string): string {
  return pose.startsWith('walk-') ? 'walk' : pose;
}
