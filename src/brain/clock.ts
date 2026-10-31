import { TUNING } from './tuning';

export interface ClockState {
  userIdleSeconds: number;
  napTime: boolean;
}

/** Seconds that count toward mood and trick fading: only while the user is active and Nap time is off. */
export function activeSeconds(dtSeconds: number, s: ClockState): number {
  if (dtSeconds <= 0) return 0;
  if (s.napTime || s.userIdleSeconds >= TUNING.activeIdleSeconds) return 0;
  return dtSeconds;
}

/** Limits a frame delta so sleep, suspend or a stalled tab cannot advance the simulation in one step. */
export function clampFrameDelta(dtSeconds: number): number {
  return Math.min(Math.max(dtSeconds, 0), TUNING.maxFrameDeltaSeconds);
}
