import { describe, expect, it, vi } from 'vitest';
import type { Floor } from '../../src/ipc';
import { newPairings } from '../../src/brain/learning';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import type { Mood, Pet } from '../../src/brain/types';
import { HELD_HITBOX_PAD_PX, InputRouter, cursorEscapedHold } from '../../src/overlay/input';
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
  router.pointerMove(420, 760, t, 0);
  for (let i = 0; i < sweeps; i++) {
    t += step;
    router.pointerMove(i % 2 === 0 ? 450 : 420, 760, t, 0);
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
    router.pointerMove(700, 760, t + 0.05, 0);
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
    router.pointerMove(640, 760, t + 0.05, 0);
    router.pointerMove(670, 760, t + 0.1, 0);
    t += 0.15;
    stroke(router, 1, t);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
    expect(pets[1]!.controller.anim().name).not.toBe('purr');
  });
});

describe('InputRouter stroking through a purr', () => {
  const ctx = { cursor: null, userIdleSeconds: 0, floor };

  it('purrs again when the purr ends while stroking continues', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400, mood: { affection: 40, energy: 60 } }]);
    const c = pets[0]!.controller;
    let t = stroke(router, 3, 0);
    expect(c.anim().name).toBe('purr');
    for (let i = 0; i < 200 && c.anim().name === 'purr'; i++) c.update(FRAME, ctx);
    expect(c.anim().name).not.toBe('purr');
    t = stroke(router, 1, t);
    expect(c.anim().name).toBe('purr');
  });

  it('adds affection for strokes during belly up without restarting it', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400, mood: { affection: 70, energy: 60 } }]);
    const c = pets[0]!.controller;
    let t = stroke(router, 6, 0);
    expect(c.anim().name).toBe('belly-up');
    for (let i = 0; i < 30; i++) c.update(FRAME, ctx);
    const before = c.anim().t;
    const affection = c.pet.mood.affection;
    t = stroke(router, 2, t);
    expect(c.anim().name).toBe('belly-up');
    expect(c.anim().t).toBe(before);
    expect(c.pet.mood.affection).toBe(affection + 2 * TUNING.affectionPerStroke);
  });
});

describe('InputRouter pick up and drop', () => {
  it('press and move picks the cat up, drags it and plays dangle', () => {
    const { router, pets, world } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    const dragTo = vi.spyOn(world, 'dragTo');
    const { body: b, controller: c } = pets[0]!;

    router.pointerDown(410, 730, 0);
    router.pointerMove(510, 530, 0.1, 1);

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
    router.pointerMove(510, 330, 0.1, 1);
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
    router.pointerMove(430, 760, 0, 1);
    expect(router.heldId()).toBe('mochi');
    for (let i = 0; i < 4; i++) router.pointerMove(i % 2 ? 300 : 500, 500, i * 0.2, 1);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
  });

  it('a plain click never picks the cat up', () => {
    const { router, pets, world } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    const drop = vi.spyOn(world, 'drop');
    const c = pets[0]!.controller;
    const before = c.anim().name;
    router.pointerDown(420, 760, 0);
    router.pointerMove(422, 761, 0.05, 1);
    router.pointerUp(422, 761);
    c.update(FRAME, { cursor: null, userIdleSeconds: 0, floor });
    expect(pickUp).not.toHaveBeenCalled();
    expect(drop).not.toHaveBeenCalled();
    expect(router.heldId()).toBeNull();
    expect(pets[0]!.body.held).toBe(false);
    expect(['dangle', 'fall', 'land']).not.toContain(c.anim().name);
    expect(before).not.toBe('dangle');
  });

  it(`picks up once the pointer moves ${TUNING.dragStartPx} px with the button held`, () => {
    const { router, world } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    expect(TUNING.dragStartPx).toBe(4);
    router.pointerDown(420, 760, 0);
    router.pointerMove(423, 760, 0.02, 1);
    expect(pickUp).not.toHaveBeenCalled();
    router.pointerMove(424, 760, 0.04, 1);
    expect(pickUp).toHaveBeenCalledWith('mochi', 400, 720);
    expect(router.heldId()).toBe('mochi');
  });

  it("pointerMove reports 'lifted' exactly once per hold, on the move that picks the cat up", () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    const b = pets[0]!.body;
    const results: (string | undefined)[] = [];
    router.pointerDown(420, 760, 0);
    results.push(router.pointerMove(422, 760, 0.01, 1));
    results.push(router.pointerMove(430, 760, 0.02, 1));
    results.push(router.pointerMove(480, 600, 0.03, 1));
    results.push(router.pointerMove(500, 500, 0.04, 1));
    expect(results.filter((r) => r === 'lifted')).toHaveLength(1);
    expect(results[1]).toBe('lifted');
    router.pointerUp(500, 500);

    router.pointerDown(b.x + 10, b.y + 10, 0);
    expect(router.pointerMove(b.x + 30, b.y + 10, 0.1, 1)).toBe('lifted');
    expect(router.pointerMove(b.x + 40, b.y + 10, 0.11, 1)).toBeUndefined();
  });

  it("a plain click and plain strokes never report 'lifted'", () => {
    const { router } = setup([{ id: 'mochi', x: 400 }]);
    router.pointerDown(420, 760, 0);
    expect(router.pointerMove(421, 760, 0.01, 1)).toBeUndefined();
    router.pointerUp(421, 760);
    expect(router.pointerMove(450, 760, 0.1, 0)).toBeUndefined();
  });

  it('releases a held cat when a move arrives with the left button up', () => {
    const { router, world } = setup([{ id: 'mochi', x: 400 }]);
    const drop = vi.spyOn(world, 'drop');
    router.pointerDown(420, 760, 0);
    router.pointerMove(520, 500, 0.1, 1);
    router.pointerMove(530, 500, 0.2, 0);
    expect(drop).toHaveBeenCalledWith('mochi');
    expect(router.heldId()).toBeNull();
  });

  it('a press while a cat is still held releases it', () => {
    const { router, world } = setup([{ id: 'mochi', x: 400 }]);
    const drop = vi.spyOn(world, 'drop');
    router.pointerDown(420, 760, 0);
    router.pointerMove(520, 500, 0.1, 1);
    router.pointerDown(520, 500, 0);
    expect(drop).toHaveBeenCalledWith('mochi');
    expect(router.heldId()).toBeNull();
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
    router.pointerMove(470, 760, 0.05, 1);
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

describe('cursorEscapedHold', () => {
  const b = body('mochi', 400);

  it('keeps the hold while the cursor is inside the padded rect', () => {
    expect(cursorEscapedHold(b, { x: 440, y: 760 })).toBe(false);
    expect(cursorEscapedHold(b, { x: 400 - HELD_HITBOX_PAD_PX, y: 720 - HELD_HITBOX_PAD_PX })).toBe(false);
    expect(cursorEscapedHold(b, { x: 400 + W + HELD_HITBOX_PAD_PX, y: 800 + HELD_HITBOX_PAD_PX })).toBe(false);
  });

  it('lets go once the cursor is past the pad on any side', () => {
    expect(cursorEscapedHold(b, { x: 400 - HELD_HITBOX_PAD_PX - 1, y: 760 })).toBe(true);
    expect(cursorEscapedHold(b, { x: 400 + W + HELD_HITBOX_PAD_PX + 1, y: 760 })).toBe(true);
    expect(cursorEscapedHold(b, { x: 440, y: 720 - HELD_HITBOX_PAD_PX - 1 })).toBe(true);
    expect(cursorEscapedHold(b, { x: 440, y: 800 + HELD_HITBOX_PAD_PX + 1 })).toBe(true);
  });

  it('keeps the hold before any cursor is known', () => {
    expect(cursorEscapedHold(b, null)).toBe(false);
  });
});
