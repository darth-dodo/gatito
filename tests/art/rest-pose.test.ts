import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepare } from '../../scripts/art/build';
import { CELL, RIG, rigPose } from '../../src/render/rig';
import { PART_NAMES } from '../../src/render/artNames';

const ROOT = join(__dirname, '../..');

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
}

/** The standing puppet at rest, composited from the committed atlas exactly as the stage places it. */
async function restComposite(): Promise<Buffer> {
  const atlas = JSON.parse(readFileSync(join(ROOT, 'src/assets/atlas/cat-orange-tabby.json'), 'utf8')) as {
    frames: Record<string, Frame>;
  };
  const sheet = await sharp(join(ROOT, 'src/assets/atlas/cat-orange-tabby.png')).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  // Visibility comes from the rig: a calm cat with its legs at the middle of a stride.
  const frame = rigPose('walk', 0.25, { affection: 100, energy: 60 });
  const out = Buffer.alloc(CELL * CELL * 4);
  const [bx, by] = RIG.body.anchor;
  const order = [...PART_NAMES].sort((a, b) => RIG[a].z - RIG[b].z);
  for (const name of order) {
    if (!frame.parts[name]?.visible) continue;
    const [ax, ay] = RIG[name].anchor;
    const [ox, oy] = RIG[name].offset;
    // Where the part's image lands in the body's cell: in place for every cut-out part.
    const left = Math.round(bx * CELL + ox - ax * CELL);
    const top = Math.round(by * CELL + oy - ay * CELL);
    expect([name, left + 0, top + 0]).toEqual([name, 0, 0]);
    const f = atlas.frames[name]!.frame;
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const s = ((f.y + y) * sheet.info.width + f.x + x) * 4;
        if (sheet.data[s + 3] === 0) continue;
        sheet.data.copy(out, (y * CELL + x) * 4, s, s + 4);
      }
    }
  }
  return out;
}

describe('cut-out puppet', () => {
  it('at rest is the reference cat, pixel for pixel', async () => {
    const got = await restComposite();
    const want = await prepare(join(ROOT, 'art/source/cat/orange-tabby/reference.png'), 'reference');
    let opaque = 0;
    let differ = 0;
    for (let i = 0; i < CELL * CELL; i++) {
      const a = got.subarray(i * 4, i * 4 + 4);
      const b = want.subarray(i * 4, i * 4 + 4);
      if (b[3] > 0) opaque++;
      const same = a[3] === 0 && b[3] === 0 ? true : a[3] > 0 && b[3] > 0 && [0, 1, 2].every((c) => Math.abs(a[c] - b[c]) <= 6);
      if (!same) differ++;
    }
    expect(opaque).toBeGreaterThan(2000);
    // A tiny tolerance for the odd lone pixel the pipeline's speck filter drops at a cut edge.
    expect(differ, `${differ} of ${opaque} pixels differ`).toBeLessThanOrEqual(Math.ceil(opaque * 0.002));
  });
});
