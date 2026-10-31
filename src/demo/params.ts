/** Fastest simulation speed the demo page allows. */
export const MAX_DEMO_SPEED = 8;

export interface DemoParams {
  /** Simulation time scale, 1 to MAX_DEMO_SPEED. */
  speed: number;
  /** Fixed random seed, or undefined for a fresh one each load. */
  seed: number | undefined;
}

function number(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads `?speed=N` (clamped to 1..8, default 1) and `?seed=N` (unsigned 32-bit) from a query string. */
export function parseDemoParams(search: string): DemoParams {
  const q = new URLSearchParams(search);
  const speed = number(q.get('speed'));
  const seed = number(q.get('seed'));
  return {
    speed: speed === undefined ? 1 : Math.min(Math.max(speed, 1), MAX_DEMO_SPEED),
    seed: seed === undefined ? undefined : Math.trunc(seed) >>> 0,
  };
}
