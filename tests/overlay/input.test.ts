import { describe, expect, it, vi } from 'vitest';
import type { Floor } from '../../src/ipc';
import { newPairings } from '../../src/brain/learning';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import type { Mood, Pet } from '../../src/brain/types';
import { InputRouter } from '../../src/overlay/input';
import { PetController } from '../../src/sim/controller';
import { World, type Body } from '../../src/sim/world';

const floor: Floor = { x: 0, y: 0, width: 1000, bottom: 800 };
const FRAME = 1 / 60;
const W = 84;
const H = 80;

function pet(id: string, mood: Mood): Pet {
  return {
    id,
    species: 'cat',
    name: id,
    style: 'pixel',
    colour: 'orange-tabby',
    personality: 'cosy',
    mood,
    pairings: newPairings(),
    learned: {},
  };
}

function body(id: string, x: number): Body {
  return {
    id,
    x,
    y: floor.bottom - H,
    vx: 0,
    vy: 0,
    facing: 1,
    held: false,
    grounded: true,
    width: W,
    height: H,
  };
}

interface Setup {
  world: World;
  pets: { body: Body; controller: PetController }[];
  router: InputRouter;
  onCueRequest: ReturnType<typeof vi.fn>;
}

function setup(cats: { id: string; x: number; mood?: Mood }[]): Setup {
  const world = new World(floor);
  const pets: Setup['pets'] = cats.map((c, i) => {
    const b = body(c.id, c.x);
    world.add(b);
    return { body: b, controller: new PetController(pet(c.id, c.mood ?? { affection: 60, energy: 60 }), b, seededRng(i + 1)) };
  });
  const onCueRequest = vi.fn();
  const router = new InputRouter({ pets, world, onCueRequest });
  return { world, pets, router, onCueRequest };
}

/** Sweeps back and forth across a cat at x 400..484: one stroke per sweep, starting at time t0. */
function stroke(router: InputRouter, sweeps: number, t0: number, step = 0.25): number {
  let t = t0;
  router.pointerMove(420, 760, t);
  for (let i = 0; i < sweeps; i++) {
    t += step;
    router.pointerMove(i % 2 === 0 ? 450 : 420, 760, t);
  }
  return t;
}

describe('InputRouter petting', () => {
  it('starts purr and raises affection after 3 strokes within 1.5 s', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    const c = pets[0]!.controller;
    const t = stroke(router, 3, 0);
    expect(t).toBeLessThanOrEqual(1.5);
    expect(c.anim().name).toBe('purr');
    expect(c.pet.mood.affection).toBe(60 + 3 * TUNING.affectionPerStroke);
  });

  it('does not purr after only 2 strokes', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    stroke(router, 2, 0);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
    expect(pets[0]!.controller.pet.mood.affection).toBe(60 + 2 * TUNING.affectionPerStroke);
  });

  it('rolls a happy cat belly up after 3 more strokes', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400, mood: { affection: 70, energy: 60 } }]);
    const c = pets[0]!.controller;
    let t = stroke(router, 3, 0);
    expect(c.anim().name).toBe('purr');
    t = stroke(router, 3, t);
    expect(c.anim().name).toBe('belly-up');
  });

  it('keeps a less fond cat purring instead of belly up', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400, mood: { affection: 40, energy: 60 } }]);
    const c = pets[0]!.controller;
    let t = stroke(router, 3, 0);
    t = stroke(router, 3, t);
    expect(c.anim().name).toBe('purr');
    expect(TUNING.bellyUpMinAffection).toBe(70);
  });

  it('resets the stroke count when the cursor leaves the cat', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    const t = stroke(router, 2, 0);
    router.pointerMove(700, 760, t + 0.05);
    stroke(router, 1, t + 0.1);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
  });

  it('resets the stroke count on pointerLeave', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    const t = stroke(router, 2, 0);
    router.pointerLeave();
    stroke(router, 1, t + 0.1);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
  });

  it('keeps one stroke count per pet and resets the old one when moving to another pet', () => {
    const { router, pets } = setup([
      { id: 'a', x: 400 },
      { id: 'b', x: 600 },
    ]);
    let t = stroke(router, 2, 0);
    router.pointerMove(640, 760, t + 0.05);
    router.pointerMove(670, 760, t + 0.1);
    t += 0.15;
    stroke(router, 1, t);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
    expect(pets[1]!.controller.anim().name).not.toBe('purr');
  });
});

describe('InputRouter pick up and drop', () => {
  it('press and move picks the cat up, drags it and plays dangle', () => {
    const { router, pets, world } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    const dragTo = vi.spyOn(world, 'dragTo');
    const { body: b, controller: c } = pets[0]!;

    router.pointerDown(410, 730, 0);
    router.pointerMove(510, 530, 0.1);

    expect(pickUp).toHaveBeenCalledWith('mochi', 400, 720);
    expect(dragTo).toHaveBeenCalledWith('mochi', 500, 520);
    expect(pickUp.mock.invocationCallOrder[0]!).toBeLessThan(dragTo.mock.invocationCallOrder[0]!);
    expect(b.held).toBe(true);
    expect(b.x).toBe(500);
    expect(b.y).toBe(520);
    expect(router.heldId()).toBe('mochi');

    c.update(FRAME, { cursor: { x: 510, y: 530 }, userIdleSeconds: 0, floor });
    expect(c.anim().name).toBe('dangle');
  });

  it('release drops the cat: fall, then land, mood unchanged', () => {
    const mood = { affection: 55, energy: 45 };
    const { router, pets, world } = setup([{ id: 'mochi', x: 400, mood }]);
    const drop = vi.spyOn(world, 'drop');
    const { body: b, controller: c } = pets[0]!;
    const ctx = { cursor: null, userIdleSeconds: 0, floor };

    router.pointerDown(410, 730, 0);
    router.pointerMove(510, 330, 0.1);
    c.update(FRAME, ctx);
    router.pointerUp(510, 330);
    expect(drop).toHaveBeenCalledWith('mochi');
    expect(router.heldId()).toBeNull();

    const seen: string[] = [];
    for (let i = 0; i < 120; i++) {
      world.step(FRAME);
      c.update(FRAME, ctx);
      const name = c.anim().name;
      if (seen[seen.length - 1] !== name) seen.push(name);
      if (name === 'land') break;
    }
    expect(seen).toEqual(['fall', 'land']);
    expect(b.grounded).toBe(true);
    expect(c.pet.mood).toEqual(mood);
  });

  it('counts no strokes while holding a cat', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    router.pointerDown(420, 760, 0);
    stroke(router, 4, 0);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
  });

  it('ignores presses off every cat', () => {
    const { router, world, onCueRequest } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    router.pointerDown(50, 50, 0);
    router.pointerDown(50, 50, 2);
    expect(pickUp).not.toHaveBeenCalled();
    expect(onCueRequest).not.toHaveBeenCalled();
    expect(router.heldId()).toBeNull();
  });

  it('picks the topmost cat where two overlap', () => {
    const { router } = setup([
      { id: 'under', x: 400 },
      { id: 'over', x: 440 },
    ]);
    router.pointerDown(460, 760, 0);
    expect(router.heldId()).toBe('over');
  });

  it('routes the right button to the cue request without picking up', () => {
    const { router, world, onCueRequest } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    router.pointerDown(420, 760, 2);
    expect(onCueRequest).toHaveBeenCalledWith('mochi');
    expect(pickUp).not.toHaveBeenCalled();
  });
});
