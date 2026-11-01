import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { COLOURS, SPECIES, type Colour, type Species } from '../../src/brain/types';
import { ART_CELL, PART_NAMES, POSE_NAMES, WALK_FRAME_NAMES } from '../../src/render/artNames';
import { defringe } from './defringe';
import { PLACEHOLDER_COATS, writePlaceholders } from './placeholder';
import { isKey, KEPT_COLOURS, recolour } from './recolour';

const CELL = ART_CELL;
const COLUMNS = 5;
const MAX_COLOURS = 16;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DERIVED_COATS: readonly Colour[] = ['black', 'white', 'grey'];

interface Rig {
  parts: Record<string, { anchor: [number, number]; z: number; offset: [number, number] }>;
}

function readRig(species: Species): Rig {
  return JSON.parse(readFileSync(join(ROOT, 'art/rig', `${species}.json`), 'utf8')) as Rig;
}

/** The pink of a generated cat's nose, as it comes out of the image model. */
const GENERATED_NOSE: readonly [number, number, number] = [233, 125, 125];
/** Colour distance within which a pixel counts as nose; the pinkest inner-ear pixels sit about 23 away. */
const NOSE_RADIUS = 16;
/** The one nose colour the sheets use, which recolouring keeps in every coat. */
const NOSE = KEPT_COLOURS[3];

/** True for a generated nose pink, or the sheets' own nose colour. */
export function isNosePink(r: number, g: number, b: number): boolean {
  const near = (c: readonly number[]) => Math.hypot(r - c[0], g - c[1], b - c[2]) <= NOSE_RADIUS;
  return near(GENERATED_NOSE) || near(NOSE);
}

/** Removes the magenta key, snaps to the art grid (nearest neighbour) and limits to 16 colours. */
export async function prepare(file: string, name: string): Promise<Buffer> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== info.height) {
    throw new Error(`${name}: image is ${info.width} by ${info.height}, expected a square`);
  }
  for (let i = 0; i < data.length; i += 4) {
    if (isKey(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
  }
  const snapped = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(CELL, CELL, { kernel: 'nearest', fit: 'fill' })
    .raw()
    .toBuffer();
  defringe(snapped, CELL, CELL);
  // The nose is only a pixel or three at this size, too few to earn a palette slot, so the colour limit
  // would merge it into the fur. It is painted back afterwards in the one nose colour.
  const nose: number[] = [];
  for (let i = 0; i < snapped.length; i += 4) {
    if (snapped[i + 3] > 0 && isNosePink(snapped[i], snapped[i + 1], snapped[i + 2])) nose.push(i);
  }
  // Art that already fits (a cut part, nose aside) is not quantised again, which could merge its colours.
  const out = fitsPalette(snapped, nose)
    ? clearTransparent(snapped)
    : await sharp(
        await sharp(snapped, { raw: { width: CELL, height: CELL, channels: 4 } })
          .png({ palette: true, colours: MAX_COLOURS, dither: 0 })
          .toBuffer(),
      )
        .ensureAlpha()
        .raw()
        .toBuffer();
  for (const i of nose) out.set(NOSE, i);
  return out;
}

/** Zeroes the colour of fully transparent pixels in place, as the quantiser does, and returns the buffer. */
function clearTransparent(data: Buffer): Buffer {
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data.fill(0, i, i + 4);
  return data;
}

/** True when the image, leaving out the given nose pixels, has at most MAX_COLOURS colours (transparent counts). */
function fitsPalette(data: Buffer, nose: readonly number[]): boolean {
  const skip = new Set(nose);
  const colours = new Set<number>();
  for (let i = 0; i < data.length; i += 4) {
    if (skip.has(i)) continue;
    colours.add(data[i + 3] === 0 ? -1 : ((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) * 256 + data[i + 3]);
    if (colours.size > MAX_COLOURS) return false;
  }
  return true;
}

export async function buildAtlas(
  species: Species,
  coat: Colour,
  srcDir: string,
  outDir: string,
): Promise<{ missing: string[] }> {
  const has = (n: string) => existsSync(join(srcDir, `${n}.png`));
  // The walk frames are optional, but all six or none.
  const walk = WALK_FRAME_NAMES.some(has) ? [...WALK_FRAME_NAMES] : [];
  const names = [...PART_NAMES, ...POSE_NAMES, ...walk] as string[];
  const missing = names.filter((n) => !has(n));
  if (missing.length > 0) return { missing };

  const rig = readRig(species);
  const rows = Math.ceil(names.length / COLUMNS);
  const width = COLUMNS * CELL;
  const height = rows * CELL;
  const sheet = Buffer.alloc(width * height * 4);
  const frames: Record<string, unknown> = {};

  for (const [index, name] of names.entries()) {
    const cell = await prepare(join(srcDir, `${name}.png`), name);
    const x = (index % COLUMNS) * CELL;
    const y = Math.floor(index / COLUMNS) * CELL;
    for (let row = 0; row < CELL; row++) {
      cell.copy(sheet, ((y + row) * width + x) * 4, row * CELL * 4, (row + 1) * CELL * 4);
    }
    const part = rig.parts[name];
    frames[name] = {
      frame: { x, y, w: CELL, h: CELL },
      sourceSize: { w: CELL, h: CELL },
      spriteSourceSize: { x: 0, y: 0, w: CELL, h: CELL },
      ...(part ? { anchor: { x: part.anchor[0], y: part.anchor[1] } } : {}),
    };
  }

  const image = `${species}-${coat}.png`;
  mkdirSync(outDir, { recursive: true });
  await sharp(sheet, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, image));
  const atlas = {
    frames,
    meta: { image, format: 'RGBA8888', size: { w: width, h: height }, scale: '1' },
  };
  writeFileSync(join(outDir, `${species}-${coat}.json`), `${JSON.stringify(atlas, null, 2)}\n`);
  return { missing: [] };
}

function option(args: string[], flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : fallback;
}

export async function main(args: string[]): Promise<number> {
  const src = option(args, '--src', join(ROOT, 'art/source'));
  const out = option(args, '--out', join(ROOT, 'src/assets/atlas'));
  const placeholders = args.includes('--placeholders');
  const failures: string[] = [];
  const temp = mkdtempSync(join(tmpdir(), 'windowsill-art-'));

  try {
    for (const species of SPECIES.filter((s) => existsSync(join(ROOT, 'art/rig', `${s}.json`)))) {
      const tabbyDir = join(src, species, 'orange-tabby');
      for (const coat of COLOURS) {
        const label = `${species}/${coat}`;
        let dir = join(src, species, coat);
        if (!existsSync(dir)) {
          const scratch = join(temp, `${species}-${coat}`);
          if (DERIVED_COATS.includes(coat) && existsSync(tabbyDir)) {
            mkdirSync(scratch, { recursive: true });
            for (const n of [...PART_NAMES, ...POSE_NAMES, ...WALK_FRAME_NAMES]) {
              const file = join(tabbyDir, `${n}.png`);
              if (existsSync(file)) {
                writeFileSync(join(scratch, `${n}.png`), await recolour(readFileSync(file), 'orange-tabby', coat));
              }
            }
            console.log(`${label}: recoloured from orange-tabby`);
          } else if (placeholders && (PLACEHOLDER_COATS as readonly Colour[]).includes(coat)) {
            await writePlaceholders(species, coat, scratch);
            console.log(`${label}: placeholders`);
          } else {
            console.log(`${label}: skipped (no art)`);
            continue;
          }
          dir = scratch;
        } else {
          console.log(`${label}: built from ${dir}`);
        }
        try {
          const { missing } = await buildAtlas(species, coat, dir, out);
          if (missing.length > 0) failures.push(`${label}: missing ${missing.join(', ')}`);
        } catch (e) {
          failures.push(`${label}: ${(e as Error).message}`);
        }
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  for (const f of failures) console.error(f);
  return failures.length > 0 ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
