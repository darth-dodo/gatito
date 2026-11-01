import type { Floor } from '../ipc';
import { TUNING } from '../brain/tuning';

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  held: boolean;
  grounded: boolean;
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

/** Pure: the drawn position between the previous and current simulation steps; alpha 0 is prev, 1 is curr. */
/** A pet's box as drawn: the interpolated origin rounded to whole pixels, as PetStage.draw rounds it. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawnBox(b: Body, at: Position): Box {
  return { x: Math.round(at.x), y: Math.round(at.y), width: b.width, height: b.height };
}

export function lerpPosition(prev: Position, curr: Position, alpha: number): Position {
  return { x: prev.x + (curr.x - prev.x) * alpha, y: prev.y + (curr.y - prev.y) * alpha };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export class World {
  private floor: Floor;
  private readonly map = new Map<string, Body>();
  /** Each body's position before the last fixed step, for render interpolation. */
  private readonly prev = new Map<string, Position>();
  private remainder = 0;

  constructor(floor: Floor) {
    this.floor = floor;
  }

  setFloor(f: Floor): void {
    this.floor = f;
    for (const b of this.map.values()) {
      b.x = this.clampX(b, b.x);
      if (b.grounded && !b.held) b.y = f.bottom - b.height;
      else b.y = this.clampY(b, b.y);
      this.snap(b);
    }
  }

  add(b: Body): void {
    this.map.set(b.id, b);
    this.snap(b);
  }

  remove(id: string): void {
    this.map.delete(id);
    this.prev.delete(id);
  }

  step(dt: number): void {
    const h = TUNING.simStepSeconds;
    this.remainder += dt;
    while (this.remainder >= h - 1e-9) {
      this.remainder = Math.max(0, this.remainder - h);
      for (const b of this.map.values()) {
        this.snap(b);
        this.integrate(b, h);
      }
    }
  }

  /** How far the leftover time is into the next fixed step, 0 to 1. */
  alpha(): number {
    return Math.min(1, this.remainder / TUNING.simStepSeconds);
  }

  /** Where to draw a body this frame: between its last two steps, so motion is smooth at any refresh rate. */
  drawPosition(b: Body): Position {
    return lerpPosition(this.prev.get(b.id) ?? b, b, this.alpha());
  }

  /** Where the pet was last drawn, for hit boxes and pointer hit tests. */
  drawnBox(b: Body): Box {
    return drawnBox(b, this.drawPosition(b));
  }

  pickUp(id: string, x: number, y: number): void {
    const b = this.map.get(id);
    if (!b) return;
    b.held = true;
    b.grounded = false;
    b.vx = 0;
    b.vy = 0;
    this.moveTo(b, x, y);
  }

  dragTo(id: string, x: number, y: number): void {
    const b = this.map.get(id);
    if (!b?.held) return;
    this.moveTo(b, x, y);
  }

  drop(id: string): void {
    const b = this.map.get(id);
    if (!b?.held) return;
    b.held = false;
    b.vx = 0;
    b.vy = 0;
    b.x = this.clampX(b, b.x);
    b.y = this.clampY(b, b.y);
    b.grounded = b.y + b.height >= this.floor.bottom;
    this.snap(b);
  }

  bodies(): Body[] {
    return [...this.map.values()];
  }

  private moveTo(b: Body, x: number, y: number): void {
    b.x = this.clampX(b, x);
    b.y = this.clampY(b, y);
    this.snap(b);
  }

  /** Jumps (pick up, drag, drop, a new floor) are drawn at once, not slid into. */
  private snap(b: Body): void {
    this.prev.set(b.id, { x: b.x, y: b.y });
  }

  private clampX(b: Body, x: number): number {
    const lo = this.floor.x;
    return clamp(x, lo, Math.max(lo, lo + this.floor.width - b.width));
  }

  private clampY(b: Body, y: number): number {
    return clamp(y, this.floor.y, Math.max(this.floor.y, this.floor.bottom - b.height));
  }

  private integrate(b: Body, h: number): void {
    if (b.held) return;
    const minX = this.floor.x;
    const maxX = Math.max(minX, minX + this.floor.width - b.width);
    b.x += b.vx * h;
    if (b.x <= minX) {
      b.x = minX;
      if (b.vx < 0) {
        b.vx = -b.vx;
        b.facing = 1;
      }
    } else if (b.x >= maxX) {
      b.x = maxX;
      if (b.vx > 0) {
        b.vx = -b.vx;
        b.facing = -1;
      }
    }
    const restY = this.floor.bottom - b.height;
    if (b.grounded) {
      b.y = restY;
      b.vy = 0;
      return;
    }
    b.vy += TUNING.gravityPxPerS2 * h;
    b.y += b.vy * h;
    if (b.y >= restY) {
      b.y = restY;
      b.vy = 0;
      b.grounded = true;
    } else if (b.y < this.floor.y) {
      b.y = this.floor.y;
      if (b.vy < 0) b.vy = 0;
    }
  }
}
