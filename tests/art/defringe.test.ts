import { describe, expect, it } from 'vitest';
import { defringe, isLightMagenta, isMagentaTinted } from '../../scripts/art/defringe';

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
    expect(isMagentaTinted(255, 60, 200)).toBe(true); // mostly magenta
    expect(isMagentaTinted(220, 90, 150)).toBe(false); // saturated rose
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

describe('defringe, tighter rules', () => {
  it('keeps a pink nose at the edge of orange fur unchanged', () => {
    const c = canvas(6, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) c.set(x, y, [224, 136, 58]);
    c.set(3, 1, [232, 144, 154]);
    defringe(c.data, 6, 3);
    expect(c.px(3, 1)).toEqual([232, 144, 154, 255]);
  });

  it('keeps a one pixel diagonal stroke', () => {
    const c = canvas(6, 6);
    for (let i = 0; i < 5; i++) c.set(i, i, [42, 26, 20]);
    defringe(c.data, 6, 6);
    for (let i = 0; i < 5; i++) expect(c.px(i, i)[3]).toBe(255);
  });
});

describe('defringe, light magenta halo', () => {
  it('flags light magenta blends', () => {
    expect(isLightMagenta(236, 170, 220)).toBe(true);
    expect(isLightMagenta(220, 90, 150)).toBe(true);
    expect(isLightMagenta(232, 144, 154)).toBe(false); // nose: blue barely above green
    expect(isLightMagenta(224, 136, 58)).toBe(false);
  });

  it('clears a light pink halo beside the keyed background', () => {
    const c = canvas(8, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) c.set(x, y, [224, 136, 58]);
    for (let y = 0; y < 3; y++) c.set(4, y, [42, 26, 20]); // outline
    for (let y = 0; y < 3; y++) c.set(5, y, [236, 170, 220]); // halo outside the outline
    defringe(c.data, 8, 3);
    for (let y = 0; y < 3; y++) {
      expect(c.px(5, y)[3]).toBe(0);
      expect(c.px(4, y)).toEqual([42, 26, 20, 255]);
    }
  });

  it('keeps interior pinks (nose, inner ear, rose) away from the edge', () => {
    const c = canvas(11, 11);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) c.set(x, y, [224, 136, 58]);
    c.set(5, 4, [236, 170, 220]); // inner ear
    c.set(5, 5, [220, 90, 150]); // rose
    c.set(5, 6, [232, 144, 154]); // nose
    // Transparent border, three or more pixels away from the pinks.
    for (let i = 0; i < 11; i++) {
      for (const [x, y] of [[i, 0], [i, 10], [0, i], [10, i]] as const) c.data[(y * 11 + x) * 4 + 3] = 0;
    }
    defringe(c.data, 11, 11);
    expect(c.px(5, 4)).toEqual([236, 170, 220, 255]);
    expect(c.px(5, 5)).toEqual([220, 90, 150, 255]);
    expect(c.px(5, 6)).toEqual([232, 144, 154, 255]);
  });
});
