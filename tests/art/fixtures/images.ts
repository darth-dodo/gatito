import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { POSE_NAMES, PART_NAMES } from '../../../src/render/artNames';

export type Rgb = [number, number, number];

export const MAGENTA: Rgb = [255, 0, 255];
export const CAT_FILL: Rgb = [200, 120, 40];
export const CAT_OUTLINE: Rgb = [30, 20, 15];

export async function toPng(pixels: Rgb[], size: number): Promise<Buffer> {
  const raw = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) raw.set(pixels[i % pixels.length], i * 3);
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
}

/** 48 by 48 magenta image with a 20 by 20 cat square (outline ring plus fill). */
export async function magentaCat(): Promise<Buffer> {
  const pixels: Rgb[] = [];
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const inside = x >= 10 && x < 30 && y >= 10 && y < 30;
      const edge = inside && (x === 10 || x === 29 || y === 10 || y === 29);
      pixels.push(edge ? CAT_OUTLINE : inside ? CAT_FILL : MAGENTA);
    }
  }
  return toPng(pixels, 48);
}

/** 480 by 480 image of 10 by 10 blocks; block (bx, by) has one of 8 colours chosen by its position. */
export async function blocks480(): Promise<Buffer> {
  const pixels: Rgb[] = [];
  for (let y = 0; y < 480; y++) {
    for (let x = 0; x < 480; x++) {
      const bx = Math.floor(x / 10);
      const by = Math.floor(y / 10);
      pixels.push(blockColour(bx, by));
    }
  }
  return toPng(pixels, 480);
}

const BLOCK_PALETTE: Rgb[] = [
  [10, 10, 40],
  [200, 30, 30],
  [30, 160, 60],
  [240, 220, 40],
  [40, 120, 220],
  [120, 70, 20],
  [250, 250, 250],
  [90, 90, 90],
];

export function blockColour(bx: number, by: number): Rgb {
  return BLOCK_PALETTE[(bx + 3 * by) % BLOCK_PALETTE.length];
}

/** 48 by 48 image with 40 distinct opaque colours and no magenta. */
export async function fortyColours(): Promise<Buffer> {
  const pixels: Rgb[] = [];
  for (let i = 0; i < 48 * 48; i++) {
    const k = i % 40;
    pixels.push([k * 6, 255 - k * 6, (k * 37) % 200]);
  }
  return toPng(pixels, 48);
}

/** Writes a complete source folder of magenta cats, leaving out the named files. */
export async function writeFullSet(dir: string, omit: string[] = []): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const img = await magentaCat();
  for (const name of [...PART_NAMES, ...POSE_NAMES]) {
    if (!omit.includes(name)) writeFileSync(join(dir, `${name}.png`), img);
  }
}
