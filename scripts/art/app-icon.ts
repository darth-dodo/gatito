import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

/**
 * Turns the GenAI app icon art (a rounded tile on a white background) into the 1024 px master that
 * `tauri icon` slices into every bundle size. The tile is cropped, any white left in its corners takes
 * the nearest art colour in its row, and the result is masked to the macOS icon grid: an 824 px rounded
 * square, centred, with transparent padding so it sits at the same size as other Dock icons.
 */

const CANVAS = 1024;
const TILE = 824;
/** Apple's macOS icon grid corner radius for an 824 px tile. */
const RADIUS = 185;
/** A pixel whose darkest channel is at least this bright counts as the white background. */
const WHITE = 230;

const isWhite = (data: Buffer, i: number) => Math.min(data[i], data[i + 1], data[i + 2]) >= WHITE;

/** Bounding box of the non-white tile in an RGB(A) image. */
export function tileBounds(data: Buffer, width: number, height: number, channels: number) {
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWhite(data, (y * width + x) * channels)) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('app icon source is blank');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Replaces white pixels in place with the nearest non-white pixel in the same row. */
export function fillWhiteFromRow(data: Buffer, width: number, height: number, channels: number): void {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = (row + x) * channels;
      if (!isWhite(data, i)) continue;
      for (let d = 1; d < width; d++) {
        const src = [x - d, x + d].find((sx) => sx >= 0 && sx < width && !isWhite(data, (row + sx) * channels));
        if (src === undefined) continue;
        data.copy(data, i, (row + src) * channels, (row + src) * channels + channels);
        break;
      }
    }
  }
}

export async function buildAppIcon(sourcePath: string, outPath: string): Promise<void> {
  const { data, info } = await sharp(sourcePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = tileBounds(data, info.width, info.height, info.channels);
  const crop = await sharp(data, { raw: info }).extract(box).raw().toBuffer();
  fillWhiteFromRow(crop, box.width, box.height, info.channels);

  const mask = Buffer.from(
    `<svg width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`,
  );
  const tile = await sharp(crop, { raw: { width: box.width, height: box.height, channels: info.channels } })
    .resize(TILE, TILE, { kernel: 'lanczos3' })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const offset = (CANVAS - TILE) / 2;
  await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const out = join(ROOT, 'src-tauri/icons/app-icon.png');
  await buildAppIcon(join(ROOT, 'art/source/app-icon/source.png'), out);
  console.log(`wrote ${out}`);
}
