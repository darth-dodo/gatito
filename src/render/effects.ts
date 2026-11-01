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

/** One rising heart, in cell pixels relative to the body pivot (x already faces right). */
export interface Heart {
  x: number;
  y: number;
  alpha: number;
}

/** Hearts alive at once above one purring pet. */
export const MAX_HEARTS = 4;
const HEART_SECONDS = 1.6;
const HEART_ORIGIN = { x: 14, y: -34 } as const;
const HEART_RISE_PX = 28;
/** Side-to-side wobble while rising, and a fixed sideways offset per heart slot. */
const HEART_SWAY_PX = 3;
const HEART_SPREAD_PX = [0, -7, 5, -3] as const;

/** Pure: the hearts above a purring cat at time t, staggered so one rises every HEART_SECONDS / MAX_HEARTS. */
export function risingHearts(t: number): Heart[] {
  const out: Heart[] = [];
  for (let i = 0; i < MAX_HEARTS; i++) {
    const age = t - (i * HEART_SECONDS) / MAX_HEARTS;
    if (age < 0) continue;
    const p = (age % HEART_SECONDS) / HEART_SECONDS;
    out.push({
      x: HEART_ORIGIN.x + (HEART_SPREAD_PX[i] ?? 0) + HEART_SWAY_PX * Math.sin(p * Math.PI * 2),
      y: HEART_ORIGIN.y - HEART_RISE_PX * p,
      alpha: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
    });
  }
  return out;
}

/** How long the small burst after a tap lasts. */
export const HEART_BURST_SECONDS = 0.8;
const BURST_HEARTS = 3;
const BURST_SPREAD_PX = 9;
const BURST_RISE_PX = 18;

/** Pure: the few hearts that pop up and fade after a tap, `age` seconds ago. Empty once it is over. */
export function heartBurst(age: number): Heart[] {
  if (age < 0 || age >= HEART_BURST_SECONDS) return [];
  const p = age / HEART_BURST_SECONDS;
  const out: Heart[] = [];
  for (let i = 0; i < BURST_HEARTS; i++) {
    const side = i - (BURST_HEARTS - 1) / 2;
    out.push({
      x: HEART_ORIGIN.x + side * BURST_SPREAD_PX * (0.4 + 0.6 * p),
      y: HEART_ORIGIN.y - BURST_RISE_PX * p - (side === 0 ? 4 : 0),
      alpha: p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9,
    });
  }
  return out;
}
