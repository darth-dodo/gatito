import { describe, expect, it } from 'vitest';
import type { Floor, Point } from '../../src/ipc';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import { clampFrameDelta } from '../../src/brain/clock';
import { newPairings } from '../../src/brain/learning';
import type { Mood, Pet } from '../../src/brain/types';
import { PetController, WALK_SPEED, type ControllerContext } from '../../src/sim/controller';
import { World, type Body } from '../../src/sim/world';
import { ANIM_SECONDS } from '../../src/render/rig';

const floor: Floor = { x: 0, y: 0, width: 1000, bottom: 800 };
const FRAME = 1 / 60;

function pet(mood: Mood = { affection: 60, energy: 60 }): Pet {
  return {
    id: 'mochi',
    species: 'cat',
    name: 'Mochi',
    style: 'pixel',
    colour: 'orange-tabby',
    personality: 'cosy',
    mood,
    pairings: newPairings(),
    learned: {},
  };
}

function body(): Body {
  return {
    id: 'mochi',
    x: 400,
    y: 800 - 80,
    vx: 0,
    vy: 0,
    facing: 1,
    held: false,
    grounded: true,
    width: 84,
    height: 80,
  };
}

interface Rig {
  c: PetController;
  b: Body;
  w: World;
}

function make(seed: number, mood?: Mood): Rig {
  const b = body();
  const w = new World(floor);
  w.add(b);
  return { c: new PetController(pet(mood), b, seededRng(seed)), b, w };
}

function ctx(cursor: Point | null = null): ControllerContext {
  return { cursor, userIdleSeconds: 0, floor };
}

function tick(r: Rig, dt: number, cursor: Point | null = null): void {
  r.c.update(dt, ctx(cursor));
  r.w.step(dt);
}

/** Seeds whose cat starts with the given animation. */
function seedsStarting(name: string, mood?: Mood, count = 3): number[] {
  const out: number[] = [];
  for (let s = 1; s < 2000 && out.length < count; s++) {
    if (make(s, mood).c.anim().name === name) out.push(s);
  }
  if (out.length === 0) throw new Error(`no seed starts with ${name}`);
  return out;
}

/** Runs until the animation changes; returns the new name. */
function runUntilChange(r: Rig, limitSeconds: number): string {
  const first = r.c.anim().name;
  for (let t = 0; t < limitSeconds; t += FRAME) {
    tick(r, FRAME);
    if (r.c.anim().name !== first) return r.c.anim().name;
  }
  throw new Error(`${first} did not end within ${limitSeconds} s`);
}

describe('PetController', () => {
  it('controller plays a behaviour then picks the next', () => {
    for (const seed of seedsStarting('groom')) {
      const r = make(seed);
      for (let i = 0; i < 60; i++) tick(r, FRAME);
      expect(r.c.anim().name).toBe('groom');
      expect(r.c.anim().t).toBeGreaterThan(0.9);
      const next = runUntilChange(r, 30);
      expect(next).not.toBe('groom');
      expect(r.c.anim().t).toBeLessThan(0.1);
    }
  });

  it('waking from nap always plays stretch before anything else', () => {
    const sleepy = { affection: 60, energy: 5 };
    const seeds = seedsStarting('nap', sleepy, 5);
    expect(seeds.length).toBeGreaterThan(1);
    for (const seed of seeds) {
      const r = make(seed, sleepy);
      expect(runUntilChange(r, 600)).toBe('stretch');
      const after = runUntilChange(r, ANIM_SECONDS.stretch + 1);
      expect(after).not.toBe('stretch');
    }
  });

  it('huge resume delta is safe', () => {
    const [seed] = seedsStarting('wander');
    const r = make(seed!);
    tick(r, FRAME);
    expect(Math.abs(r.b.vx)).toBeGreaterThan(0);
    const x0 = r.b.x;
    const t0 = r.c.anim().t;
    r.c.update(7200, ctx());
    r.w.step(clampFrameDelta(7200));
    expect(Math.abs(r.b.x - x0)).toBeLessThanOrEqual(WALK_SPEED * TUNING.maxFrameDeltaSeconds + 1e-6);
    expect(r.c.anim().t - t0).toBeLessThanOrEqual(TUNING.maxFrameDeltaSeconds + 1e-9);
  });

  it('never in the way: shifts aside from a still cursor after 2 s', () => {
    const [seed] = seedsStarting('nap', { affection: 60, energy: 5 });
    const r = make(seed!, { affection: 60, energy: 5 });
    const cursor = { x: r.b.x + r.b.width / 2 + 10, y: r.b.y + r.b.height / 2 };
    for (let t = 0; t < TUNING.underCursorSeconds - 0.1; t += FRAME) tick(r, FRAME, cursor);
    expect(r.c.anim().name).toBe('nap');
    for (let t = 0; t < 0.2; t += FRAME) tick(r, FRAME, cursor);
    expect(r.c.anim().name).toBe('wander');
    // Cursor is right of centre, so the cat moves left, away from it.
    expect(r.b.vx).toBeLessThan(0);
    for (let t = 0; t < 4; t += FRAME) tick(r, FRAME, cursor);
    const inside = cursor.x >= r.b.x && cursor.x <= r.b.x + r.b.width;
    expect(inside).toBe(false);
  });

  it('a moving cursor (petting) does not push the cat aside', () => {
    const [seed] = seedsStarting('nap', { affection: 60, energy: 5 });
    const r = make(seed!, { affection: 60, energy: 5 });
    const cx = r.b.x + r.b.width / 2;
    for (let t = 0; t < 4; t += FRAME) {
      tick(r, FRAME, { x: cx + 20 * Math.sin(t * 6), y: r.b.y + 40 });
    }
    expect(r.c.anim().name).toBe('nap');
  });

  it('plays a started trick, then returns to behaviours', () => {
    const r = make(1);
    r.c.start({ kind: 'trick', trick: 'spin' });
    expect(r.c.anim()).toEqual({ name: 'spin', t: 0 });
    expect(r.b.vx).toBe(0);
    expect(runUntilChange(r, ANIM_SECONDS.spin + 1)).not.toBe('spin');
  });

  it('dangles while held, falls, then lands', () => {
    const r = make(1);
    r.w.pickUp('mochi', 300, 200);
    tick(r, FRAME);
    expect(r.c.anim().name).toBe('dangle');
    r.w.drop('mochi');
    tick(r, FRAME);
    expect(r.c.anim().name).toBe('fall');
    for (let t = 0; t < 2 && r.c.anim().name === 'fall'; t += FRAME) tick(r, FRAME);
    expect(r.c.anim().name).toBe('land');
  });

  it('reports napping for mood', () => {
    const [seed] = seedsStarting('nap', { affection: 60, energy: 5 });
    expect(make(seed!, { affection: 60, energy: 5 }).c.activity()).toBe('napping');
    const [w] = seedsStarting('wander');
    expect(make(w!).c.activity()).toBe('active');
  });
});
