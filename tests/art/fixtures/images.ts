import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ART_CELL, POSE_NAMES, PART_NAMES } from '../../../src/render/artNames';

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

/** Art-cell magenta image with a 40 by 40 cat square (outline ring plus fill). */
export async function magentaCat(): Promise<Buffer> {
  const pixels: Rgb[] = [];
  for (let y = 0; y < ART_CELL; y++) {
    for (let x = 0; x < ART_CELL; x++) {
      const inside = x >= 20 && x < 60 && y >= 20 && y < 60;
      const edge = inside && (x === 20 || x === 59 || y === 20 || y === 59);
      pixels.push(edge ? CAT_OUTLINE : inside ? CAT_FILL : MAGENTA);
    }
  }
  return toPng(pixels, ART_CELL);
}

/** 480 by 480 image of square blocks, one per art-cell pixel; block (bx, by) has one of 8 colours chosen by its position. */
export async function blocks480(): Promise<Buffer> {
  const pixels: Rgb[] = [];
  for (let y = 0; y < 480; y++) {
    for (let x = 0; x < 480; x++) {
      const bx = Math.floor(x / (480 / ART_CELL));
      const by = Math.floor(y / (480 / ART_CELL));
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

/** Art-cell image with 40 distinct opaque colours and no magenta. */
export async function fortyColours(): Promise<Buffer> {
  const pixels: Rgb[] = [];
  for (let i = 0; i < ART_CELL * ART_CELL; i++) {
    const k = i % 40;
    pixels.push([k * 6, 255 - k * 6, (k * 37) % 200]);
  }
  return toPng(pixels, ART_CELL);
}

/** Writes a complete source folder of magenta cats, leaving out the named files. */
export async function writeFullSet(dir: string, omit: string[] = []): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const img = await magentaCat();
  for (const name of [...PART_NAMES, ...POSE_NAMES]) {
    if (!omit.includes(name)) writeFileSync(join(dir, `${name}.png`), img);
  }
}
