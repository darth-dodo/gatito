import { describe, expect, it } from 'vitest';
import type { Floor } from '../../src/ipc';
import { TUNING } from '../../src/brain/tuning';
import { lerpPosition, World, type Body } from '../../src/sim/world';

const floor: Floor = { x: 0, y: 0, width: 1000, bottom: 800 };

function body(over: Partial<Body> = {}): Body {
  return {
    id: 'a',
    x: 100,
    y: 800 - 48,
    vx: 0,
    vy: 0,
    facing: 1,
    held: false,
    grounded: true,
    width: 48,
    height: 48,
    ...over,
  };
}

function run(world: World, seconds: number): void {
  const n = Math.round(seconds / TUNING.simStepSeconds);
  for (let i = 0; i < n; i++) world.step(TUNING.simStepSeconds);
}

function get(world: World, id = 'a'): Body {
  const b = world.bodies().find((x) => x.id === id);
  if (!b) throw new Error('missing body');
  return b;
}

describe('World', () => {
  it('dropped cats fall and land on the floor', () => {
    const w = new World(floor);
    w.add(body({ y: 800 - 48 - 300, grounded: false }));
    run(w, 2);
    const b = get(w);
    expect(b.grounded).toBe(true);
    expect(b.y + b.height).toBe(floor.bottom);
    expect(b.vy).toBe(0);
  });

  it('walkers turn at screen edges', () => {
    const w = new World(floor);
    w.add(body({ x: 940, vx: 200, facing: 1 }));
    run(w, 1);
    const b = get(w);
    expect(b.facing).toBe(-1);
    expect(b.vx).toBeLessThan(0);
    expect(b.x).toBeGreaterThanOrEqual(floor.x);
    expect(b.x).toBeLessThanOrEqual(floor.x + floor.width - b.width);
    w.add(body({ id: 'l', x: 10, vx: -200, facing: -1 }));
    run(w, 0.5);
    expect(get(w, 'l').facing).toBe(1);
    expect(get(w, 'l').vx).toBeGreaterThan(0);
  });

  it('floor change re-floors every cat', () => {
    const w = new World(floor);
    w.add(body({ id: 'a' }));
    w.add(body({ id: 'b', x: 300 }));
    w.setFloor({ ...floor, bottom: 720 });
    w.step(TUNING.simStepSeconds);
    for (const b of w.bodies()) expect(b.y + b.height).toBe(720);
  });

  it('floor change clamps airborne bodies into the new range', () => {
    const w = new World(floor);
    w.add(body({ x: 900, y: 100, grounded: false }));
    w.setFloor({ x: 0, y: 0, width: 500, bottom: 800 });
    expect(get(w).x).toBe(452);
  });

  it('off-screen drops are clamped', () => {
    const w = new World(floor);
    w.add(body());
    w.pickUp('a', -500, -400);
    w.drop('a');
    run(w, 2);
    const b = get(w);
    expect(b.grounded).toBe(true);
    expect(b.x).toBeGreaterThanOrEqual(floor.x);
    expect(b.x).toBeLessThanOrEqual(floor.x + floor.width - b.width);
    expect(b.y + b.height).toBe(floor.bottom);
  });

  it('held cats do not fall', () => {
    const w = new World(floor);
    w.add(body());
    w.pickUp('a', 400, 200);
    run(w, 1);
    const b = get(w);
    expect(b.held).toBe(true);
    expect(b.x).toBe(400);
    expect(b.y).toBe(200);
    w.dragTo('a', 450, 250);
    run(w, 0.5);
    expect(get(w).x).toBe(450);
    expect(get(w).y).toBe(250);
  });

  it('carries the sub-step remainder between calls', () => {
    const w = new World(floor);
    w.add(body({ y: 100, grounded: false }));
    for (let i = 0; i < 6; i++) w.step(TUNING.simStepSeconds / 6);
    expect(get(w).vy).toBeCloseTo(TUNING.gravityPxPerS2 * TUNING.simStepSeconds, 5);
  });

  it('ignores unknown ids and supports remove', () => {
    const w = new World(floor);
    w.add(body());
    expect(() => {
      w.pickUp('zz', 1, 1);
      w.dragTo('zz', 1, 1);
      w.drop('zz');
      w.remove('zz');
    }).not.toThrow();
    w.remove('a');
    expect(w.bodies()).toHaveLength(0);
  });
});

describe('render interpolation', () => {
  it('lerps between the previous and current positions', () => {
    expect(lerpPosition({ x: 0, y: 10 }, { x: 10, y: 20 }, 0)).toEqual({ x: 0, y: 10 });
    expect(lerpPosition({ x: 0, y: 10 }, { x: 10, y: 20 }, 0.25)).toEqual({ x: 2.5, y: 12.5 });
    expect(lerpPosition({ x: 0, y: 10 }, { x: 10, y: 20 }, 1)).toEqual({ x: 10, y: 20 });
  });

  it('draws a walking body part way into the next step on a 120 Hz frame', () => {
    const h = TUNING.simStepSeconds;
    const w = new World(floor);
    w.add(body({ vx: 60 }));
    w.step(h); // one full step: from 100 to 101
    expect(get(w).x).toBeCloseTo(101);
    expect(w.alpha()).toBeCloseTo(0);
    // Drawn one step behind, between the last two steps: still at the start of the move.
    expect(w.drawPosition(get(w)).x).toBeCloseTo(100);
    w.step(h / 2); // half a step left over: no new step yet
    expect(get(w).x).toBeCloseTo(101);
    expect(w.alpha()).toBeCloseTo(0.5);
    expect(w.drawPosition(get(w)).x).toBeCloseTo(100.5);
  });

  it('snaps on jumps instead of sliding', () => {
    const w = new World(floor);
    w.add(body());
    w.step(TUNING.simStepSeconds / 2);
    w.pickUp('a', 500, 300);
    const p = w.drawPosition(get(w));
    expect(p.x).toBe(get(w).x);
    expect(p.y).toBe(get(w).y);
  });
});
