import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { isNosePink, prepare } from '../../scripts/art/build';

const ROOT = join(__dirname, '../..');
const COAT = join(ROOT, 'art/source/cat/orange-tabby');

/** How many opaque nose-pink pixels an RGBA buffer holds. */
function nosePixels(data: Buffer): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && isNosePink(data[i], data[i + 1], data[i + 2])) n++;
  }
  return n;
}

async function rgba(file: string): Promise<Buffer> {
  return sharp(file).ensureAlpha().raw().toBuffer();
}

describe('cat noses', () => {
  it('tells nose pink from the pale fur and inner ear next to it', () => {
    expect(isNosePink(233, 125, 125)).toBe(true);
    expect(isNosePink(226, 120, 124)).toBe(true);
    expect(isNosePink(238, 175, 120)).toBe(false);
    expect(isNosePink(219, 152, 126)).toBe(false);
    expect(isNosePink(246, 164, 78)).toBe(false);
  });

  it('keeps the nose when the reference is cut down to 16 colours', async () => {
    expect(nosePixels(await prepare(join(COAT, 'reference.png'), 'reference'))).toBeGreaterThan(0);
  });

  it('ships a nose on the head part and every walk frame', async () => {
    for (const name of ['head', 'walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6']) {
      expect(nosePixels(await rgba(join(COAT, `${name}.png`))), name).toBeGreaterThan(0);
    }
  });

  it('keeps the nose pink in every recoloured coat', async () => {
    for (const coat of ['orange-tabby', 'black', 'white', 'grey']) {
      const atlas = JSON.parse(readFileSync(join(ROOT, `src/assets/atlas/cat-${coat}.json`), 'utf8')) as {
        frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
      };
      const { x, y, w, h } = atlas.frames.head.frame;
      const head = await sharp(join(ROOT, `src/assets/atlas/cat-${coat}.png`))
        .extract({ left: x, top: y, width: w, height: h })
        .ensureAlpha()
        .raw()
        .toBuffer();
      expect(nosePixels(head), coat).toBeGreaterThan(0);
    }
  });
});
