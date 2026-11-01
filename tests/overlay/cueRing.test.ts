import { describe, expect, it } from 'vitest';
import type { Rect } from '../../src/ipc';
import { CUES } from '../../src/brain/types';
import { CUE_ICONS, cueAt, cueRingLayout } from '../../src/overlay/cueRing';

const screen: Rect = { x: 0, y: 0, width: 1440, height: 900 };

function overlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  );
}

function inside(r: Rect, s: Rect): boolean {
  return r.x >= s.x && r.y >= s.y && r.x + r.width <= s.x + s.width && r.y + r.height <= s.y + s.height;
}

describe('cue ring', () => {
  it('ring has the four cues around the cat', () => {
    const centre = { x: 700, y: 800 };
    const ring = cueRingLayout(centre, screen);
    expect(ring.map((r) => r.cue).sort()).toEqual([...CUES].sort());
    for (let i = 0; i < ring.length; i++) {
      expect(inside(ring[i]!.rect, screen)).toBe(true);
      for (let j = i + 1; j < ring.length; j++) {
        expect(overlap(ring[i]!.rect, ring[j]!.rect)).toBe(false);
      }
    }
  });

  it('stays on screen and apart for a cat at any edge or corner', () => {
    const spots = [
      { x: 0, y: 0 }, { x: 0, y: 450 }, { x: 0, y: 900 },
      { x: 1440, y: 900 }, { x: 1440, y: 450 }, { x: 720, y: 900 }, { x: 720, y: 0 },
    ];
    for (const p of spots) {
      const ring = cueRingLayout(p, screen);
      expect(ring).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(inside(ring[i]!.rect, screen)).toBe(true);
        for (let j = i + 1; j < 4; j++) expect(overlap(ring[i]!.rect, ring[j]!.rect)).toBe(false);
      }
    }
  });

  it('honours a screen that does not start at the origin', () => {
    const s: Rect = { x: 100, y: 50, width: 800, height: 600 };
    for (const r of cueRingLayout({ x: 100, y: 50 }, s)) expect(inside(r.rect, s)).toBe(true);
  });

  it('has the icons as data', () => {
    expect(CUE_ICONS).toEqual({ whistle: '🎵', clap: '👏', 'toy-wand': '🪶', 'treat-bag': '🐟' });
  });

  it('cueAt finds the cue under a point', () => {
    const ring = cueRingLayout({ x: 700, y: 600 }, screen);
    for (const { cue, rect } of ring) {
      expect(cueAt(ring, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })).toBe(cue);
    }
  });

  it('clicking outside the ring returns null so the ring can close', () => {
    const ring = cueRingLayout({ x: 700, y: 600 }, screen);
    expect(cueAt(ring, { x: 5, y: 5 })).toBeNull();
    expect(cueAt(ring, { x: 700, y: 600 })).toBeNull();
  });
});
