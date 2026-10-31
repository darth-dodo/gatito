/** True for a colour that is magenta, or a blend of magenta with the art (r and b both well above g). */
export function isMagentaTinted(r: number, g: number, b: number): boolean {
  return r - g > 40 && b - g > 40;
}

const SEARCH_RADIUS = 3;

/**
 * Cleans the keyed, snapped RGBA image in place: magenta-tinted opaque pixels take the colour of the nearest
 * untinted opaque neighbour (or go transparent when there is none), then isolated opaque specks are dropped.
 */
export function defringe(data: Buffer, width: number, height: number): void {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
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
      if (opaque(x, y) && !opaque(x - 1, y) && !opaque(x + 1, y) && !opaque(x, y - 1) && !opaque(x, y + 1)) {
        specks.push(at(x, y));
      }
    }
  }
  for (const i of specks) data[i + 3] = 0;
}
