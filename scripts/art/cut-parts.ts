// Cuts the standing puppet's parts out of one reference image, so every part has the reference's exact
// pixels and no part brings its own outline into the body. Usage:
//   npx tsx scripts/art/cut-parts.ts [--species cat] [--coat orange-tabby]
// Reads art/source/<species>/<coat>/reference.png, generated/<part>.png (footprints) and cut.json, and
// writes the 12 part images next to the reference as 96 by 96 PNGs.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { ART_CELL, PART_NAMES, type PartName } from '../../src/render/artNames';
import { prepare } from './build';

const CELL = ART_CELL;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export type Point = [number, number];

export interface CutSpec {
  mask?: 'generated';
  polygon?: Point[];
  clip?: Point[];
  dilate?: number;
  /** Grows the mask by this many pixels for the hole it leaves in the body too (for footprints that fall short). */
  grow?: number;
  /** The part is copied from the reference but stays on the body too (it never moves on its own). */
  keepOnBody?: boolean;
  /** First row the part owns; rows above stay on the body. */
  line?: number;
  /** Rows above `line` the part repeats, hidden under or over the body at rest. */
  overlap?: number;
}

/** A per-pixel on or off mask over the art cell. */
export type Mask = Uint8Array;

/** Even-odd test of a point against a polygon. */
export function insidePolygon(px: number, py: number, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The pixels whose centres lie inside the polygon. */
export function polygonMask(poly: readonly Point[], size = CELL): Mask {
  const m = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) m[y * size + x] = insidePolygon(x + 0.5, y + 0.5, poly) ? 1 : 0;
  return m;
}

/** Grows a mask by r pixels in every direction (a square brush). */
export function dilate(mask: Mask, r: number, size = CELL): Mask {
  if (r <= 0) return mask.slice();
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!mask[y * size + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < size && yy < size) out[yy * size + xx] = 1;
        }
      }
    }
  }
  return out;
}

const and = (a: Mask, b: Mask): Mask => a.map((v, i) => (v && b[i] ? 1 : 0));
const rows = (m: Mask, from: number, size = CELL): Mask => m.map((v, i) => (v && Math.floor(i / size) >= from ? 1 : 0));

/** The reference's pixels where the mask is on; transparent elsewhere. */
export function cut(reference: Buffer, mask: Mask): Buffer {
  const out = Buffer.alloc(reference.length);
  for (let i = 0; i < mask.length; i++) if (mask[i]) reference.copy(out, i * 4, i * 4, i * 4 + 4);
  return out;
}

/**
 * A closed eye drawn over the open one: every eye pixel takes the colour of the fur just above the eye,
 * then a dark lid line is drawn across its lower middle, curving up at the corners.
 */
export function closedEye(reference: Buffer, eye: Mask, size = CELL): Buffer {
  const out = Buffer.alloc(reference.length);
  let x0 = size;
  let x1 = -1;
  let y0 = size;
  let y1 = -1;
  for (let i = 0; i < eye.length; i++) {
    if (!eye[i]) continue;
    const x = i % size;
    const y = Math.floor(i / size);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (x1 < 0) return out;
  // The darkest opaque colour in the eye is its outline; the lid uses it.
  let lid = 0;
  let dark = Infinity;
  for (let i = 0; i < eye.length; i++) {
    if (!eye[i] || reference[i * 4 + 3] === 0) continue;
    const sum = reference[i * 4] + reference[i * 4 + 1] + reference[i * 4 + 2];
    if (sum < dark) {
      dark = sum;
      lid = i;
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * size + x;
      if (!eye[i]) continue;
      const above = Math.max(0, y0 - 1) * size + x;
      reference.copy(out, i * 4, above * 4, above * 4 + 4);
      out[i * 4 + 3] = 255;
    }
  }
  const lidRow = y0 + Math.ceil((y1 - y0) / 2);
  for (let x = x0; x <= x1; x++) {
    const y = x === x0 || x === x1 ? lidRow - 1 : lidRow;
    reference.copy(out, (y * size + x) * 4, lid * 4, lid * 4 + 4);
  }
  return out;
}

async function footprint(file: string): Promise<Mask> {
  const data = await prepare(file, file);
  const m = new Uint8Array(CELL * CELL);
  for (let i = 0; i < m.length; i++) m[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  return m;
}

/** Cuts every part; returns the images by name (body included). */
export async function cutParts(dir: string): Promise<Record<PartName, Buffer>> {
  const spec = JSON.parse(readFileSync(join(dir, 'cut.json'), 'utf8')) as { parts: Partial<Record<PartName, CutSpec>> };
  const reference = await prepare(join(dir, 'reference.png'), 'reference');
  const opaque: Mask = new Uint8Array(CELL * CELL).map((_, i) => (reference[i * 4 + 3] > 0 ? 1 : 0));
  const body: Mask = opaque.slice();
  const out = {} as Record<PartName, Buffer>;

  for (const [name, s] of Object.entries(spec.parts) as [PartName, CutSpec][]) {
    let core: Mask;
    if (s.mask === 'generated') {
      const file = join(dir, 'generated', `${name}.png`);
      if (!existsSync(file)) throw new Error(`${name}: ${file} is missing`);
      core = dilate(await footprint(file), s.grow ?? 0);
    } else if (s.polygon) {
      core = polygonMask(s.polygon);
    } else {
      throw new Error(`${name}: needs a mask or a polygon`);
    }
    const clip = s.clip ? polygonMask(s.clip) : null;
    let part = dilate(core, s.dilate ?? 0);
    if (clip) {
      core = and(core, clip);
      part = and(part, clip);
    }
    let owned = and(core, opaque);
    if (s.line !== undefined) {
      owned = rows(owned, s.line);
      part = rows(part, s.line - (s.overlap ?? 0));
    }
    if (!s.keepOnBody) for (let i = 0; i < body.length; i++) if (owned[i]) body[i] = 0;
    out[name] = cut(reference, and(part, opaque));
    if (name === 'eyes-open') out['eyes-closed'] = closedEye(reference, and(core, opaque));
  }
  out.body = cut(reference, body);
  return out;
}

const option = (args: string[], flag: string, fallback: string): string => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

export async function main(args: string[]): Promise<number> {
  const dir = join(ROOT, 'art/source', option(args, '--species', 'cat'), option(args, '--coat', 'orange-tabby'));
  const parts = await cutParts(dir);
  for (const name of PART_NAMES) {
    if (name === 'paw-raised') {
      // A raised paw is not in the standing reference; the generated one is used as it is.
      await sharp(join(dir, 'generated', 'paw-raised.png')).toFile(join(dir, 'paw-raised.png'));
      continue;
    }
    const data = parts[name];
    if (!data) {
      console.error(`${name}: no cut; add it to cut.json`);
      return 1;
    }
    await sharp(data, { raw: { width: CELL, height: CELL, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(join(dir, `${name}.png`));
  }
  console.log(`cut ${PART_NAMES.length} parts in ${dir}`);
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
