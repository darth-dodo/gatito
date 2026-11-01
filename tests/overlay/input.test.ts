import { describe, expect, it, vi } from 'vitest';
import type { Floor } from '../../src/ipc';
import { newPairings } from '../../src/brain/learning';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import type { Mood, Pet } from '../../src/brain/types';
import { CueRing, cueAt } from '../../src/overlay/cueRing';
import { HELD_HITBOX_PAD_PX, InputRouter, cursorEscapedHold } from '../../src/overlay/input';
import { rewardMood } from '../../src/brain/mood';
import type { Rng } from '../../src/brain/rng';
import { ANIM_SECONDS } from '../../src/render/rig';
import { PetController } from '../../src/sim/controller';
import { PetTrainer } from '../../src/sim/trickSession';
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
  onTap: ReturnType<typeof vi.fn>;
  ring: CueRing;
  onCue: ReturnType<typeof vi.fn>;
  onPetted: ReturnType<typeof vi.fn>;
}

function setup(cats: { id: string; x: number; mood?: Mood }[], isInteractive?: () => boolean): Setup {
  const world = new World(floor);
  const pets: Setup['pets'] = cats.map((c, i) => {
    const b = body(c.id, c.x);
    world.add(b);
    return { body: b, controller: new PetController(pet(c.id, c.mood ?? { affection: 60, energy: 60 }), b, seededRng(i + 1)) };
  });
  const onCueRequest = vi.fn();
  const onTap = vi.fn();
  const ring = new CueRing();
  const onCue = vi.fn();
  const onPetted = vi.fn(() => false);
  const router = new InputRouter({ pets, world, onCueRequest, onTap, ring, onCue, onPetted, isTraining: () => false, isInteractive });
  return { world, pets, router, onCueRequest, onTap, ring, onCue, onPetted };
}

/** Sweeps back and forth across a cat at x 400..484: one stroke per sweep, starting at time t0. */
function stroke(router: InputRouter, sweeps: number, t0: number, step = 0.25): number {
  let t = t0;
  router.cursorMove(420, 760, t);
  for (let i = 0; i < sweeps; i++) {
    t += step;
    router.cursorMove(i % 2 === 0 ? 450 : 420, 760, t);
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
    router.cursorMove(700, 760, t + 0.05);
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
    router.cursorMove(640, 760, t + 0.05);
    router.cursorMove(670, 760, t + 0.1);
    t += 0.15;
    stroke(router, 1, t);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
    expect(pets[1]!.controller.anim().name).not.toBe('purr');
  });
});

describe('InputRouter strokes come only from the host cursor', () => {
  it('hit tests the box the pet was drawn in, not its body', () => {
    const { world, pets } = setup([{ id: 'a', x: 400 }]);
    const onCueRequest = vi.fn<(petId: string) => void>();
    // Drawn 50 px left of the body, as when interpolation trails a fast move.
    const router = new InputRouter({
      pets,
      world,
      onCueRequest,
      onTap: vi.fn(),
      ring: new CueRing(),
      onCue: () => undefined,
      onPetted: () => false,
      isTraining: () => false,
      boxOf: (b) => ({ x: b.x - 50, y: b.y, width: b.width, height: b.height }),
    });
    router.pointerDown(470, 760, 2); // on the body, but past the drawn cat
    expect(onCueRequest).not.toHaveBeenCalled();
    router.pointerDown(360, 760, 2); // on the drawn cat
    expect(onCueRequest).toHaveBeenCalledWith('a');
  });

  it('pointer moves without a button never stroke', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    for (let i = 0; i < 6; i++) router.pointerMove(i % 2 ? 420 : 450, 760, 0);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
  });

  it('ignores the cursor during a press, and does not count the jump after it', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    router.cursorMove(420, 760, 0);
    router.pointerDown(420, 760, 0);
    router.cursorMove(470, 760, 0.1);
    router.cursorMove(420, 760, 0.2);
    router.release();
    router.cursorMove(470, 760, 0.3);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
  });
});

/** Taps (press and release in place) on the cat at x 400..484, `gap` seconds apart from t0. */
function tap(router: InputRouter, taps: number, t0: number, gap = 0.3): number {
  let t = t0;
  for (let i = 0; i < taps; i++) {
    t += gap;
    router.pointerDown(440, 760, 0);
    router.pointerMove(441, 760, 1);
    router.pointerUp(441, 760, t);
  }
  return t;
}

describe('InputRouter tap to pet', () => {
  it('one tap raises affection by one stroke, asks for a heart burst and does not pick up', () => {
    const { router, pets, world, onTap } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    tap(router, 1, 0);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60 + TUNING.affectionPerStroke);
    expect(onTap).toHaveBeenCalledWith('mochi');
    expect(pickUp).not.toHaveBeenCalled();
    expect(router.heldId()).toBeNull();
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
  });

  it(`${TUNING.tapsForPurr} quick taps start a purr`, () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    expect(TUNING.tapsForPurr).toBe(3);
    tap(router, 2, 0);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
    tap(router, 1, 0.6);
    expect(pets[0]!.controller.anim().name).toBe('purr');
    expect(pets[0]!.controller.pet.mood.affection).toBe(60 + 3 * TUNING.affectionPerStroke);
  });

  it('slow taps spread past the stroke window do not purr', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    tap(router, 3, 0, TUNING.strokeWindowSeconds);
    expect(pets[0]!.controller.anim().name).not.toBe('purr');
  });

  it('taps and strokes add up to the same purr', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    const t = stroke(router, 2, 0);
    tap(router, 1, t, 0.1);
    expect(pets[0]!.controller.anim().name).toBe('purr');
  });

  it('a drag is not a tap', () => {
    const { router, pets, onTap } = setup([{ id: 'mochi', x: 400 }]);
    router.pointerDown(440, 760, 0);
    router.pointerMove(500, 600, 1);
    router.pointerUp(500, 600, 0.5);
    expect(onTap).not.toHaveBeenCalled();
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
  });

  it('a press released far away without any move is not a tap', () => {
    const { router, onTap } = setup([{ id: 'mochi', x: 400 }]);
    router.pointerDown(440, 760, 0);
    router.pointerUp(440 + TUNING.dragStartPx, 760, 0.5);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('a cancelled press (release without pointerUp) is not a tap', () => {
    const { router, onTap } = setup([{ id: 'mochi', x: 400 }]);
    router.pointerDown(440, 760, 0);
    router.release();
    router.pointerUp(440, 760, 0.5);
    expect(onTap).not.toHaveBeenCalled();
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
    router.pointerMove(510, 530, 1);

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
    router.pointerMove(510, 330, 1);
    c.update(FRAME, ctx);
    router.pointerUp(510, 330, 1);
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
    router.pointerMove(430, 760, 1);
    expect(router.heldId()).toBe('mochi');
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? 300 : 500;
      router.pointerMove(x, 500, 1);
      router.cursorMove(x, 500, i * 0.2);
    }
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
  });

  it('a plain click never picks the cat up', () => {
    const { router, pets, world } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    const drop = vi.spyOn(world, 'drop');
    const c = pets[0]!.controller;
    const before = c.anim().name;
    router.pointerDown(420, 760, 0);
    router.pointerMove(422, 761, 1);
    router.pointerUp(422, 761, 1);
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
    router.pointerMove(423, 760, 1);
    expect(pickUp).not.toHaveBeenCalled();
    router.pointerMove(424, 760, 1);
    expect(pickUp).toHaveBeenCalledWith('mochi', 400, 720);
    expect(router.heldId()).toBe('mochi');
  });

  it("pointerMove reports 'lifted' exactly once per hold, on the move that picks the cat up", () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    const b = pets[0]!.body;
    const results: (string | undefined)[] = [];
    router.pointerDown(420, 760, 0);
    results.push(router.pointerMove(422, 760, 1));
    results.push(router.pointerMove(430, 760, 1));
    results.push(router.pointerMove(480, 600, 1));
    results.push(router.pointerMove(500, 500, 1));
    expect(results.filter((r) => r === 'lifted')).toHaveLength(1);
    expect(results[1]).toBe('lifted');
    router.pointerUp(500, 500, 1);

    router.pointerDown(b.x + 10, b.y + 10, 0);
    expect(router.pointerMove(b.x + 30, b.y + 10, 1)).toBe('lifted');
    expect(router.pointerMove(b.x + 40, b.y + 10, 1)).toBeUndefined();
  });

  it("a plain click and plain strokes never report 'lifted'", () => {
    const { router } = setup([{ id: 'mochi', x: 400 }]);
    router.pointerDown(420, 760, 0);
    expect(router.pointerMove(421, 760, 1)).toBeUndefined();
    router.pointerUp(421, 760, 1);
    expect(router.pointerMove(450, 760, 0)).toBeUndefined();
  });

  it('releases a held cat when a move arrives with the left button up', () => {
    const { router, world } = setup([{ id: 'mochi', x: 400 }]);
    const drop = vi.spyOn(world, 'drop');
    router.pointerDown(420, 760, 0);
    router.pointerMove(520, 500, 1);
    router.pointerMove(530, 500, 0);
    expect(drop).toHaveBeenCalledWith('mochi');
    expect(router.heldId()).toBeNull();
  });

  it('a press while a cat is still held releases it', () => {
    const { router, world } = setup([{ id: 'mochi', x: 400 }]);
    const drop = vi.spyOn(world, 'drop');
    router.pointerDown(420, 760, 0);
    router.pointerMove(520, 500, 1);
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
    router.pointerMove(470, 760, 1);
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

describe('InputRouter cue ring', () => {
  const screen = { x: 0, y: 0, width: 1000, height: 800 };
  const centreOf = (r: { x: number; y: number; width: number; height: number }) => ({
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
  });

  it('a press on a cue button chooses that cue for the ring pet and does nothing else', () => {
    const { router, world, ring, onCue, onTap } = setup([{ id: 'mochi', x: 400 }]);
    const pickUp = vi.spyOn(world, 'pickUp');
    ring.open('mochi', { x: 442, y: 760 }, screen);
    const clap = ring.current()!.layout.find((l) => l.cue === 'clap')!;
    const p = centreOf(clap.rect);
    router.pointerDown(p.x, p.y, 0);
    router.pointerMove(p.x + 20, p.y, 1);
    router.pointerUp(p.x + 20, p.y, 1);
    expect(onCue).toHaveBeenCalledExactlyOnceWith('mochi', 'clap');
    expect(ring.isOpen()).toBe(false);
    expect(pickUp).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('a right press on a cue button only closes the ring', () => {
    const { router, ring, onCue, onCueRequest } = setup([{ id: 'mochi', x: 400 }]);
    ring.open('mochi', { x: 442, y: 600 }, screen);
    const p = centreOf(ring.current()!.layout.find((l) => l.cue === 'whistle')!.rect);
    router.pointerDown(p.x, p.y, 2);
    expect(ring.isOpen()).toBe(false);
    expect(onCue).not.toHaveBeenCalled();
    expect(onCueRequest).not.toHaveBeenCalled();
  });

  it('clicking outside the ring closes it without choosing a cue', () => {
    const { router, ring, onCue } = setup([{ id: 'mochi', x: 400 }]);
    ring.open('mochi', { x: 442, y: 760 }, screen);
    router.pointerDown(50, 50, 0);
    expect(ring.isOpen()).toBe(false);
    expect(onCue).not.toHaveBeenCalled();
  });

  it('a press on a pet outside the ring closes it and still taps the pet', () => {
    const { router, ring, onCue, onTap } = setup([{ id: 'mochi', x: 400 }]);
    ring.open('mochi', { x: 442, y: 760 }, screen);
    // A corner of the cat that no button covers.
    expect(cueAt(ring.current()!.layout, { x: 405, y: 795 })).toBeNull();
    router.pointerDown(405, 795, 0);
    router.pointerUp(405, 795, 1);
    expect(ring.isOpen()).toBe(false);
    expect(onCue).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledWith('mochi');
  });

  it('reports every stroke and tap to onPetted, for the reward window', () => {
    const { router, onPetted } = setup([{ id: 'mochi', x: 400 }]);
    stroke(router, 2, 0);
    const strokes = onPetted.mock.calls.reduce((n, [, k]) => n + (k as number), 0);
    expect(strokes).toBe(2);
    expect(onPetted.mock.calls.every(([id]) => id === 'mochi')).toBe(true);
    router.pointerDown(442, 760, 0);
    router.pointerUp(442, 760, 5);
    expect(onPetted).toHaveBeenLastCalledWith('mochi', 1);
  });
});

describe('InputRouter with a trainer', () => {
  const fixed = (v: number): Rng => ({ next: () => v });

  /** One cat at x 400 whose router reports petting to a real PetTrainer, as the overlay does. */
  function trained(mood: Mood = { affection: 60, energy: 60 }) {
    const world = new World(floor);
    const b = body('mochi', 400);
    world.add(b);
    const controller = new PetController(pet('mochi', mood), b, seededRng(1));
    const trainer = new PetTrainer(controller, fixed(0), () => b.held || !b.grounded);
    const router = new InputRouter({
      pets: [{ body: b, controller }],
      world,
      ring: new CueRing(),
      onCueRequest: () => undefined,
      onTap: () => undefined,
      onCue: () => undefined,
      onPetted: () => trainer.petted().some((e) => e.kind === 'rewarded'),
      isTraining: () => trainer.phase() === 'playing',
    });
    const run = (seconds: number): void => {
      for (let t = 0; t < seconds; t += FRAME) {
        controller.update(FRAME, { cursor: null, userIdleSeconds: 0, floor });
        trainer.update(FRAME);
      }
    };
    return { controller, trainer, router, run };
  }

  it('a reward stroke raises affection by exactly rewardMood, not stroke affection on top', () => {
    const { controller, trainer, router, run } = trained();
    trainer.cue('whistle');
    run(ANIM_SECONDS.spin + 0.3);
    expect(trainer.phase()).toBe('window');
    const before = controller.pet.mood;
    router.pointerDown(442, 760, 0);
    router.pointerUp(442, 760, 100);
    expect(controller.pet.mood.affection).toBe(rewardMood(before).affection);
  });

  it('strokes and taps during a trick do not start a purr, so the round follows the trick', () => {
    const { controller, trainer, router } = trained();
    trainer.cue('whistle');
    for (let i = 0; i < TUNING.tapsForPurr + 1; i++) {
      router.pointerDown(442, 760, 0);
      router.pointerUp(442, 760, 100 + i * 0.1);
    }
    stroke(router, TUNING.strokesForPurr + 1, 101);
    expect(controller.anim().name).toBe('spin');
    expect(trainer.phase()).toBe('playing');
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

describe('InputRouter while pets are curled up', () => {
  it('ignores strokes, presses, taps and cue requests', () => {
    let on = false;
    const { router, pets, onTap, onCueRequest } = setup([{ id: 'mochi', x: 400 }], () => !on);
    on = true;
    stroke(router, 3, 0);
    router.pointerDown(420, 760, 0);
    router.pointerUp(420, 760, 1);
    router.pointerDown(420, 760, 2);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60);
    expect(onTap).not.toHaveBeenCalled();
    expect(onCueRequest).not.toHaveBeenCalled();
    expect(router.heldId()).toBeNull();
  });

  it('still pets normally while interactive', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }], () => true);
    stroke(router, 1, 0);
    expect(pets[0]!.controller.pet.mood.affection).toBeGreaterThan(60);
  });
});

describe('InputRouter.resetStrokes', () => {
  it('does not count the first cursor move after a reset as a continuation', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    stroke(router, 1, 0);
    const after = pets[0]!.controller.pet.mood.affection;
    expect(after).toBe(60 + TUNING.affectionPerStroke);
    router.resetStrokes();
    router.cursorMove(420, 760, 5);
    expect(pets[0]!.controller.pet.mood.affection).toBe(after);
  });

  it('counts that move without a reset (guards the test above)', () => {
    const { router, pets } = setup([{ id: 'mochi', x: 400 }]);
    stroke(router, 1, 0);
    router.cursorMove(420, 760, 5);
    expect(pets[0]!.controller.pet.mood.affection).toBe(60 + 2 * TUNING.affectionPerStroke);
  });
});
