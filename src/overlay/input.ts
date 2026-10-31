import { petMood } from '../brain/mood';
import { StrokeDetector } from '../brain/stroke';
import { TUNING } from '../brain/tuning';
import type { PetController } from '../sim/controller';
import type { Body, World } from '../sim/world';

/** A pet the pointer can reach: its body for hit tests and its controller for reactions. */
export interface Pettable {
  readonly body: Body;
  readonly controller: Pick<PetController, 'pet' | 'start' | 'anim'>;
}

export interface InputDeps {
  /** Pets in draw order: the last one is drawn on top and wins where pets overlap. */
  pets: readonly Pettable[];
  world: Pick<World, 'pickUp' | 'dragTo' | 'drop'>;
  /** Right button on a pet: opens the cue ring (Task 13). */
  onCueRequest(petId: string): void;
}

interface Stroking {
  detector: StrokeDetector;
  /** Strokes already turned into affection. */
  counted: number;
  /** Strokes counted when the current purr started, or null when not purring. */
  purrFrom: number | null;
}

interface Hold {
  id: string;
  /** Pointer position minus the body's top left at the press, so the cat does not jump. */
  dx: number;
  dy: number;
}

/**
 * Turns pointer events into pet reactions: strokes (no button) purr and roll a cat belly up,
 * the left button picks a cat up and drops it, the right button asks for the cue ring.
 * Positions are window logical px; times are seconds.
 */
export class InputRouter {
  private readonly deps: InputDeps;
  private readonly strokes = new Map<string, Stroking>();
  /** The pet being stroked, whose detector holds the current sweep. */
  private over: string | null = null;
  private hold: Hold | null = null;

  constructor(deps: InputDeps) {
    this.deps = deps;
  }

  /** The pet currently held, or null. */
  heldId(): string | null {
    return this.hold?.id ?? null;
  }

  pointerMove(x: number, y: number, t: number): void {
    if (this.hold) {
      this.deps.world.dragTo(this.hold.id, x - this.hold.dx, y - this.hold.dy);
      return;
    }
    const target = this.hit(x, y);
    if (target?.body.id !== this.over) this.leaveStroking();
    if (!target) return;
    this.over = target.body.id;
    this.stroke(target, x, t);
  }

  pointerDown(x: number, y: number, button: 0 | 2): void {
    if (this.hold) return;
    const target = this.hit(x, y);
    if (!target) return;
    const id = target.body.id;
    if (button === 2) {
      this.deps.onCueRequest(id);
      return;
    }
    this.leaveStroking();
    const b = target.body;
    this.hold = { id, dx: x - b.x, dy: y - b.y };
    this.deps.world.pickUp(id, b.x, b.y);
  }

  pointerUp(_x: number, _y: number): void {
    if (!this.hold) return;
    // Dropping never touches mood.
    this.deps.world.drop(this.hold.id);
    this.hold = null;
  }

  /** The pointer left the pets' window area: any stroke in progress ends. */
  pointerLeave(): void {
    this.leaveStroking();
  }

  private hit(x: number, y: number): Pettable | null {
    const pets = this.deps.pets;
    for (let i = pets.length - 1; i >= 0; i--) {
      const p = pets[i]!;
      const b = p.body;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return p;
    }
    return null;
  }

  private leaveStroking(): void {
    if (this.over === null) return;
    const s = this.strokes.get(this.over);
    if (s) {
      s.detector.reset();
      s.counted = 0;
      s.purrFrom = null;
    }
    this.over = null;
  }

  private stroke(target: Pettable, x: number, t: number): void {
    const id = target.body.id;
    let s = this.strokes.get(id);
    if (!s) {
      s = { detector: new StrokeDetector(), counted: 0, purrFrom: null };
      this.strokes.set(id, s);
    }
    const total = s.detector.feed(x, t);
    if (total === s.counted) return;
    const c = target.controller;
    c.pet = { ...c.pet, mood: petMood(c.pet.mood, total - s.counted) };
    s.counted = total;

    const now = c.anim().name;
    if (now === 'belly-up') return;
    if (now !== 'purr') s.purrFrom = null;
    if (s.purrFrom === null) {
      if (s.detector.purring(t)) {
        c.start({ kind: 'purr' });
        if (c.anim().name === 'purr') s.purrFrom = total;
      }
      return;
    }
    if (total - s.purrFrom >= TUNING.strokesForPurr && c.pet.mood.affection >= TUNING.bellyUpMinAffection) {
      c.start({ kind: 'belly-up' });
    }
  }
}
