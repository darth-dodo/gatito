import sharp from 'sharp';
import type { Colour, Species } from '../../src/brain/types';

export type Rgb = [number, number, number];

/** The orange tabby's fur shades, darkest to lightest. */
export const ORANGE_PALETTE: Rgb[] = [
  [168, 90, 28],
  [224, 136, 58],
  [242, 166, 90],
  [246, 220, 174],
  [255, 241, 214],
];

/** The golden dog's fur shades, darkest to lightest. */
export const GOLDEN_PALETTE: Rgb[] = [
  [144, 92, 7],
  [183, 125, 8],
  [215, 155, 20],
  [244, 189, 43],
  [246, 206, 79],
];

/** Each species' full art set is drawn in this coat; the derived coats are recoloured from it. */
export const BASE_COAT = { cat: 'orange-tabby', dog: 'golden' } as const satisfies Record<Species, Colour>;

/** Plain coats made by palette mapping the base coat. Patterned coats need their own art. */
export const DERIVED_COATS = {
  cat: ['black', 'white', 'grey'],
  dog: ['black', 'white', 'brown'],
} as const satisfies Record<Species, readonly Colour[]>;

type BaseCoat = (typeof BASE_COAT)[Species];
type PaletteCoat = BaseCoat | (typeof DERIVED_COATS)[Species][number];

/** Outline, eye and nose colours; these stay the same in every recoloured coat. */
export const KEPT_COLOURS: Rgb[] = [
  [42, 26, 20],
  [63, 163, 77],
  [16, 16, 16],
  [232, 144, 154],
];

/** Fur shades per coat, darkest to lightest, in the same order as the base palettes. */
export const COAT_PALETTES: Record<PaletteCoat, Rgb[]> = {
  'orange-tabby': ORANGE_PALETTE,
  golden: GOLDEN_PALETTE,
  brown: [
    [74, 44, 24],
    [110, 68, 38],
    [140, 92, 54],
    [176, 132, 90],
    [206, 170, 130],
  ],
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

/** The species whose base coat this is, if it is one. */
const baseOf = (c: Colour): Species | undefined =>
  (Object.keys(BASE_COAT) as Species[]).find((s) => BASE_COAT[s] === c);

function distance(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/**
 * Palette map from a species' base coat (orange tabby or golden) to one of its plain coats.
 * Each pixel is keyed to its nearest known colour; fur shades are replaced, outline, eye and nose
 * colours are left as they are.
 */
export async function recolour(png: Buffer, from: Colour, to: Colour): Promise<Buffer> {
  const species = baseOf(from);
  if (!species) throw new Error(`Cannot recolour from ${from}; only orange-tabby and golden are supported`);
  const derived: readonly Colour[] = DERIVED_COATS[species];
  if (!derived.includes(to)) throw new Error(`Cannot recolour a ${species} to ${to}; it needs its own art`);
  const source = COAT_PALETTES[from as BaseCoat];
  const target = COAT_PALETTES[to as PaletteCoat];

  const known: { colour: Rgb; replacement: Rgb }[] = [
    ...source.map((colour, i) => ({ colour, replacement: target[i] })),
    ...KEPT_COLOURS.map((colour) => ({ colour, replacement: colour })),
    // Edge pixels blended with the magenta background become the key, so the build keys them out,
    // instead of mapping them to a kept colour (they used to turn nose pink).
    { colour: [255, 0, 255], replacement: [255, 0, 255] },
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
