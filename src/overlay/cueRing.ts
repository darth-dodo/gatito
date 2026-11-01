import type { Point, Rect } from '../ipc';
import type { Cue } from '../brain/types';
import { CUES } from '../brain/types';

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
