import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Colour, Species } from '../../src/brain/types';
import { PART_NAMES, POSE_NAMES } from '../../src/render/artNames';
import { COAT_PALETTES, KEPT_COLOURS, type Rgb } from './recolour';

const SIZE = 48;
const MAGENTA: Rgb = [255, 0, 255];
const [OUTLINE, EYE, , NOSE] = KEPT_COLOURS;

/** Placeholder coats: the orange tabby and the three palette-mapped coats. */
export const PLACEHOLDER_COATS = ['orange-tabby', 'black', 'white', 'grey'] as const;

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
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
}

type Draw = (c: Canvas, ink: Ink) => void;

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

const PARTS: Record<(typeof PART_NAMES)[number], Draw> = {
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

const POSES: Record<(typeof POSE_NAMES)[number], Draw> = {
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

function inkFor(coat: Colour): Ink {
  const palette = coat in COAT_PALETTES ? COAT_PALETTES[coat as keyof typeof COAT_PALETTES] : undefined;
  if (!palette) throw new Error(`No placeholder palette for coat ${coat}`);
  return { dark: palette[0], mid: palette[1], light: palette[2], cream: palette[3] };
}

/** Writes one magenta-background 48 by 48 PNG per part and pose into `dir`, in the coat's colours. */
export async function writePlaceholders(_species: Species, coat: Colour, dir: string): Promise<void> {
  const ink = inkFor(coat);
  mkdirSync(dir, { recursive: true });
  const all: Record<string, Draw> = { ...PARTS, ...POSES };
  for (const name of [...PART_NAMES, ...POSE_NAMES]) {
    const canvas = new Canvas();
    all[name](canvas, ink);
    canvas.outline();
    writeFileSync(join(dir, `${name}.png`), await canvas.toPng());
  }
}
