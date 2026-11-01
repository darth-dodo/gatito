import { petMood } from '../brain/mood';
import { StrokeDetector } from '../brain/stroke';
import { TUNING } from '../brain/tuning';
import type { Point } from '../ipc';
import type { Cue } from '../brain/types';
import type { CueRing } from './cueRing';
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
  /** Right button on a pet: the host opens the cue ring around it. */
  onCueRequest(petId: string): void;
  /** A tap petted this pet: the host shows a small heart burst. */
  onTap(petId: string): void;
  /** The open cue ring; a press goes to it first while it is open. */
  ring: Pick<CueRing, 'isOpen' | 'press'>;
  /** A cue button was pressed for this pet. */
  onCue(petId: string, cue: Cue): void;
  /**
   * `n` strokes or taps just reached this pet. Returns true when they were taken as a trick
   * reward, which carries its own mood change, so the stroke affection is not added on top.
   */
  onPetted(petId: string, n: number): boolean;
  /** True while this pet is playing a cued trick: petting then starts no purr or belly up. */
  isTraining(petId: string): boolean;
}

interface Stroking {
  /** Counts sweeps from cursor samples; reset whenever the sweep is broken. */
  detector: StrokeDetector;
  /** Detector total already turned into affection. */
  seen: number;
  /** Strokes and taps given to this pet since the cursor arrived on it. */
  total: number;
  /** Times of recent strokes and taps, for the purr window. */
  strokeTimes: number[];
  tapTimes: number[];
  /** `total` when the current purr started, or null when not purring. */
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

function recent(times: number[], t: number): number[] {
  return times.filter((s) => t - s <= TUNING.strokeWindowSeconds && s <= t);
}

/**
 * Turns input into pet reactions. Strokes come only from the host cursor (`cursorMove`): the
 * real overlay never takes focus, so macOS sends its webview no mouse moves without a button.
 * Pointer events handle the buttons: a left press and release is a tap (a pet), a left press
 * that moves dragStartPx picks a cat up and drops it, the right button asks for the cue ring,
 * and while the ring is open a press picks a cue or, outside its buttons, closes it.
 * Strokes and taps purr a cat and keep going rolls a happy one belly up.
 * Positions are window logical px; times are seconds.
 */
export class InputRouter {
  private readonly deps: InputDeps;
  private readonly strokes = new Map<string, Stroking>();
  /** The pet under the cursor, whose stroking state is live. */
  private over: string | null = null;
  private hold: Hold | null = null;

  constructor(deps: InputDeps) {
    this.deps = deps;
  }

  /** The pet currently picked up, or null. */
  heldId(): string | null {
    return this.hold?.lifted ? this.hold.id : null;
  }

  /**
   * The host's cursor position, with or without a button. The only source of strokes. Ignored
   * while a press or hold is in progress, so a drag never counts as stroking.
   */
  cursorMove(x: number, y: number, t: number): void {
    if (this.hold) return;
    const target = this.hit(x, y);
    if (target?.body.id !== this.over) this.leaveStroking();
    if (!target) return;
    this.over = target.body.id;
    const s = this.stroking(target.body.id);
    const total = s.detector.feed(x, t);
    if (total === s.seen) return;
    const n = total - s.seen;
    s.seen = total;
    for (let i = 0; i < n; i++) s.strokeTimes.push(t);
    this.petted(target, s, n, t);
  }

  /**
   * Pointer moves over the canvas drive only the press and drag. `buttons` is the PointerEvent
   * bitmask; bit 1 is the left button. Returns 'lifted' on the one move per hold that picks the
   * pet up, so the host can capture the pointer right then.
   */
  pointerMove(x: number, y: number, buttons: number): 'lifted' | undefined {
    const hold = this.hold;
    if (!hold) return undefined;
    // The mouse-up went somewhere else: never leave a pet stuck in the air.
    if ((buttons & 1) === 0) {
      this.release();
      return undefined;
    }
    let lifted: 'lifted' | undefined;
    if (!hold.lifted) {
      if (Math.hypot(x - hold.pressX, y - hold.pressY) < TUNING.dragStartPx) return undefined;
      hold.lifted = true;
      lifted = 'lifted';
      this.deps.world.pickUp(hold.id, hold.pressX - hold.dx, hold.pressY - hold.dy);
    }
    this.deps.world.dragTo(hold.id, x - hold.dx, y - hold.dy);
    return lifted;
  }

  pointerDown(x: number, y: number, button: 0 | 2): void {
    if (this.hold?.lifted) {
      // A press while still holding means the last release was missed: drop now.
      this.release();
      return;
    }
    this.hold = null;
    if (this.deps.ring.isOpen()) {
      // Only the left button gives a cue; any other press just closes the ring.
      const chosen = this.deps.ring.press({ x, y });
      if (chosen && button === 0) {
        this.deps.onCue(chosen.petId, chosen.cue);
        return;
      }
      if (chosen) return;
      // A press outside the ring closed it; the press still does what it would have.
    }
    const target = this.hit(x, y);
    if (!target) return;
    const id = target.body.id;
    if (button === 2) {
      this.deps.onCueRequest(id);
      return;
    }
    const b = target.body;
    this.hold = { id, pressX: x, pressY: y, dx: x - b.x, dy: y - b.y, lifted: false };
  }

  /**
   * The left button came up. A press that never lifted and stayed within dragStartPx is a tap:
   * one stroke's worth of petting.
   */
  pointerUp(x: number, y: number, t: number): void {
    const hold = this.hold;
    this.release();
    if (!hold || hold.lifted) return;
    if (Math.hypot(x - hold.pressX, y - hold.pressY) >= TUNING.dragStartPx) return;
    const target = this.deps.pets.find((p) => p.body.id === hold.id);
    if (!target) return;
    if (this.over !== hold.id) this.leaveStroking();
    this.over = hold.id;
    const s = this.stroking(hold.id);
    s.tapTimes.push(t);
    this.deps.onTap(hold.id);
    this.petted(target, s, 1, t);
  }

  /** Ends any press without a tap; a picked up pet drops. Dropping never touches mood. */
  release(): void {
    const hold = this.hold;
    this.hold = null;
    if (!hold) return;
    // The cursor jumped while the press ignored it: start the next sweep fresh.
    const s = this.strokes.get(hold.id);
    if (s) {
      s.detector.reset();
      s.seen = 0;
    }
    if (hold.lifted) this.deps.world.drop(hold.id);
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

  private stroking(id: string): Stroking {
    let s = this.strokes.get(id);
    if (!s) {
      s = { detector: new StrokeDetector(), seen: 0, total: 0, strokeTimes: [], tapTimes: [], purrFrom: null };
      this.strokes.set(id, s);
    }
    return s;
  }

  private leaveStroking(): void {
    if (this.over === null) return;
    const s = this.strokes.get(this.over);
    if (s) {
      s.detector.reset();
      s.seen = 0;
      s.total = 0;
      s.strokeTimes = [];
      s.tapTimes = [];
      s.purrFrom = null;
    }
    this.over = null;
  }

  /** `n` new strokes or taps just reached the pet: affection, then purr or belly up. */
  private petted(target: Pettable, s: Stroking, n: number, t: number): void {
    const c = target.controller;
    const id = target.body.id;
    const training = this.deps.isTraining(id);
    if (!this.deps.onPetted(id, n)) c.pet = { ...c.pet, mood: petMood(c.pet.mood, n) };
    s.total += n;
    s.strokeTimes = recent(s.strokeTimes, t);
    s.tapTimes = recent(s.tapTimes, t);

    // A cued trick is playing: a purr now would cut it short and end the round early.
    if (training) return;
    const now = c.anim().name;
    if (now === 'belly-up') return;
    if (now !== 'purr') s.purrFrom = null;
    if (s.purrFrom === null) {
      const purring =
        s.strokeTimes.length / TUNING.strokesForPurr + s.tapTimes.length / TUNING.tapsForPurr >= 1;
      if (purring) {
        c.start({ kind: 'purr' });
        if (c.anim().name === 'purr') s.purrFrom = s.total;
      }
      return;
    }
    if (s.total - s.purrFrom >= TUNING.strokesForPurr && c.pet.mood.affection >= TUNING.bellyUpMinAffection) {
      c.start({ kind: 'belly-up' });
    }
  }
}
