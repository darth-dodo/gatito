import sharp from 'sharp';
import type { Colour } from '../../src/brain/types';

export type Rgb = [number, number, number];

/** The orange tabby's fur shades, darkest to lightest. */
export const ORANGE_PALETTE: Rgb[] = [
  [168, 90, 28],
  [224, 136, 58],
  [242, 166, 90],
  [246, 220, 174],
  [255, 241, 214],
];

/** Outline, eye and nose colours; these stay the same in every recoloured coat. */
export const KEPT_COLOURS: Rgb[] = [
  [42, 26, 20],
  [63, 163, 77],
  [16, 16, 16],
  [232, 144, 154],
];

/** Fur shades per coat, in the same order as ORANGE_PALETTE. */
export const COAT_PALETTES: Record<'orange-tabby' | 'black' | 'white' | 'grey', Rgb[]> = {
  'orange-tabby': ORANGE_PALETTE,
  black: [
    [14, 14, 18],
    [27, 27, 34],
    [44, 44, 54],
    [60, 60, 72],
    [80, 80, 94],
  ],
  white: [
    [184, 184, 196],
    [216, 216, 224],
    [236, 236, 242],
    [248, 248, 251],
    [255, 255, 255],
  ],
  grey: [
    [78, 81, 89],
    [107, 111, 120],
    [138, 142, 152],
    [180, 183, 191],
    [210, 212, 218],
  ],
};

/** How far a channel may stray from #FF00FF and still count as the magenta background key. */
export const KEY_TOLERANCE = 24;

export function isKey(r: number, g: number, b: number): boolean {
  return Math.abs(r - 255) <= KEY_TOLERANCE && g <= KEY_TOLERANCE && Math.abs(b - 255) <= KEY_TOLERANCE;
}

const DERIVED = ['black', 'white', 'grey'];

function distance(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/**
 * Palette map from the orange tabby to black, white or grey. Each pixel is keyed to its nearest
 * known colour; fur shades are replaced, outline, eye and nose colours are left as they are.
 */
export async function recolour(png: Buffer, from: Colour, to: Colour): Promise<Buffer> {
  if (from !== 'orange-tabby') throw new Error(`Cannot recolour from ${from}; only orange-tabby is supported`);
  const target = DERIVED.includes(to) ? COAT_PALETTES[to as 'black' | 'white' | 'grey'] : undefined;
  if (!target) throw new Error(`Cannot recolour to ${to}; it needs its own art`);

  const known: { colour: Rgb; replacement: Rgb }[] = [
    ...ORANGE_PALETTE.map((colour, i) => ({ colour, replacement: target[i] })),
    ...KEPT_COLOURS.map((colour) => ({ colour, replacement: colour })),
  ];
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cache = new Map<number, Rgb>();
  for (let i = 0; i < data.length; i += 4) {
    // Transparent pixels and the magenta key are left alone; the build removes the key afterwards.
    if (data[i + 3] === 0 || isKey(data[i], data[i + 1], data[i + 2])) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let mapped = cache.get(key);
    if (!mapped) {
      const px: Rgb = [data[i], data[i + 1], data[i + 2]];
      let best = known[0];
      for (const k of known) if (distance(px, k.colour) < distance(px, best.colour)) best = k;
      mapped = best.replacement;
      cache.set(key, mapped);
    }
    data[i] = mapped[0];
    data[i + 1] = mapped[1];
    data[i + 2] = mapped[2];
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}
