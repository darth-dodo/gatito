/**
 * True for a colour that is magenta or a strong blend of magenta with the art: r and b both well above g,
 * and g well below the lower of r and b. A saturated rose such as (220, 90, 150) is real art and passes.
 */
export function isMagentaTinted(r: number, g: number, b: number): boolean {
  return r - g > 40 && b - g > 40 && g < 0.45 * Math.min(r, b);
}

/**
 * True for a light magenta blend: r and b both at least 30 above g. On its own this also matches interior
 * pinks (a rose, an inner ear), so defringe only clears it near the keyed background; see HALO_RADIUS.
 */
export function isLightMagenta(r: number, g: number, b: number): boolean {
  return r - g >= 30 && b - g >= 30;
}

const SEARCH_RADIUS = 3;
/** A light magenta pixel this close (in pixels, any direction) to a transparent one is halo, not art. */
const HALO_RADIUS = 2;

/**
 * Cleans the keyed, snapped RGBA image in place. First the light magenta halo next to the keyed background
 * goes transparent. Then magenta-tinted opaque pixels take the colour of the nearest untinted opaque
 * neighbour (or go transparent when there is none), and isolated opaque specks are dropped.
 */
export function defringe(data: Buffer, width: number, height: number): void {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  clearHalo(data, width, height);
  const tinted = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      if (data[i + 3] > 0 && isMagentaTinted(data[i], data[i + 1], data[i + 2])) tinted[y * width + x] = 1;
    }
  }
  const clean = (x: number, y: number) =>
    inside(x, y) && data[at(x, y) + 3] > 0 && tinted[y * width + x] === 0;

  const fixes: [number, number, number, number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!tinted[y * width + x]) continue;
      let found: number | null = null;
      for (let r = 1; r <= SEARCH_RADIUS && found === null; r++) {
        let best = Infinity;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !clean(x + dx, y + dy)) continue;
            const d = dx * dx + dy * dy;
            if (d < best) {
              best = d;
              found = at(x + dx, y + dy);
            }
          }
        }
      }
      fixes.push(found === null ? [x, y, 0, 0, -1] : [x, y, data[found], data[found + 1], data[found + 2]]);
    }
  }
  for (const [x, y, r, g, b] of fixes) {
    const i = at(x, y);
    if (b < 0) data[i + 3] = 0;
    else {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  const specks: number[] = [];
  const opaque = (x: number, y: number) => inside(x, y) && data[at(x, y) + 3] > 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      let lonely = true;
      for (let dy = -1; dy <= 1 && lonely; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx !== 0 || dy !== 0) && opaque(x + dx, y + dy)) {
            lonely = false;
            break;
          }
        }
      }
      if (lonely) specks.push(at(x, y));
    }
  }
  for (const i of specks) data[i + 3] = 0;
}

/** Light magenta pixels within HALO_RADIUS of a transparent pixel go transparent; interior pinks stay. */
function clearHalo(data: Buffer, width: number, height: number): void {
  const transparent = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height || data[(y * width + x) * 4 + 3] === 0;
  const halo: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0 || !isLightMagenta(data[i], data[i + 1], data[i + 2])) continue;
      let near = false;
      for (let dy = -HALO_RADIUS; dy <= HALO_RADIUS && !near; dy++) {
        for (let dx = -HALO_RADIUS; dx <= HALO_RADIUS; dx++) {
          if (transparent(x + dx, y + dy)) {
            near = true;
            break;
          }
        }
      }
      if (near) halo.push(i);
    }
  }
  for (const i of halo) data[i + 3] = 0;
}
