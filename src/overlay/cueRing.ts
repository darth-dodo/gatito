import type { Point, Rect } from '../ipc';
import type { Cue } from '../brain/types';
import { CUES } from '../brain/types';
import { TUNING } from '../brain/tuning';

export const CUE_ICONS: Record<Cue, string> = {
  whistle: '🎵',
  clap: '👏',
  'toy-wand': '🪶',
  'treat-bag': '🐟',
};

/** Button size and distance from the cat's centre, in logical px. */
const BUTTON_PX = 44;
const RADIUS_PX = 60;

/**
 * Four cue buttons in a diamond around `center`. The whole ring is shifted as one
 * piece to stay on `screen`, so the buttons never overlap, even at an edge or corner.
 */
export function cueRingLayout(center: Point, screen: Rect): { cue: Cue; rect: Rect }[] {
  const half = BUTTON_PX / 2;
  const offsets: Point[] = [
    { x: 0, y: -RADIUS_PX },
    { x: RADIUS_PX, y: 0 },
    { x: 0, y: RADIUS_PX },
    { x: -RADIUS_PX, y: 0 },
  ];
  const span = RADIUS_PX + half;
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const cx = clamp(center.x, screen.x + span, screen.x + screen.width - span);
  const cy = clamp(center.y, screen.y + span, screen.y + screen.height - span);
  return CUES.map((cue, i) => ({
    cue,
    rect: { x: cx + offsets[i]!.x - half, y: cy + offsets[i]!.y - half, width: BUTTON_PX, height: BUTTON_PX },
  }));
}

export function cueAt(layout: { cue: Cue; rect: Rect }[], p: Point): Cue | null {
  for (const { cue, rect } of layout) {
    if (p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height) {
      return cue;
    }
  }
  return null;
}

/** Centre of a ring layout: the middle of its buttons, after any shift to stay on screen. */
function layoutCentre(layout: { rect: Rect }[]): Point {
  const xs = layout.map((l) => l.rect.x + l.rect.width / 2);
  const ys = layout.map((l) => l.rect.y + l.rect.height / 2);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

interface OpenRing {
  petId: string;
  layout: { cue: Cue; rect: Rect }[];
  centre: Point;
  age: number;
}

/**
 * The open cue ring, if any. Pure state: the host draws it and adds `rects()` to the hit boxes.
 * In the real overlay a click outside every hit box goes to other apps and is never seen, so the
 * ring also closes by itself: after cueRingTimeoutSeconds with no choice, or once the cursor goes
 * cueRingLeaveDistancePx from its centre.
 */
export class CueRing {
  private ring: OpenRing | null = null;

  /** Opens around `center` for `petId`, replacing any ring already open. */
  open(petId: string, center: Point, screen: Rect): void {
    const layout = cueRingLayout(center, screen);
    this.ring = { petId, layout, centre: layoutCentre(layout), age: 0 };
  }

  close(): void {
    this.ring = null;
  }

  isOpen(): boolean {
    return this.ring !== null;
  }

  /** The open ring's pet, buttons and centre, or null. */
  current(): { petId: string; layout: { cue: Cue; rect: Rect }[]; centre: Point } | null {
    const r = this.ring;
    return r ? { petId: r.petId, layout: r.layout, centre: r.centre } : null;
  }

  /** The buttons' rects while open, for the hit boxes; empty when closed. */
  rects(): Rect[] {
    return this.ring ? this.ring.layout.map((l) => l.rect) : [];
  }

  /**
   * A press while the ring is open. It closes either way; the result is the chosen cue, or null
   * for a press outside every button (or when no ring is open).
   */
  press(p: Point): { petId: string; cue: Cue } | null {
    const r = this.ring;
    if (!r) return null;
    this.ring = null;
    const cue = cueAt(r.layout, p);
    return cue ? { petId: r.petId, cue } : null;
  }

  /** Ages the ring by `dt` seconds of real time; closes it on timeout or a far cursor. Returns true when it closed. */
  update(dt: number, cursor: Point | null): boolean {
    const r = this.ring;
    if (!r) return false;
    r.age += dt;
    const far =
      cursor !== null &&
      Math.hypot(cursor.x - r.centre.x, cursor.y - r.centre.y) > TUNING.cueRingLeaveDistancePx;
    if (r.age >= TUNING.cueRingTimeoutSeconds || far) {
      this.ring = null;
      return true;
    }
    return false;
  }
}
