import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Colour, Species } from '../../src/brain/types';
import { ART_CELL, PART_NAMES, POSE_NAMES } from '../../src/render/artNames';
import { BASE_COAT, COAT_PALETTES, DERIVED_COATS, KEPT_COLOURS, type Rgb } from './recolour';

/** Placeholders are designed on a 48 grid and scaled up 2x (nearest neighbour) into the art cell. */
const SIZE = 48;
const MAGENTA: Rgb = [255, 0, 255];
const [OUTLINE, EYE, DARK, NOSE] = KEPT_COLOURS;

/** Placeholder coats per species: the base coat and the palette-mapped coats made from it. */
export const PLACEHOLDER_COATS: { readonly [S in Species]: readonly Colour[] } = {
  cat: [BASE_COAT.cat, ...DERIVED_COATS.cat],
  dog: [BASE_COAT.dog, ...DERIVED_COATS.dog],
};

interface Ink {
  dark: Rgb;
  mid: Rgb;
  light: Rgb;
  cream: Rgb;
}

/** A tiny aliasing-free canvas: every shape is tested per pixel centre, so edges stay crisp. */
class Canvas {
  private px: Rgb[] = Array.from({ length: SIZE * SIZE }, () => MAGENTA);

  private each(fn: (x: number, y: number) => boolean, colour: Rgb): void {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) if (fn(x + 0.5, y + 0.5)) this.px[y * SIZE + x] = colour;
    }
  }

  rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    this.each((px, py) => px >= x && px < x + w && py >= y && py < y + h, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Rgb): void {
    this.each((px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, c);
  }

  poly(points: [number, number][], c: Rgb): void {
    this.each((px, py) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, c);
  }

  /** A thick line through the points, for tails and limbs. */
  stroke(points: [number, number][], r: number, c: Rgb): void {
    this.each((px, py) => {
      for (let i = 0; i < points.length - 1; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[i + 1];
        const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
        if ((px - (ax + t * (bx - ax))) ** 2 + (py - (ay + t * (by - ay))) ** 2 <= r * r) return true;
      }
      return false;
    }, c);
  }

  /** One pixel outline around everything drawn so far. */
  outline(): void {
    const filled = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < SIZE && y < SIZE && this.px[y * SIZE + x] !== MAGENTA;
    const next = [...this.px];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.px[y * SIZE + x] === MAGENTA && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) {
          next[y * SIZE + x] = OUTLINE;
        }
      }
    }
    this.px = next;
  }

  async toPng(): Promise<Buffer> {
    const raw = Buffer.alloc(SIZE * SIZE * 3);
    this.px.forEach((p, i) => raw.set(p, i * 3));
    return sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .resize(ART_CELL, ART_CELL, { kernel: 'nearest' })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
}

type Draw = (c: Canvas, ink: Ink) => void;
type Drawings = Record<(typeof PART_NAMES)[number] | (typeof POSE_NAMES)[number], Draw>;

const eyesOpen = (c: Canvas, x = 37, y = 17): void => {
  c.rect(x, y, 2, 3, EYE);
  c.rect(x + 4, y, 2, 3, EYE);
};
const eyesClosed = (c: Canvas, x = 37, y = 19): void => {
  c.rect(x, y, 3, 1, OUTLINE);
  c.rect(x + 4, y, 3, 1, OUTLINE);
};
const ear = (c: Canvas, x: number, tipY: number, w: number, fill: Rgb, inner: Rgb): void => {
  c.poly([[x, tipY + 7], [x + w / 2, tipY], [x + w, tipY + 7]], fill);
  c.poly([[x + 1.5, tipY + 7], [x + w / 2, tipY + 3], [x + w - 1.5, tipY + 7]], inner);
};
const head = (c: Canvas, ink: Ink, cx: number, cy: number, r: number): void => {
  c.ellipse(cx, cy, r, r - 1, ink.mid);
  c.ellipse(cx + r - 3, cy + 3, 3, 2, ink.cream);
  c.rect(cx + r - 1, cy + 1, 2, 1, NOSE);
};
const stripes = (c: Canvas, ink: Ink, xs: number[], y: number, h: number): void => {
  for (const x of xs) c.rect(x, y, 1, h, ink.dark);
};

const CAT_PARTS: Record<(typeof PART_NAMES)[number], Draw> = {
  body: (c, ink) => {
    c.ellipse(22, 28, 13, 8, ink.mid);
    c.ellipse(22, 33, 9, 3, ink.cream);
    stripes(c, ink, [15, 20, 25, 30], 21, 4);
  },
  head: (c, ink) => head(c, ink, 36, 19, 8),
  'ear-near': (c, ink) => ear(c, 32, 6, 7, ink.mid, ink.light),
  'ear-far': (c, ink) => ear(c, 39, 6, 6, ink.dark, ink.mid),
  'eyes-open': (c) => eyesOpen(c),
  'eyes-closed': (c) => eyesClosed(c),
  tail: (c, ink) => {
    c.stroke([[10, 28], [6, 26], [4, 21], [5, 15], [8, 11]], 1.6, ink.mid);
    c.stroke([[5, 15], [8, 11]], 1.6, ink.dark);
  },
  'leg-front-near': (c, ink) => {
    c.rect(28, 32, 4, 12, ink.mid);
    c.rect(28, 42, 4, 2, ink.cream);
  },
  'leg-front-far': (c, ink) => {
    c.rect(33, 32, 4, 12, ink.dark);
    c.rect(33, 42, 4, 2, ink.light);
  },
  'leg-back-near': (c, ink) => {
    c.rect(10, 32, 4, 12, ink.mid);
    c.rect(10, 42, 4, 2, ink.cream);
  },
  'leg-back-far': (c, ink) => {
    c.rect(15, 32, 4, 12, ink.dark);
    c.rect(15, 42, 4, 2, ink.light);
  },
  'paw-raised': (c, ink) => {
    c.stroke([[34, 30], [41, 24]], 2, ink.mid);
    c.ellipse(42, 23, 2.5, 2.5, ink.cream);
  },
};

const CAT_POSES: Record<(typeof POSE_NAMES)[number], Draw> = {
  sit: (c, ink) => {
    c.ellipse(20, 36, 8, 8, ink.mid);
    c.ellipse(24, 30, 8, 12, ink.mid);
    c.ellipse(25, 33, 4, 8, ink.cream);
    c.rect(28, 36, 4, 8, ink.mid);
    c.rect(28, 42, 4, 2, ink.cream);
    c.rect(12, 41, 12, 3, ink.dark);
    // No ears or eyes: the rig layers those parts on sit so ears follow mood and the cat blinks.
    head(c, ink, 29, 15, 8);
  },
  loaf: (c, ink) => {
    c.ellipse(22, 36, 15, 8, ink.mid);
    stripes(c, ink, [12, 17, 22, 27], 29, 4);
    ear(c, 30, 20, 6, ink.mid, ink.light);
    ear(c, 36, 20, 6, ink.dark, ink.mid);
    head(c, ink, 36, 32, 7);
    eyesOpen(c, 32, 29);
    c.rect(36, 41, 7, 3, ink.cream);
  },
  'sleep-curl': (c, ink) => {
    c.ellipse(25, 34, 18, 11, ink.mid);
    c.ellipse(26, 40, 12, 4, ink.cream);
    stripes(c, ink, [14, 20, 26, 32], 25, 5);
    ear(c, 6, 25, 5, ink.mid, ink.light);
    ear(c, 11, 25, 5, ink.dark, ink.mid);
    head(c, ink, 12, 36, 6);
    eyesClosed(c, 8, 35);
  },
  'belly-up': (c, ink) => {
    c.ellipse(24, 35, 15, 7, ink.mid);
    c.ellipse(24, 33, 11, 4, ink.cream);
    for (const x of [12, 18, 28, 34]) c.rect(x, 17, 3, 12, ink.mid);
    for (const x of [12, 18, 28, 34]) c.rect(x, 16, 3, 2, ink.cream);
    ear(c, 35, 21, 6, ink.mid, ink.light);
    head(c, ink, 40, 36, 7);
    eyesOpen(c, 38, 33);
  },
  stretch: (c, ink) => {
    c.poly([[6, 22], [34, 33], [34, 41], [6, 33]], ink.mid);
    c.rect(6, 22, 4, 22, ink.dark);
    c.rect(30, 40, 14, 4, ink.mid);
    c.rect(41, 40, 3, 4, ink.cream);
    ear(c, 34, 22, 6, ink.mid, ink.light);
    head(c, ink, 40, 34, 7);
    eyesOpen(c, 37, 31);
  },
  groom: (c, ink) => {
    c.ellipse(20, 36, 8, 8, ink.mid);
    c.ellipse(24, 30, 8, 12, ink.mid);
    c.ellipse(25, 33, 4, 8, ink.cream);
    c.rect(12, 41, 12, 3, ink.dark);
    ear(c, 24, 4, 6, ink.mid, ink.light);
    head(c, ink, 29, 15, 8);
    eyesClosed(c, 30, 14);
    c.stroke([[30, 30], [35, 20]], 2, ink.light);
    c.ellipse(35, 19, 2.5, 2.5, ink.cream);
  },
  'sit-up': (c, ink) => {
    c.ellipse(20, 38, 9, 7, ink.mid);
    c.ellipse(22, 28, 7, 13, ink.mid);
    c.ellipse(23, 30, 4, 9, ink.cream);
    c.rect(10, 41, 14, 3, ink.dark);
    c.stroke([[26, 24], [31, 19]], 2, ink.mid);
    c.stroke([[26, 28], [32, 23]], 2, ink.dark);
    ear(c, 17, 1, 6, ink.mid, ink.light);
    ear(c, 23, 1, 6, ink.dark, ink.mid);
    head(c, ink, 24, 11, 8);
    eyesOpen(c, 25, 8);
  },
  dangle: (c, ink) => {
    c.ellipse(24, 26, 7, 14, ink.mid);
    c.ellipse(25, 28, 3, 9, ink.cream);
    c.rect(18, 36, 4, 10, ink.mid);
    c.rect(26, 36, 4, 10, ink.dark);
    c.rect(18, 44, 4, 2, ink.cream);
    c.rect(26, 44, 4, 2, ink.light);
    ear(c, 21, 0, 5, ink.mid, ink.light);
    ear(c, 26, 0, 5, ink.dark, ink.mid);
    head(c, ink, 26, 9, 6);
    eyesOpen(c, 25, 7);
  },
};

// Dogs: floppy ears, a muzzle, black button eyes and nose. Every part is drawn in place in the
// standing dog; the pivots in art/rig/dog.json are these drawings' points (times 2, for the cell).

const dogEyes = (c: Canvas, x: number, y: number): void => c.rect(x, y, 2, 2, DARK);
const dogEyesShut = (c: Canvas, x: number, y: number): void => c.rect(x, y, 3, 1, OUTLINE);
/** A floppy ear hanging from its root at (x, y). */
const floppyEar = (c: Canvas, x: number, y: number, len: number, fill: Rgb): void =>
  c.poly([[x - 2, y], [x + 2, y], [x + 2, y + len], [x, y + len + 1], [x - 2, y + len - 1]], fill);
/** A right-facing head with a muzzle and nose, without ears or eyes. */
const dogHead = (c: Canvas, ink: Ink, cx: number, cy: number, r: number): void => {
  c.ellipse(cx, cy, r, r - 1, ink.mid);
  c.ellipse(cx + r - 1, cy + 2, 3.5, 2.5, ink.light);
  c.rect(cx + r + 1, cy, 2, 2, DARK);
};
const dogSitBody = (c: Canvas, ink: Ink, hx: number): void => {
  c.ellipse(hx, 37, 9, 7, ink.mid);
  c.ellipse(hx + 6, 29, 7, 11, ink.mid);
  c.ellipse(hx + 9, 31, 3, 7, ink.cream);
  c.rect(28, 34, 4, 10, ink.mid);
  c.rect(28, 42, 5, 2, ink.cream);
};

const DOG: Drawings = {
  body: (c, ink) => {
    c.poly([[28, 22], [34, 18], [37, 25], [31, 29]], ink.mid);
    c.ellipse(22, 28, 14, 8, ink.mid);
    c.ellipse(20, 22, 9, 2.5, ink.dark);
    c.ellipse(24, 33, 9, 3, ink.cream);
    // Like the cut-out cat, the body image carries the head; the head part is only kept for other rigs.
    dogHead(c, ink, 36, 19, 6);
  },
  head: (c, ink) => dogHead(c, ink, 36, 19, 6),
  'ear-near': (c, ink) => floppyEar(c, 34, 14, 9, ink.dark),
  'ear-far': (c, ink) => floppyEar(c, 38, 13, 5, ink.dark),
  'eyes-open': (c) => dogEyes(c, 39, 17),
  'eyes-closed': (c) => dogEyesShut(c, 39, 18),
  tail: (c, ink) => {
    c.stroke([[9, 25], [6, 21], [5, 16], [7, 12]], 1.8, ink.mid);
    c.stroke([[5.5, 14], [7, 12]], 1.8, ink.light);
  },
  'leg-front-near': (c, ink) => {
    c.rect(29, 32, 4, 12, ink.mid);
    c.rect(29, 42, 5, 2, ink.cream);
  },
  'leg-front-far': (c, ink) => {
    c.rect(33, 32, 4, 12, ink.dark);
    c.rect(33, 42, 5, 2, ink.light);
  },
  'leg-back-near': (c, ink) => {
    c.rect(11, 32, 5, 12, ink.mid);
    c.rect(11, 42, 6, 2, ink.cream);
  },
  'leg-back-far': (c, ink) => {
    c.rect(16, 32, 4, 12, ink.dark);
    c.rect(16, 42, 5, 2, ink.light);
  },
  'paw-raised': (c, ink) => {
    c.stroke([[31, 30], [39, 23]], 2, ink.mid);
    c.ellipse(40, 22, 2.5, 2.5, ink.cream);
  },
  // No ears or eyes: the rig layers those parts on sit so ears follow mood and the dog blinks.
  sit: (c, ink) => {
    dogSitBody(c, ink, 19);
    c.rect(11, 41, 13, 3, ink.dark);
    dogHead(c, ink, 29, 14, 6);
  },
  // Curl nap: a tight ring, nose tucked in at the back where the layered tail drapes over it.
  loaf: (c, ink) => {
    c.ellipse(25, 36, 16, 9, ink.mid);
    c.ellipse(34, 34, 5, 4, ink.light);
    c.ellipse(27, 41, 10, 3, ink.cream);
    c.ellipse(12, 38, 6, 5, ink.mid);
    c.ellipse(7, 40, 3, 2.5, ink.light);
    c.rect(4, 39, 2, 2, DARK);
    floppyEar(c, 14, 33, 6, ink.dark);
    dogEyesShut(c, 9, 37);
  },
  // Nap: lying down, chin on the front paws.
  'sleep-curl': (c, ink) => {
    c.ellipse(21, 37, 15, 7, ink.mid);
    c.ellipse(12, 36, 6, 5, ink.light);
    c.ellipse(22, 41, 10, 2, ink.cream);
    c.rect(31, 41, 13, 3, ink.mid);
    c.rect(42, 41, 3, 3, ink.cream);
    c.ellipse(36, 35, 6, 5, ink.mid);
    c.ellipse(41, 37, 3.5, 2.5, ink.light);
    c.rect(43, 35, 2, 2, DARK);
    floppyEar(c, 34, 31, 7, ink.dark);
    dogEyesShut(c, 37, 34);
  },
  'belly-up': (c, ink) => {
    c.ellipse(24, 35, 15, 7, ink.mid);
    c.ellipse(24, 32, 11, 4, ink.cream);
    for (const x of [12, 18, 28, 34]) c.rect(x, 18, 3, 12, ink.mid);
    for (const x of [12, 18, 28, 34]) c.rect(x, 17, 3, 2, ink.cream);
    c.ellipse(39, 36, 6, 5, ink.mid);
    c.ellipse(43, 38, 3, 2.5, ink.light);
    c.rect(44, 39, 2, 2, DARK);
    floppyEar(c, 37, 39, 5, ink.dark);
    dogEyes(c, 39, 34);
  },
  // Stretch: a play bow, front down and rear up.
  stretch: (c, ink) => {
    c.poly([[7, 22], [33, 32], [33, 40], [7, 31]], ink.mid);
    c.rect(7, 22, 5, 22, ink.dark);
    c.rect(6, 42, 6, 2, ink.light);
    c.rect(29, 40, 15, 4, ink.mid);
    c.rect(42, 40, 3, 4, ink.cream);
    dogHead(c, ink, 38, 33, 6);
    floppyEar(c, 36, 29, 6, ink.dark);
    dogEyes(c, 40, 31);
  },
  // Groom: a dog scratches behind its ear with a hind leg, eyes shut in bliss.
  groom: (c, ink) => {
    dogSitBody(c, ink, 18);
    dogHead(c, ink, 29, 14, 6);
    floppyEar(c, 27, 9, 7, ink.dark);
    c.stroke([[17, 36], [20, 27], [24, 20]], 2.2, ink.dark);
    c.ellipse(25, 19, 2.5, 2.5, ink.light);
    dogEyesShut(c, 31, 13);
  },
  // Sit up: begging, front paws held up.
  'sit-up': (c, ink) => {
    c.ellipse(20, 38, 9, 7, ink.mid);
    c.ellipse(22, 27, 7, 13, ink.mid);
    c.ellipse(24, 29, 3, 9, ink.cream);
    c.rect(10, 41, 14, 3, ink.dark);
    c.stroke([[26, 23], [31, 19]], 2, ink.mid);
    c.stroke([[26, 27], [32, 23]], 2, ink.dark);
    dogHead(c, ink, 24, 11, 6);
    floppyEar(c, 22, 6, 7, ink.dark);
    dogEyes(c, 26, 9);
  },
  dangle: (c, ink) => {
    c.ellipse(24, 27, 7, 14, ink.mid);
    c.ellipse(26, 29, 3, 9, ink.cream);
    c.rect(18, 36, 4, 10, ink.mid);
    c.rect(26, 36, 4, 10, ink.dark);
    c.rect(18, 44, 4, 2, ink.cream);
    c.rect(26, 44, 4, 2, ink.light);
    dogHead(c, ink, 26, 9, 6);
    floppyEar(c, 23, 5, 6, ink.dark);
    dogEyes(c, 27, 7);
  },
};

const DRAWINGS: { readonly [S in Species]: Drawings } = {
  cat: { ...CAT_PARTS, ...CAT_POSES },
  dog: DOG,
};

function inkFor(coat: Colour): Ink {
  const palette = coat in COAT_PALETTES ? COAT_PALETTES[coat as keyof typeof COAT_PALETTES] : undefined;
  if (!palette) throw new Error(`No placeholder palette for coat ${coat}`);
  return { dark: palette[0], mid: palette[1], light: palette[2], cream: palette[3] };
}

/** Writes one magenta-background art-cell PNG per part and pose into `dir`, for the species, in the coat's colours. */
export async function writePlaceholders(species: Species, coat: Colour, dir: string): Promise<void> {
  const ink = inkFor(coat);
  mkdirSync(dir, { recursive: true });
  const all = DRAWINGS[species];
  for (const name of [...PART_NAMES, ...POSE_NAMES]) {
    const canvas = new Canvas();
    all[name](canvas, ink);
    canvas.outline();
    writeFileSync(join(dir, `${name}.png`), await canvas.toPng());
  }
}
