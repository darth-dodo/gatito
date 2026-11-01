import { describe, expect, it } from 'vitest';
import type { Floor } from '../../src/ipc';
import { activeSeconds } from '../../src/brain/clock';
import { newPairings } from '../../src/brain/learning';
import { tickMood } from '../../src/brain/mood';
import { seededRng } from '../../src/brain/rng';
import type { Mood, Pet } from '../../src/brain/types';
import { CURL_SECONDS, FADE_SECONDS, NapTime, callOverX, hitboxBodies } from '../../src/overlay/napTime';
import { PetController } from '../../src/sim/controller';
import { World, type Body } from '../../src/sim/world';

const FRAME = 1 / 60;
const floor: Floor = { x: 0, y: 0, width: 1000, bottom: 800 };

function run(nap: NapTime, seconds: number): void {
  for (let t = 0; t < seconds; t += FRAME) nap.update(FRAME);
}

describe('nap time', () => {
  it('nap time hides and stops the clock, and restores with moods unchanged', () => {
    const nap = new NapTime();
    const mood: Mood = { affection: 60, energy: 70 };
    let m = mood;
    const step = (): void => {
      const active = activeSeconds(FRAME, { userIdleSeconds: 0, napTime: nap.on });
      if (active > 0) m = tickMood(m, active, 'resting');
      nap.update(FRAME);
    };

    expect(nap.alpha).toBe(1);
    expect(nap.curled).toBe(false);

    nap.setOn(true);
    expect(nap.curled).toBe(true);
    expect(nap.alpha).toBe(1); // curls up first, still visible
    for (let t = 0; t < CURL_SECONDS + FADE_SECONDS + 0.5; t += FRAME) step();
    expect(nap.alpha).toBe(0);
    expect(nap.hidden).toBe(true);
    expect(activeSeconds(FRAME, { userIdleSeconds: 0, napTime: nap.on })).toBe(0);
    for (let t = 0; t < 3600; t += 1) {
      expect(activeSeconds(1, { userIdleSeconds: 0, napTime: nap.on })).toBe(0);
    }
    expect(m).toEqual(mood);

    nap.setOn(false);
    // Awake again, the clock runs again: only the ~1.5 s of fading in counts, not the hour of napping.
    expect(nap.hidden).toBe(false);
    for (let t = 0; t < FADE_SECONDS / 2; t += FRAME) step();
    expect(nap.alpha).toBeGreaterThan(0);
    expect(nap.alpha).toBeLessThan(1);
    for (let t = 0; t < FADE_SECONDS + 0.5; t += FRAME) step();
    expect(nap.alpha).toBe(1);
    expect(nap.curled).toBe(false);
    expect(m.affection).toBeCloseTo(mood.affection, 1);
    expect(m.energy).toBeCloseTo(mood.energy, 1);
  });

  it('waking again mid-fade fades back in from where it was', () => {
    const nap = new NapTime();
    nap.setOn(true);
    run(nap, CURL_SECONDS + FADE_SECONDS / 2);
    const mid = nap.alpha;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    nap.setOn(false);
    nap.update(FRAME);
    expect(nap.alpha).toBeGreaterThan(mid);
  });

  it('switching off while still curling up just stands up again', () => {
    const nap = new NapTime();
    nap.setOn(true);
    run(nap, CURL_SECONDS / 2);
    nap.setOn(false);
    expect(nap.curled).toBe(false);
    expect(nap.alpha).toBe(1);
  });

  it('restores Nap time from settings: already hidden, clock stopped, no curl or fade', () => {
    const saved = { napTime: true };
    const nap = new NapTime(saved.napTime);
    expect(nap.on).toBe(true);
    expect(nap.hidden).toBe(true);
    expect(nap.curled).toBe(true);
    expect(nap.alpha).toBe(0);
    expect(activeSeconds(FRAME, { userIdleSeconds: 0, napTime: nap.on })).toBe(0);
    run(nap, CURL_SECONDS + FADE_SECONDS);
    expect(nap.hidden).toBe(true);

    nap.setOn(false);
    run(nap, FADE_SECONDS + FRAME);
    expect(nap.alpha).toBe(1);
    expect(nap.curled).toBe(false);
  });

  it('restores Nap time off from settings as awake', () => {
    const nap = new NapTime(false);
    expect(nap.on).toBe(false);
    expect(nap.curled).toBe(false);
    expect(nap.alpha).toBe(1);
  });
});

describe('call over', () => {
  it('is a no-op during Nap time and aims at the centre otherwise', () => {
    const nap = new NapTime();
    expect(callOverX(nap, floor, 84)).toBe(500 - 42);
    nap.setOn(true);
    expect(callOverX(nap, floor, 84)).toBeNull();
    nap.setOn(false);
    expect(callOverX(nap, floor, 84)).toBe(500 - 42);
  });

  it('call over walks to the centre', () => {
    const body: Body = {
      id: 'mochi', x: 100, y: 720, vx: 0, vy: 0, facing: 1,
      held: false, grounded: true, width: 84, height: 80,
    };
    const pet: Pet = {
      id: 'mochi', species: 'cat', name: 'Mochi', style: 'pixel', colour: 'orange-tabby',
      personality: 'cosy', mood: { affection: 60, energy: 60 }, pairings: newPairings(), learned: {},
    };
    const world = new World(floor);
    world.add(body);
    const c = new PetController(pet, body, seededRng(7));
    const ctx = { cursor: null, userIdleSeconds: 0, floor };
    c.update(FRAME, ctx);
    c.start({ kind: 'go-to', x: floor.x + floor.width / 2 - body.width / 2 });
    expect(c.anim().name).toBe('walk');
    for (let t = 0; t < 30; t += FRAME) {
      c.update(FRAME, ctx);
      world.step(FRAME);
    }
    expect(Math.abs(body.x + body.width / 2 - 500)).toBeLessThan(4);
    expect(c.anim().name).not.toBe('walk');
  });
});

describe('hitboxBodies', () => {
  it('lists the bodies only while Nap time has not started curling them', () => {
    const nap = new NapTime();
    const bodies = [{ id: 'a' }, { id: 'b' }];
    expect(hitboxBodies(nap, bodies)).toEqual(bodies);
    nap.setOn(true);
    expect(hitboxBodies(nap, bodies)).toEqual([]);
    nap.update(CURL_SECONDS + 0.01);
    expect(hitboxBodies(nap, bodies)).toEqual([]);
    nap.update(FADE_SECONDS + 0.1);
    expect(hitboxBodies(nap, bodies)).toEqual([]);
    nap.setOn(false);
    expect(hitboxBodies(nap, bodies)).toEqual([]);
    nap.update(FADE_SECONDS + 0.1);
    expect(hitboxBodies(nap, bodies)).toEqual(bodies);
  });
});
