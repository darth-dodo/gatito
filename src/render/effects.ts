/** One floating "z", in cell pixels relative to the body pivot (x already faces right). */
export interface FloatingZ {
  x: number;
  y: number;
  alpha: number;
  /** Grows as it rises, in multiples of the drawn glyph. */
  scale: number;
}

const Z_COUNT = 3;
const Z_SECONDS = 2.4;
const Z_ORIGIN = { x: -8, y: -20 } as const;
const Z_RISE_PX = 32;
const Z_DRIFT_PX = 12;
const Z_GROW = 0.5;

/** Pure: the "z"s above a napping cat at time t, staggered so one rises every Z_SECONDS / Z_COUNT. */
export function floatingZs(t: number): FloatingZ[] {
  const out: FloatingZ[] = [];
  for (let i = 0; i < Z_COUNT; i++) {
    const age = t - (i * Z_SECONDS) / Z_COUNT;
    if (age < 0) continue;
    const p = (age % Z_SECONDS) / Z_SECONDS;
    out.push({
      x: Z_ORIGIN.x + Z_DRIFT_PX * p,
      y: Z_ORIGIN.y - Z_RISE_PX * p,
      alpha: p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8,
      scale: 1 + Z_GROW * p,
    });
  }
  return out;
}
