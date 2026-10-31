import { TUNING } from './tuning';
import type { Mood } from './types';

export type Activity = 'napping' | 'resting' | 'active';

const clamp = (value: number): number => Math.min(100, Math.max(0, value));

/** Advances mood by active seconds. Callers pass only active time. */
export function tickMood(mood: Mood, activeSeconds: number, activity: Activity): Mood {
  const hours = activeSeconds / 3600;
  let energy = mood.energy;
  if (activity === 'napping') energy += TUNING.energyNapPerHour * hours;
  else if (activity === 'active') energy -= TUNING.energyActivePerHour * hours;
  return {
    affection: clamp(mood.affection - TUNING.affectionDrainPerHour * hours),
    energy: clamp(energy),
  };
}

export function petMood(mood: Mood, strokes: number): Mood {
  return { ...mood, affection: clamp(mood.affection + strokes * TUNING.affectionPerStroke) };
}

export function rewardMood(mood: Mood): Mood {
  return { ...mood, affection: clamp(mood.affection + TUNING.affectionPerReward) };
}
