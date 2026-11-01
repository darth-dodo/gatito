import { describe, expect, it } from 'vitest';
import { SPECIES, type Mood, type Species } from '../../src/brain/types';
import { PART_NAMES, POSE_NAMES } from '../../src/render/artNames';
import { ANIM_SECONDS, CELL, RIGS, headTop, rigPose, stepAngle, type AnimName, type RigFrame } from '../../src/render/rig';

const happy: Mood = { affection: 90, energy: 60 };
const cross: Mood = { affection: 5, energy: 60 };
const STEP = 1 / 120;

function samples(species: Species, anim: AnimName, from: number, to: number, mood: Mood = happy): RigFrame[] {
  const out: RigFrame[] = [];
  for (let t = from; t <= to; t += STEP) out.push(rigPose(anim, t, mood, { species }));
  return out;
}

const tail = (f: RigFrame): number => f.parts.tail!.rotation;

/** Counts sign changes around the series' own mean: how often it swings back and forth. */
function swings(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  let n = 0;
  for (let i = 1; i < values.length; i++) if (Math.sign(values[i]! - mean) !== Math.sign(values[i - 1]! - mean)) n++;
  return n;
}

describe('species rigs', () => {
  it.each(SPECIES)('%s rig places every part where it is drawn in the cell', (species) => {
    const { parts, poseTail, sitOverlay } = RIGS[species];
    const [bx, by] = parts.body.anchor;
    for (const name of PART_NAMES) {
      const p = parts[name];
      expect(p, name).toBeDefined();
      // Parts are drawn in place, so a part's pivot offset is its anchor's distance from the body's.
      expect(Math.abs(p.offset[0] - (p.anchor[0] - bx) * CELL), `${name} x`).toBeLessThanOrEqual(1);
      expect(Math.abs(p.offset[1] - (p.anchor[1] - by) * CELL), `${name} y`).toBeLessThanOrEqual(1);
    }
    for (const pose of POSE_NAMES) expect(poseTail[pose], pose).toBeDefined();
    expect(Object.keys(sitOverlay).sort()).toEqual(['ear-far', 'ear-near', 'eyes-closed', 'eyes-open']);
    expect(RIGS[species].headTop.puppet).toBeDefined();
  });

  it('keeps cats looking exactly as before when no species is given', () => {
    for (const anim of ['idle-sit', 'purr', 'loaf', 'groom', 'walk', 'chase-tail'] as const) {
      expect(rigPose(anim, 0.7, happy)).toEqual(rigPose(anim, 0.7, happy, { species: 'cat' }));
    }
  });

  it('draws a dog from its own rig', () => {
    const cat = rigPose('walk', 0, happy, { species: 'cat' });
    const dog = rigPose('walk', 0, happy, { species: 'dog' });
    expect(dog.parts.head!.x).toBe(RIGS.dog.parts.head.offset[0]);
    expect(dog.parts.head).not.toEqual(cat.parts.head);
    const sit = rigPose('idle-sit', 0, happy, { species: 'dog' });
    expect(sit.parts['ear-near']!.x).toBe(RIGS.dog.sitOverlay['ear-near']![0]);
    expect(sit.parts.tail!.x).toBe(RIGS.dog.poseTail.sit.x);
  });
});

describe('head top', () => {
  it('gives napping dogs their own z origin', () => {
    expect(headTop('sleep-curl', 'dog')).toEqual(RIGS.dog.headTop['sleep-curl']);
    expect(headTop('sleep-curl')).toEqual(RIGS.cat.headTop['sleep-curl']);
    expect(headTop('loaf', 'dog')).toEqual(RIGS.dog.headTop.puppet);
  });
});

describe('dog reactions', () => {
  it('Wag: the tail lifts and beats fast and the back end wiggles, eyes open', () => {
    const wag = samples('dog', 'purr', 0, ANIM_SECONDS.purr);
    const purr = samples('cat', 'purr', 0, ANIM_SECONDS.purr);
    expect(wag.every((f) => f.pose === 'sit')).toBe(true);
    // At least four beats a second.
    expect(swings(wag.map(tail))).toBeGreaterThanOrEqual(2 * 4 * ANIM_SECONDS.purr);
    expect(swings(wag.map(tail))).toBeGreaterThan(3 * swings(purr.map(tail)));
    const rest = stepAngle(RIGS.dog.poseTail.sit.rotation);
    const mean = wag.reduce((s, f) => s + tail(f), 0) / wag.length;
    expect(mean).toBeGreaterThan(rest + 0.3);
    // The whole body sways about its pivot, where a purring cat holds one lean.
    expect(new Set(wag.map((f) => f.rotation.toFixed(3))).size).toBeGreaterThan(10);
    expect(new Set(purr.map((f) => f.rotation)).size).toBe(1);
    expect(wag.some((f) => f.parts.body!.x !== 0)).toBe(true);
    // A purring cat closes its eyes; a wagging dog only blinks.
    const shut = wag.filter((f) => f.parts['eyes-closed']!.visible).length;
    expect(shut).toBeLessThan(wag.length / 4);
    expect(purr.every((f) => f.parts['eyes-closed']!.visible)).toBe(true);
  });

  it('Curl nap: a dog loafs curled with nose under tail, breathing slowly', () => {
    const curl = samples('dog', 'loaf', 0, 8);
    expect(curl.every((f) => f.pose === 'loaf')).toBe(true);
    const cat = samples('cat', 'loaf', 0, 8);
    const catBreaths = swings(cat.map((f) => f.parts.body!.y));
    expect(swings(curl.map((f) => f.parts.body!.y))).toBeLessThan(catBreaths);
    // The tail stays draped over the nose.
    const rest = stepAngle(RIGS.dog.poseTail.loaf.rotation);
    for (const f of curl) expect(Math.abs(tail(f) - rest)).toBeLessThan(0.2);
  });

  it('Scratch: a dog grooms with a fast shake', () => {
    const scratch = samples('dog', 'groom', 0, 2);
    const groom = samples('cat', 'groom', 0, 2);
    expect(scratch.every((f) => f.pose === 'groom')).toBe(true);
    const ys = (fs: RigFrame[]): number[] => fs.map((f) => f.parts.body!.y);
    expect(swings(ys(scratch))).toBeGreaterThanOrEqual(2 * 6 * 2);
    expect(swings(ys(scratch))).toBeGreaterThan(5 * swings(ys(groom)));
  });

  it('Idle sit tail thump: the tail rests on the floor and beats up in short pulses', () => {
    const sit = samples('dog', 'idle-sit', 0, 10);
    const rest = stepAngle(RIGS.dog.poseTail.sit.rotation);
    const down = sit.filter((f) => tail(f) === rest).length;
    expect(down / sit.length).toBeGreaterThan(0.7);
    for (const f of sit) expect(tail(f)).toBeGreaterThanOrEqual(rest);
    let thumps = 0;
    for (let i = 1; i < sit.length; i++) if (tail(sit[i - 1]!) === rest && tail(sit[i]!) > rest) thumps++;
    expect(thumps).toBeGreaterThanOrEqual(8);
    // A cat's tail swishes all the time (it only crosses rest, snapped to 3 degree steps, in passing).
    const catSit = samples('cat', 'idle-sit', 0, 10);
    const catRest = stepAngle(RIGS.cat.poseTail.sit.rotation);
    expect(catSit.filter((f) => tail(f) === catRest).length / catSit.length).toBeLessThan(0.2);
  });

  it('a happy dog thumps more often than a cross one', () => {
    const count = (mood: Mood): number => {
      const fs = samples('dog', 'idle-sit', 0, 20, mood);
      const rest = stepAngle(RIGS.dog.poseTail.sit.rotation);
      let n = 0;
      for (let i = 1; i < fs.length; i++) if (tail(fs[i - 1]!) === rest && tail(fs[i]!) > rest) n++;
      return n;
    };
    expect(count(happy)).toBeGreaterThan(2 * count(cross));
  });

  it('a standing dog wags faster when happy and carries its tail lower when cross', () => {
    const glad = samples('dog', 'walk', 0, 4, happy).map(tail);
    const sulky = samples('dog', 'walk', 0, 4, cross).map(tail);
    expect(swings(glad)).toBeGreaterThan(2 * swings(sulky));
    const mean = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
    expect(mean(sulky)).toBeLessThan(mean(glad) - 0.3);
  });

  it('never draws two tails: poses that have their own tail hide the layered one', () => {
    for (const anim of ['loaf', 'nap', 'cuddle-nap', 'dangle', 'chase-tail'] as const) {
      expect(rigPose(anim, 0.5, happy, { species: 'dog' }).parts.tail!.visible, anim).toBe(false);
    }
    for (const anim of ['idle-sit', 'purr', 'groom', 'stretch', 'sit-up', 'belly-up', 'walk'] as const) {
      expect(rigPose(anim, 0.5, happy, { species: 'dog' }).parts.tail!.visible, anim).toBe(true);
    }
    for (const anim of ['loaf', 'nap', 'dangle'] as const) {
      expect(rigPose(anim, 0.5, happy).parts.tail!.visible, `cat ${anim}`).toBe(true);
    }
  });

  it('a dog chases its tail as a spinning ring', () => {
    const chase = samples('dog', 'chase-tail', 0, ANIM_SECONDS['chase-tail']);
    expect(chase.every((f) => f.pose === 'loaf')).toBe(true);
    expect(chase[chase.length - 1]!.rotation).toBeGreaterThan(Math.PI * 2);
    expect(rigPose('chase-tail', 1, happy, { species: 'cat' }).pose).toBe('sleep-curl');
  });

  it('shares every other animation with cats', () => {
    for (const anim of ['nap', 'stretch', 'sit-up', 'dangle', 'belly-up', 'stare', 'walk', 'spin'] as const) {
      expect(rigPose(anim, 0.5, happy, { species: 'dog' }).pose, anim).toBe(rigPose(anim, 0.5, happy, { species: 'cat' }).pose);
    }
  });
});
