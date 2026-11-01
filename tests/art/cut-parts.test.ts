import { describe, expect, it } from 'vitest';
import { closedEye, cut, dilate, dropIslands, insidePolygon, lockPalette, paletteOf, polygonMask } from '../../scripts/art/cut-parts';

describe('cut-parts helpers', () => {
  it('tests pixel centres against a polygon', () => {
    const square: [number, number][] = [[1, 1], [3, 1], [3, 3], [1, 3]];
    expect(insidePolygon(1.5, 1.5, square)).toBe(true);
    expect(insidePolygon(3.5, 1.5, square)).toBe(false);
    const m = polygonMask(square, 5);
    expect([...m].filter(Boolean)).toHaveLength(4);
    expect(m[1 * 5 + 1]).toBe(1);
    expect(m[3 * 5 + 3]).toBe(0);
  });

  it('dilates a mask by a square brush', () => {
    const m = new Uint8Array(25);
    m[12] = 1;
    expect([...dilate(m, 1, 5)].filter(Boolean)).toHaveLength(9);
    expect([...dilate(m, 0, 5)].filter(Boolean)).toHaveLength(1);
  });

  it('copies only the masked reference pixels', () => {
    const ref = Buffer.alloc(4 * 4, 200);
    const m = new Uint8Array(4);
    m[2] = 1;
    const out = cut(ref, m);
    expect([...out.subarray(8, 12)]).toEqual([200, 200, 200, 200]);
    expect(out[3]).toBe(0);
  });

  it('closes an eye with fur from above and a dark lid', () => {
    const size = 6;
    const ref = Buffer.alloc(size * size * 4);
    const paint = (x: number, y: number, rgb: number[]) => ref.set([...rgb, 255], (y * size + x) * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) paint(x, y, [240, 190, 140]);
    const eye = new Uint8Array(size * size);
    for (let y = 2; y <= 4; y++) for (let x = 1; x <= 4; x++) {
      eye[y * size + x] = 1;
      paint(x, y, [140, 90, 60]);
    }
    paint(2, 3, [6, 1, 1]);
    const out = closedEye(ref, eye, size);
    const px = (x: number, y: number) => [...out.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)];
    expect(px(2, 2)).toEqual([240, 190, 140, 255]);
    expect(px(2, 3)).toEqual([6, 1, 1, 255]);
    expect(px(1, 2)).toEqual([6, 1, 1, 255]);
    expect(px(0, 0)[3]).toBe(0);
  });
});

describe('walk frame clean-up', () => {
  it('locks colours to the reference palette', () => {
    const data = Buffer.from([250, 160, 80, 255, 10, 5, 0, 255, 0, 0, 0, 0]);
    lockPalette(data, [[246, 164, 78], [6, 1, 1]]);
    expect([...data]).toEqual([246, 164, 78, 255, 6, 1, 1, 255, 0, 0, 0, 0]);
    expect(paletteOf(data)).toHaveLength(2);
  });

  it('drops small islands and keeps the cat', () => {
    const size = 10;
    const data = Buffer.alloc(size * size * 4);
    const on = (x: number, y: number) => (data[(y * size + x) * 4 + 3] = 255);
    for (let y = 4; y < 8; y++) for (let x = 2; x < 8; x++) on(x, y);
    on(0, 0);
    on(1, 0);
    dropIslands(data, 8, size);
    expect(data[3]).toBe(0);
    expect(data[(5 * size + 4) * 4 + 3]).toBe(255);
  });
});
