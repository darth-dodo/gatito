import { petMood } from '../brain/mood';
import { StrokeDetector } from '../brain/stroke';
import { TUNING } from '../brain/tuning';
import type { Point } from '../ipc';
import type { PetController } from '../sim/controller';
import type { Body, World } from '../sim/world';

/**
 * While a pet is held its hit box grows by this much on every side, so a fast drag that outruns
 * a frame never lands outside it and turns click-through back on mid drag.
 */
export const HELD_HITBOX_PAD_PX = 160;

/**
 * Pure: true once the host cursor is outside the held pet's padded hit box. Past that point the
 * overlay is click-through again and would never see the mouse-up, so the hold must end.
 */
export function cursorEscapedHold(body: Body, cursor: Point | null): boolean {
  if (!cursor) return false;
  const pad = HELD_HITBOX_PAD_PX;
  return (
    cursor.x < body.x - pad ||
    cursor.x > body.x + body.width + pad ||
    cursor.y < body.y - pad ||
    cursor.y > body.y + body.height + pad
  );
}

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
  /** Where the press happened; the pick up waits for the pointer to move dragStartPx from here. */
  pressX: number;
  pressY: number;
  /** Pointer position minus the body's top left at the press, so the cat does not jump. */
  dx: number;
  dy: number;
  /** False while the press is still only a press (a click so far). */
  lifted: boolean;
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

  /** The pet currently picked up, or null. */
  heldId(): string | null {
    return this.hold?.lifted ? this.hold.id : null;
  }

  /** `buttons` is the PointerEvent bitmask; bit 1 is the left button. */
  pointerMove(x: number, y: number, t: number, buttons: number): void {
    const hold = this.hold;
    if (hold) {
      // The mouse-up went somewhere else: never leave a pet stuck in the air.
      if ((buttons & 1) === 0) {
        this.release();
        return;
      }
      if (!hold.lifted) {
        if (Math.hypot(x - hold.pressX, y - hold.pressY) < TUNING.dragStartPx) return;
        hold.lifted = true;
        this.deps.world.pickUp(hold.id, hold.pressX - hold.dx, hold.pressY - hold.dy);
      }
      this.deps.world.dragTo(hold.id, x - hold.dx, y - hold.dy);
      return;
    }
    const target = this.hit(x, y);
    if (target?.body.id !== this.over) this.leaveStroking();
    if (!target) return;
    this.over = target.body.id;
    this.stroke(target, x, t);
  }

  pointerDown(x: number, y: number, button: 0 | 2): void {
    if (this.hold?.lifted) {
      // A press while still holding means the last release was missed: drop now.
      this.release();
      return;
    }
    this.hold = null;
    const target = this.hit(x, y);
    if (!target) return;
    const id = target.body.id;
    if (button === 2) {
      this.deps.onCueRequest(id);
      return;
    }
    this.leaveStroking();
    const b = target.body;
    this.hold = { id, pressX: x, pressY: y, dx: x - b.x, dy: y - b.y, lifted: false };
  }

  pointerUp(_x: number, _y: number): void {
    this.release();
  }

  /** Ends any press; a picked up pet drops. Dropping never touches mood. */
  release(): void {
    const hold = this.hold;
    this.hold = null;
    if (hold?.lifted) this.deps.world.drop(hold.id);
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
