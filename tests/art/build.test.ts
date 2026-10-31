import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAtlas } from '../../scripts/art/build';
import { writePlaceholders } from '../../scripts/art/placeholder';
import { ART_CELL, PART_NAMES, POSE_NAMES } from '../../src/render/artNames';
import {
  blockColour,
  blocks480,
  CAT_FILL,
  CAT_OUTLINE,
  fortyColours,
  magentaCat,
  writeFullSet,
} from './fixtures/images';
import { writeFileSync } from 'node:fs';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'windowsill-art-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const rawOf = (file: string) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

async function build(srcDir: string) {
  const outDir = join(root, 'out');
  const result = await buildAtlas('cat', 'orange-tabby', srcDir, outDir);
  return { result, outDir };
}

/** Reads the cell of the packed sheet that holds the named frame. */
async function cellOf(outDir: string, name: string): Promise<Buffer> {
  const atlas = JSON.parse(readFileSync(join(outDir, 'cat-orange-tabby.json'), 'utf8'));
  const { x, y, w, h } = atlas.frames[name].frame;
  return sharp(join(outDir, 'cat-orange-tabby.png'))
    .extract({ left: x, top: y, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

describe('buildAtlas', () => {
  it('magenta becomes transparent and the cat pixels are untouched', async () => {
    const src = join(root, 'src');
    await writeFullSet(src);
    const { outDir } = await build(src);
    const cell = await cellOf(outDir, 'body');
    const px = (x: number, y: number) =>
      Array.from(cell.subarray((y * ART_CELL + x) * 4, (y * ART_CELL + x) * 4 + 4));
    expect(px(0, 0)[3]).toBe(0);
    expect(px(95, 95)[3]).toBe(0);
    expect(px(40, 40)).toEqual([...CAT_FILL, 255]);
    expect(px(20, 20)).toEqual([...CAT_OUTLINE, 255]);
  });

  it('any size snaps to the 96 grid with nearest neighbour', async () => {
    const src = join(root, 'src');
    await writeFullSet(src);
    writeFileSync(join(src, 'body.png'), await blocks480());
    const { outDir } = await build(src);
    const cell = await cellOf(outDir, 'body');
    for (const [bx, by] of [[0, 0], [1, 0], [7, 3], [95, 95], [47, 47], [20, 81]]) {
      const i = (by * ART_CELL + bx) * 4;
      expect(Array.from(cell.subarray(i, i + 3))).toEqual(blockColour(bx, by));
    }
  });

  it('at most 16 colours', async () => {
    const src = join(root, 'src');
    await writeFullSet(src);
    writeFileSync(join(src, 'body.png'), await fortyColours());
    const { outDir } = await build(src);
    const cell = await cellOf(outDir, 'body');
    const colours = new Set<string>();
    for (let i = 0; i < cell.length; i += 4) {
      if (cell[i + 3] > 0) colours.add(`${cell[i]},${cell[i + 1]},${cell[i + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(1);
    expect(colours.size).toBeLessThanOrEqual(16);
  });

  it('missing parts are listed and nothing is written', async () => {
    const src = join(root, 'src');
    await writeFullSet(src, ['tail', 'sit']);
    const { result, outDir } = await build(src);
    expect(result.missing).toEqual(['tail', 'sit']);
    expect(existsSync(join(outDir, 'cat-orange-tabby.json'))).toBe(false);
  });

  it('rejects an image that is not square', async () => {
    const src = join(root, 'src');
    await writeFullSet(src);
    writeFileSync(join(src, 'head.png'), await sharp(await magentaCat()).resize(96, 60, { fit: 'fill' }).png().toBuffer());
    await expect(build(src)).rejects.toThrow(/head/);
  });

  it('writes a PixiJS sheet: frames, anchors from the rig, meta', async () => {
    const src = join(root, 'src');
    await writeFullSet(src);
    const { outDir } = await build(src);
    const atlas = JSON.parse(readFileSync(join(outDir, 'cat-orange-tabby.json'), 'utf8'));
    const rig = JSON.parse(readFileSync('art/rig/cat.json', 'utf8'));
    expect(Object.keys(atlas.frames)).toEqual([...PART_NAMES, ...POSE_NAMES]);
    for (const name of PART_NAMES) {
      expect(atlas.frames[name].anchor).toEqual({ x: rig.parts[name].anchor[0], y: rig.parts[name].anchor[1] });
    }
    expect(atlas.frames.sit.anchor).toBeUndefined();
    expect(ART_CELL).toBe(96);
    expect(rig.cell).toBe(ART_CELL);
    expect(atlas.frames.body.sourceSize).toEqual({ w: 96, h: 96 });
    expect(atlas.frames.body.frame).toEqual({ x: 0, y: 0, w: 96, h: 96 });
    expect(atlas.frames.head.frame).toEqual({ x: 96, y: 0, w: 96, h: 96 });
    expect(atlas.meta).toMatchObject({ image: 'cat-orange-tabby.png', scale: '1' });
    const { info } = await rawOf(join(outDir, 'cat-orange-tabby.png'));
    expect(atlas.meta.size).toEqual({ w: info.width, h: info.height });
  });
});

describe('writePlaceholders', () => {
  it('placeholders cover every name', async () => {
    const src = join(root, 'ph');
    await writePlaceholders('cat', 'grey', src);
    const { result, outDir } = await build(src);
    expect(result.missing).toEqual([]);
    const atlas = JSON.parse(readFileSync(join(outDir, 'cat-orange-tabby.json'), 'utf8'));
    for (const name of [...PART_NAMES, ...POSE_NAMES]) expect(atlas.frames[name]).toBeDefined();
  });

  it('every placeholder has visible pixels and the parts differ from each other', async () => {
    const src = join(root, 'ph');
    await writePlaceholders('cat', 'orange-tabby', src);
    const { outDir } = await build(src);
    const seen = new Set<string>();
    for (const name of [...PART_NAMES, ...POSE_NAMES]) {
      const cell = await cellOf(outDir, name);
      let opaque = 0;
      for (let i = 3; i < cell.length; i += 4) if (cell[i] > 0) opaque++;
      expect(opaque, name).toBeGreaterThan(8);
      seen.add(cell.toString('base64'));
    }
    expect(seen.size).toBe(PART_NAMES.length + POSE_NAMES.length);
  });
});

describe('npm run art', () => {
  it('derived coats from a magenta-background tabby have a transparent background', async () => {
    const src = join(root, 'source');
    await writeFullSet(join(src, 'cat', 'orange-tabby'));
    const out = join(root, 'out');
    execFileSync('node_modules/.bin/tsx', ['scripts/art/build.ts', '--src', src, '--out', out], { stdio: 'pipe' });
    for (const coat of ['black', 'white', 'grey']) {
      const atlas = JSON.parse(readFileSync(join(out, `cat-${coat}.json`), 'utf8'));
      const { x, y } = atlas.frames.body.frame;
      const cell = await sharp(join(out, `cat-${coat}.png`))
        .extract({ left: x, top: y, width: 96, height: 96 })
        .ensureAlpha()
        .raw()
        .toBuffer();
      expect(cell[3], coat).toBe(0);
      expect(cell[(95 * 96 + 95) * 4 + 3], coat).toBe(0);
      for (let i = 0; i < cell.length; i += 4) {
        if (cell[i + 3] > 0) expect([cell[i], cell[i + 1], cell[i + 2]], coat).not.toEqual([232, 144, 154]);
      }
    }
  }, 30_000);

  it('exits 1 and names the missing files', async () => {
    const src = join(root, 'source');
    await writeFullSet(join(src, 'cat', 'orange-tabby'), ['tail', 'sit']);
    mkdirSync(join(root, 'out'));
    let failure: { status: number; stderr: string } | undefined;
    try {
      execFileSync('node_modules/.bin/tsx', ['scripts/art/build.ts', '--src', src, '--out', join(root, 'out')], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (e) {
      failure = e as { status: number; stderr: string };
    }
    expect(failure?.status).toBe(1);
    expect(failure?.stderr).toMatch(/tail/);
    expect(failure?.stderr).toMatch(/sit/);
  }, 30_000);
});
