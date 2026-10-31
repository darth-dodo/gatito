import { describe, expect, it } from 'vitest';
import { defringe, isMagentaTinted } from '../../scripts/art/defringe';

/** A w by h RGBA buffer, transparent, with helpers to paint pixels. */
function canvas(w: number, h: number) {
  const data = Buffer.alloc(w * h * 4);
  const set = (x: number, y: number, rgb: [number, number, number]) => {
    const i = (y * w + x) * 4;
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  };
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  return { data, set, px };
}

describe('isMagentaTinted', () => {
  it('flags magenta blends and spares fur, outline and the pink nose', () => {
    expect(isMagentaTinted(240, 68, 156)).toBe(true); // magenta over orange
    expect(isMagentaTinted(127, 0, 127)).toBe(true); // magenta over black
    expect(isMagentaTinted(248, 124, 194)).toBe(true); // light blend
    expect(isMagentaTinted(224, 136, 58)).toBe(false);
    expect(isMagentaTinted(42, 26, 20)).toBe(false);
    expect(isMagentaTinted(232, 144, 154)).toBe(false);
  });
});

describe('defringe', () => {
  it('replaces a magenta-blended anti-aliased edge with the neighbouring art colour', () => {
    const c = canvas(6, 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) c.set(x, y, [224, 136, 58]);
    for (let y = 0; y < 4; y++) c.set(3, y, [240, 68, 156]); // fringe column
    defringe(c.data, 6, 4);
    for (let y = 0; y < 4; y++) {
      const [r, g, b, a] = c.px(3, y);
      expect(a === 0 || !isMagentaTinted(r, g, b)).toBe(true);
      if (a !== 0) expect([r, g, b]).toEqual([224, 136, 58]);
    }
  });

  it('drops a fringe pixel with no art beside it', () => {
    const c = canvas(5, 5);
    c.set(2, 2, [240, 68, 156]);
    defringe(c.data, 5, 5);
    expect(c.px(2, 2)[3]).toBe(0);
  });

  it('removes a lone opaque speck but keeps connected pixels', () => {
    const c = canvas(8, 4);
    c.set(1, 1, [224, 136, 58]);
    c.set(1, 2, [224, 136, 58]);
    c.set(6, 1, [224, 136, 58]);
    defringe(c.data, 8, 4);
    expect(c.px(6, 1)[3]).toBe(0);
    expect(c.px(1, 1)[3]).toBe(255);
    expect(c.px(1, 2)[3]).toBe(255);
  });
});
