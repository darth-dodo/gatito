import type { Floor, Point } from '../ipc';
import { chooseBehaviour, type BehaviourName } from '../brain/behaviour';
import { clampFrameDelta } from '../brain/clock';
import type { Activity } from '../brain/mood';
import type { Rng } from '../brain/rng';
import { TUNING } from '../brain/tuning';
import type { Pet, Trick } from '../brain/types';
import { ANIM_SECONDS, type AnimName } from '../render/rig';
import type { Body } from './world';

/** Walking speed in logical px per second. */
export const WALK_SPEED = 60;
const ZOOMIES_SPEED = 520;
const WANDER_PX: readonly [number, number] = [60, 220];
const WALK_AWAY_PX = 160;
/** Clearance past the cursor when shifting aside, in logical px. */
const ASIDE_GAP_PX = 12;
/** Gap between a staring or cuddling cat's side and the cursor, in logical px. */
const STARE_GAP_PX = 40;
const CUDDLE_GAP_PX = 8;
const ARRIVE_PX = 2;
/** A cursor that moves less than this per frame counts as still. */
const CURSOR_STILL_PX = 1.5;

/** How long each stationary behaviour lasts, in seconds (min, max). */
const BEHAVIOUR_SECONDS: Partial<Record<BehaviourName, readonly [number, number]>> = {
  'idle-sit': [4, 8],
  groom: [4, 7],
  nap: [30, 90],
  loaf: [8, 16],
  stare: [5, 9],
  'cuddle-nap': [45, 120],
  'content-sit': [4, 8],
  'grumpy-sit': [3, 6],
};

/** Animations that run to their end even if the cursor rests on the cat. */
const UNINTERRUPTIBLE: ReadonlySet<AnimName> = new Set<AnimName>([
  'spin', 'sit-up', 'roll-over', 'high-five', 'chase-tail', 'purr', 'yawn', 'belly-up', 'land',
]);

const NAPS: ReadonlySet<AnimName> = new Set<AnimName>(['nap', 'cuddle-nap']);
const ACTIVE: ReadonlySet<AnimName> = new Set<AnimName>([
  'walk', 'wander', 'zoomies', 'spin', 'sit-up', 'roll-over', 'high-five', 'chase-tail',
]);

export interface ControllerContext {
  /** Latest cursor position in logical px, or null before the first cursor event. */
  cursor: Point | null;
  userIdleSeconds: number;
  floor: Floor;
}

export type ControllerAction =
  | { kind: 'trick'; trick: Trick }
  | { kind: 'purr' }
  | { kind: 'belly-up' }
  | { kind: 'yawn' }
  | { kind: 'walk-away' };

type Plan =
  /** Plays for a fixed time. */
  | { kind: 'timed'; seconds: number }
  /** Walks a distance; the world turns the cat at screen edges. */
  | { kind: 'travel'; px: number }
  /** Walks to an x, then plays `then` for its time. */
  | { kind: 'approach'; x: number; then: BehaviourName; seconds: number };

interface Current {
  name: AnimName;
  t: number;
  plan: Plan;
  /** False until the plan has been set up against a context (the first update after the constructor). */
  ready: boolean;
  /** The behaviour picked, before any approach walk. */
  picked: AnimName;
}

/**
 * Pure per-pet driver: decides what the pet does, sets its velocity and facing on its body,
 * and reports the animation to draw. The world moves the body.
 */
export class PetController {
  pet: Pet;
  private readonly body: Body;
  private readonly rng: Rng;
  private current: Current;
  private airborne = false;
  private stillFor = 0;
  private lastCursor: Point | null = null;
  private lastX: number;
  /** Set while a napping cat's quick stretch plays before it shifts aside. */
  private wokenByCursor = false;

  constructor(pet: Pet, body: Body, rng: Rng) {
    this.pet = pet;
    this.body = body;
    this.rng = rng;
    this.lastX = body.x;
    this.current = this.pick(0);
  }

  anim(): { name: AnimName; t: number } {
    return { name: this.current.name, t: this.current.t };
  }

  activity(): Activity {
    if (NAPS.has(this.current.name)) return 'napping';
    return ACTIVE.has(this.current.name) ? 'active' : 'resting';
  }

  start(action: ControllerAction): void {
    if (this.body.held || !this.body.grounded) return;
    this.body.vx = 0;
    if (action.kind === 'trick') {
      this.play(action.trick, { kind: 'timed', seconds: ANIM_SECONDS[action.trick] });
    } else if (action.kind === 'purr' || action.kind === 'belly-up' || action.kind === 'yawn') {
      this.play(action.kind, { kind: 'timed', seconds: ANIM_SECONDS[action.kind] });
    } else {
      const c = this.lastCursor;
      const dir = c ? (c.x > this.centre() ? -1 : 1) : (-this.body.facing as 1 | -1);
      this.walk('wander', dir, WALK_AWAY_PX, WALK_SPEED);
    }
  }

  update(rawDt: number, ctx: ControllerContext): void {
    const dt = clampFrameDelta(rawDt);
    const b = this.body;

    if (b.held || !b.grounded) {
      const name: AnimName = b.held ? 'dangle' : 'fall';
      if (this.current.name !== name) this.play(name, { kind: 'timed', seconds: Infinity });
      this.airborne = true;
      this.current.t += dt;
      this.trackCursor(null, dt);
      this.lastX = b.x;
      return;
    }
    if (this.airborne) {
      this.airborne = false;
      b.vx = 0;
      this.play('land', { kind: 'timed', seconds: ANIM_SECONDS.land });
    }

    if (!this.current.ready) this.setUp(ctx);
    this.trackCursor(ctx.cursor, dt);
    const wakeAfter = TUNING.underCursorSeconds - TUNING.quickStretchSeconds;
    if (NAPS.has(this.current.name) && this.stillFor > wakeAfter) {
      // Never snap from sleep to walking: a quick stretch, then out from under the cursor.
      this.play('stretch', { kind: 'timed', seconds: TUNING.quickStretchSeconds });
      this.wokenByCursor = true;
      this.lastX = b.x;
      return;
    }
    if (this.stillFor > TUNING.underCursorSeconds && !UNINTERRUPTIBLE.has(this.current.name)) {
      this.shiftAside(ctx);
      this.lastX = b.x;
      return;
    }

    this.current.t += dt;
    if (this.current.name === 'stare' && ctx.cursor) this.face(ctx.cursor.x - this.centre());
    if (this.finished()) this.next(ctx);
    this.lastX = b.x;
  }

  private centre(): number {
    return this.body.x + this.body.width / 2;
  }

  private face(dx: number): void {
    if (dx !== 0) this.body.facing = dx > 0 ? 1 : -1;
  }

  private trackCursor(cursor: Point | null, dt: number): void {
    const b = this.body;
    const over =
      cursor !== null &&
      cursor.x >= b.x && cursor.x <= b.x + b.width &&
      cursor.y >= b.y && cursor.y <= b.y + b.height;
    const still =
      over && this.lastCursor !== null &&
      Math.hypot(cursor.x - this.lastCursor.x, cursor.y - this.lastCursor.y) < CURSOR_STILL_PX;
    this.stillFor = still ? this.stillFor + dt : 0;
    if (cursor) this.lastCursor = { ...cursor };
  }

  private finished(): boolean {
    const c = this.current;
    const plan = c.plan;
    if (plan.kind === 'timed') return c.t >= plan.seconds;
    if (plan.kind === 'travel') {
      plan.px -= Math.abs(this.body.x - this.lastX);
      return plan.px <= 0;
    }
    const dx = plan.x - this.body.x;
    if (Math.abs(dx) <= ARRIVE_PX || Math.sign(dx) !== Math.sign(this.body.vx)) {
      this.body.vx = 0;
      this.play(plan.then, { kind: 'timed', seconds: plan.seconds });
      return false;
    }
    return false;
  }

  private next(ctx: ControllerContext): void {
    const was = this.current.name;
    this.body.vx = 0;
    if (NAPS.has(was)) {
      this.play('stretch', { kind: 'timed', seconds: ANIM_SECONDS.stretch });
      return;
    }
    const woken = this.wokenByCursor;
    this.wokenByCursor = false;
    if (this.stillFor > TUNING.underCursorSeconds || (woken && this.stillFor > 0)) {
      this.shiftAside(ctx);
      return;
    }
    this.current = this.pick(ctx.userIdleSeconds);
    this.setUp(ctx);
  }

  private pick(userIdleSeconds: number): Current {
    const name = chooseBehaviour(this.pet, { userIdleSeconds, justWoke: false }, this.rng);
    return { name, picked: name, t: 0, plan: { kind: 'timed', seconds: 0 }, ready: false };
  }

  private play(name: AnimName, plan: Plan): void {
    this.wokenByCursor = false;
    this.current = { name, picked: name, t: 0, plan, ready: true };
  }

  private span(name: BehaviourName): number {
    const [lo, hi] = BEHAVIOUR_SECONDS[name] ?? [4, 8];
    return lo + (hi - lo) * this.rng.next();
  }

  private walk(name: AnimName, dir: 1 | -1, px: number, speed: number): void {
    this.body.facing = dir;
    this.body.vx = dir * speed;
    this.play(name, { kind: 'travel', px });
  }

  /** Turns the picked behaviour into a plan, now that the floor and cursor are known. */
  private setUp(ctx: ControllerContext): void {
    const name = this.current.picked as BehaviourName;
    const b = this.body;
    const cx = this.centre();
    if (name === 'wander') {
      const dir = this.rng.next() < 0.5 ? -1 : 1;
      const px = WANDER_PX[0] + (WANDER_PX[1] - WANDER_PX[0]) * this.rng.next();
      this.walk('wander', dir, px, WALK_SPEED);
    } else if (name === 'zoomies') {
      const left = cx - ctx.floor.x;
      const right = ctx.floor.x + ctx.floor.width - cx;
      const dir = right >= left ? 1 : -1;
      this.walk('zoomies', dir, 2 * Math.max(left, right), ZOOMIES_SPEED);
    } else if ((name === 'stare' || name === 'cuddle-nap') && ctx.cursor) {
      const gap = b.width / 2 + (name === 'stare' ? STARE_GAP_PX : CUDDLE_GAP_PX);
      const side = cx <= ctx.cursor.x ? -1 : 1;
      const lo = ctx.floor.x;
      const hi = Math.max(lo, ctx.floor.x + ctx.floor.width - b.width);
      const x = Math.min(hi, Math.max(lo, ctx.cursor.x + side * gap - b.width / 2));
      const seconds = this.span(name);
      if (Math.abs(x - b.x) <= ARRIVE_PX) {
        this.play(name, { kind: 'timed', seconds });
      } else {
        const dir = x > b.x ? 1 : -1;
        b.facing = dir;
        b.vx = dir * WALK_SPEED;
        this.play('walk', { kind: 'approach', x, then: name, seconds });
      }
      if (name === 'stare') this.face(ctx.cursor.x - this.centre());
    } else {
      b.vx = 0;
      this.play(name, { kind: 'timed', seconds: this.span(name) });
    }
  }

  /** Never in the way: walk out from under a still cursor. */
  private shiftAside(ctx: ControllerContext): void {
    const b = this.body;
    const cursorX = this.lastCursor?.x ?? this.centre();
    const toLeft = cursorX - ctx.floor.x;
    const toRight = ctx.floor.x + ctx.floor.width - cursorX;
    let dir: 1 | -1 = cursorX >= this.centre() ? -1 : 1;
    const need = b.width + ASIDE_GAP_PX;
    if (dir === -1 && toLeft < need) dir = 1;
    else if (dir === 1 && toRight < need) dir = -1;
    const target = dir === -1 ? cursorX - ASIDE_GAP_PX - b.width : cursorX + ASIDE_GAP_PX;
    this.stillFor = 0;
    this.walk('wander', dir, Math.max(ARRIVE_PX, Math.abs(target - b.x)), WALK_SPEED);
  }
}
