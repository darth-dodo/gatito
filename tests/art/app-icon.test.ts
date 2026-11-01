import { describe, expect, it } from 'vitest';
import { fillWhiteFromRow, tileBounds } from '../../scripts/art/app-icon';

const WHITE = [255, 255, 255];
const BLUE = [160, 200, 220];
const BROWN = [100, 60, 40];

/** Builds a 3-channel image from rows of RGB triples. */
function image(rows: number[][][]): Buffer {
  return Buffer.from(rows.flat(2));
}

describe('app icon helpers', () => {
  it('finds the non-white tile on a white background', () => {
    const data = image([
      [WHITE, WHITE, WHITE, WHITE],
      [WHITE, BLUE, BLUE, WHITE],
      [WHITE, BROWN, WHITE, WHITE],
      [WHITE, WHITE, WHITE, WHITE],
    ]);
    expect(tileBounds(data, 4, 4, 3)).toEqual({ left: 1, top: 1, width: 2, height: 2 });
  });

  it('rejects a blank source', () => {
    expect(() => tileBounds(image([[WHITE, WHITE]]), 2, 1, 3)).toThrow('blank');
  });

  it('fills white corners from the nearest art pixel in the same row', () => {
    const data = image([
      [WHITE, BLUE, BLUE],
      [WHITE, WHITE, BROWN],
    ]);
    fillWhiteFromRow(data, 3, 2, 3);
    expect([...data]).toEqual([BLUE, BLUE, BLUE, BROWN, BROWN, BROWN].flat());
  });

  it('keeps white inside the art, such as eye glints', () => {
    const data = image([[WHITE, BLUE, WHITE, BLUE, WHITE]]);
    fillWhiteFromRow(data, 5, 1, 3);
    expect([...data]).toEqual([BLUE, BLUE, WHITE, BLUE, BLUE].flat());
  });

  it('leaves an all-white row alone', () => {
    const data = image([[WHITE, WHITE]]);
    fillWhiteFromRow(data, 2, 1, 3);
    expect([...data]).toEqual([WHITE, WHITE].flat());
  });
});
