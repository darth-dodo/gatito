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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export class World {
  private floor: Floor;
  private readonly map = new Map<string, Body>();
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
    }
  }

  add(b: Body): void {
    this.map.set(b.id, b);
  }

  remove(id: string): void {
    this.map.delete(id);
  }

  step(dt: number): void {
    const h = TUNING.simStepSeconds;
    this.remainder += dt;
    while (this.remainder >= h - 1e-9) {
      this.remainder = Math.max(0, this.remainder - h);
      for (const b of this.map.values()) this.integrate(b, h);
    }
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
  }

  bodies(): Body[] {
    return [...this.map.values()];
  }

  private moveTo(b: Body, x: number, y: number): void {
    b.x = this.clampX(b, x);
    b.y = this.clampY(b, y);
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
