import { describe, expect, it } from 'vitest';
import type { Mood } from '../../src/brain/types';
import { ANIM_SECONDS, rigPose, type AnimName, type RigFrame } from '../../src/render/rig';
import { floatingZs } from '../../src/render/effects';

const m: Mood = { affection: 60, energy: 60 };
const STEP = 1 / 120;

function samples(anim: AnimName, from: number, to: number, mood: Mood = m): RigFrame[] {
  const out: RigFrame[] = [];
  for (let t = from; t <= to; t += STEP) out.push(rigPose(anim, t, mood));
  return out;
}

function rot(f: RigFrame, part: keyof RigFrame['parts']): number {
  const p = f.parts[part];
  if (!p) throw new Error(`missing part ${part}`);
  return p.rotation;
}

/** Counts how often a series changes direction. */
function reversals(values: number[]): number {
  let n = 0;
  let last = 0;
  for (let i = 1; i < values.length; i++) {
    const d = Math.sign(values[i]! - values[i - 1]!);
    if (d !== 0 && last !== 0 && d !== last) n++;
    if (d !== 0) last = d;
  }
  return n;
}

describe('rigPose', () => {
  it("behaviours use the spec's poses", () => {
    expect(rigPose('nap', 0, m).pose).toBe('sleep-curl');
    expect(rigPose('cuddle-nap', 0, m).pose).toBe('sleep-curl');
    expect(rigPose('loaf', 0, m).pose).toBe('loaf');
    expect(rigPose('idle-sit', 0, m).pose).toBe('sit');
    expect(rigPose('content-sit', 0, m).pose).toBe('sit');
    expect(rigPose('grumpy-sit', 0, m).pose).toBe('sit');
    expect(rigPose('stare', 0, m).pose).toBe('sit');
    expect(rigPose('groom', 0, m).pose).toBe('groom');
    expect(rigPose('stretch', 0, m).pose).toBe('stretch');
    expect(rigPose('sit-up', 0, m).pose).toBe('sit-up');
    expect(rigPose('dangle', 0, m).pose).toBe('dangle');
    expect(rigPose('belly-up', 0, m).pose).toBe('belly-up');
    expect(rigPose('walk', 0, m).pose).toBe('puppet');
    expect(rigPose('wander', 0, m).pose).toBe('puppet');
  });

  it('walking swings legs in pairs', () => {
    let checked = 0;
    for (const f of samples('walk', 0, 2)) {
      const fn = rot(f, 'leg-front-near');
      const bf = rot(f, 'leg-back-far');
      const ff = rot(f, 'leg-front-far');
      const bn = rot(f, 'leg-back-near');
      if (Math.abs(fn) < 1e-6) continue;
      expect(Math.sign(fn)).toBe(Math.sign(bf));
      expect(Math.sign(ff)).toBe(-Math.sign(fn));
      expect(Math.sign(bn)).toBe(-Math.sign(fn));
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
    const legs = samples('walk', 0, 2).map((f) => rot(f, 'leg-front-near'));
    expect(Math.max(...legs)).toBeGreaterThan(0);
    expect(Math.min(...legs)).toBeLessThan(0);
  });

  it('mood moves ears and tail', () => {
    const sad: Mood = { affection: 10, energy: 60 };
    const happy: Mood = { affection: 90, energy: 60 };
    for (const t of [0, 0.7, 3.3]) {
      // Ears rotate back (anticlockwise, negative) further when affection is low.
      expect(rot(rigPose('idle-sit', t, sad), 'ear-near')).toBeLessThan(
        rot(rigPose('idle-sit', t, happy), 'ear-near'),
      );
      expect(rot(rigPose('walk', t, sad), 'ear-far')).toBeLessThan(
        rot(rigPose('walk', t, happy), 'ear-far'),
      );
    }
    const tail = (mood: Mood) => reversals(samples('idle-sit', 0, 10, mood).map((f) => rot(f, 'tail')));
    expect(tail(sad)).toBeGreaterThan(tail(happy));
  });

  it('layers ears and eyes on the sit pose only', () => {
    const overlay = ['ear-near', 'ear-far', 'eyes-open', 'eyes-closed'] as const;
    for (const anim of ['idle-sit', 'content-sit', 'grumpy-sit', 'stare'] as const) {
      const f = rigPose(anim, 1, m);
      for (const p of overlay) expect(f.parts[p], `${anim} ${p}`).toBeDefined();
    }
    const others: AnimName[] = [
      'nap', 'cuddle-nap', 'loaf', 'groom', 'stretch', 'sit-up', 'belly-up', 'dangle', 'chase-tail',
    ];
    for (const anim of others) {
      for (let t = 0; t < 6; t += 0.25) {
        const f = rigPose(anim, t, m);
        expect(f.pose).not.toBe('sit');
        for (const p of overlay) expect(f.parts[p], `${anim} ${p}`).toBeUndefined();
      }
    }
    const belly = rigPose('roll-over', ANIM_SECONDS['roll-over'] / 2, m);
    for (const p of overlay) expect(belly.parts[p]).toBeUndefined();
  });

  it('content and grumpy sit differ only in part settings', () => {
    const content = rigPose('content-sit', 1, m);
    const grumpy = rigPose('grumpy-sit', 1, m);
    expect(content.pose).toBe(grumpy.pose);
    expect(rot(grumpy, 'ear-near')).toBeLessThan(rot(content, 'ear-near'));
  });

  it('blinks', () => {
    for (let start = 0; start < 40; start += 0.5) {
      const window = samples('idle-sit', start, start + 6);
      const closed = window.filter((f) => f.parts['eyes-closed']?.visible === true);
      expect(closed.length, `no blink in [${start}, ${start + 6}]`).toBeGreaterThan(0);
      for (const f of closed) expect(f.parts['eyes-open']?.visible).toBe(false);
      // Short windows: eyes are open most of the time.
      expect(closed.length).toBeLessThan(window.length / 4);
    }
  });

  it('spin and roll over are code-made', () => {
    const spin = samples('spin', 0, ANIM_SECONDS.spin);
    expect(spin.some((f) => f.flipX)).toBe(true);
    expect(spin.some((f) => !f.flipX)).toBe(true);

    const roll = samples('roll-over', 0, ANIM_SECONDS['roll-over']);
    expect(roll.some((f) => f.pose === 'belly-up')).toBe(true);
    expect(roll[0]!.rotation).toBeCloseTo(0, 5);
    const end = rigPose('roll-over', ANIM_SECONDS['roll-over'], m);
    expect(end.rotation).toBeCloseTo(2 * Math.PI, 5);
    expect(end.pose).toBe('puppet');
  });

  it('high five raises the paw', () => {
    const mid = rigPose('high-five', ANIM_SECONDS['high-five'] / 2, m);
    expect(mid.parts['paw-raised']?.visible).toBe(true);
    expect(mid.parts['leg-front-near']?.visible).toBe(false);
    expect(rigPose('walk', 0, m).parts['paw-raised']?.visible).toBe(false);
  });

  it('places puppet parts at their rig pivots when still', () => {
    const f = rigPose('fall', 0, m);
    expect(f.parts.head).toMatchObject({ x: 26, y: -16 });
  });
});

describe('floatingZs', () => {
  it('rises and fades over time', () => {
    const zs = floatingZs(1);
    expect(zs.length).toBeGreaterThan(0);
    for (const z of zs) {
      expect(z.alpha).toBeGreaterThanOrEqual(0);
      expect(z.alpha).toBeLessThanOrEqual(1);
    }
    const a = floatingZs(0.2)[0]!;
    const b = floatingZs(0.6)[0]!;
    expect(b.y).toBeLessThan(a.y);
  });
});
