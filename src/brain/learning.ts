import type { Rng } from './rng';
import { TUNING } from './tuning';
import type { Cue, Pairings, Pet, Trick } from './types';

const CUES: readonly Cue[] = ['whistle', 'clap', 'toy-wand', 'treat-bag'];
const TRICKS: readonly Trick[] = ['spin', 'sit-up', 'roll-over', 'high-five', 'chase-tail'];

export type CueResponse =
  | { kind: 'perform'; trick: Trick; cheeky: boolean }
  | { kind: 'yawn' }
  | { kind: 'walk-away' };

/** Every cue and trick pairing starts equal at 1.0. */
export function newPairings(): Pairings {
  const row = (): Record<Trick, number> => ({
    spin: 1,
    'sit-up': 1,
    'roll-over': 1,
    'high-five': 1,
    'chase-tail': 1,
  });
  return { whistle: row(), clap: row(), 'toy-wand': row(), 'treat-bag': row() };
}

function withStrength(p: Pairings, cue: Cue, trick: Trick, value: number): Pairings {
  return { ...p, [cue]: { ...p[cue], [trick]: value } };
}

/** Picks a trick at random, weighted by the cue's strengths. */
export function guessTrick(p: Pairings, cue: Cue, rng: Rng): Trick {
  const row = p[cue];
  const total = TRICKS.reduce((sum, t) => sum + row[t], 0);
  let roll = rng.next() * total;
  for (const t of TRICKS) {
    roll -= row[t];
    if (roll < 0) return t;
  }
  return TRICKS[TRICKS.length - 1]!;
}

export function reward(p: Pairings, cue: Cue, trick: Trick): Pairings {
  return withStrength(p, cue, trick, p[cue][trick] + TUNING.rewardStrength);
}

export function noReward(p: Pairings, cue: Cue, trick: Trick): Pairings {
  const next = Math.max(TUNING.minStrength, p[cue][trick] * TUNING.noRewardFactor);
  return withStrength(p, cue, trick, next);
}

/** Drifts every strength toward 1.0; callers pass only active seconds. */
export function fade(p: Pairings, activeSeconds: number): Pairings {
  const hours = activeSeconds / 3600;
  const keep = Math.exp(-hours / TUNING.fadeActiveHours);
  const out = {} as Pairings;
  for (const cue of CUES) {
    const row = {} as Record<Trick, number>;
    for (const t of TRICKS) row[t] = 1 + (p[cue][t] - 1) * keep;
    out[cue] = row;
  }
  return out;
}

/**
 * The trick holding at least the learned share of the cue's weight. A trick
 * already learned stays learned until its share drops below the keep share.
 */
export function learnedTrick(
  p: Pairings,
  cue: Cue,
  wasLearned: Trick | null = null,
): Trick | null {
  const row = p[cue];
  const total = TRICKS.reduce((sum, t) => sum + row[t], 0);
  if (wasLearned !== null && row[wasLearned] / total >= TUNING.learnedKeepShare) {
    return wasLearned;
  }
  for (const t of TRICKS) {
    if (row[t] / total >= TUNING.learnedShare) return t;
  }
  return null;
}

/** Recomputes the pet's learned tricks for every cue, with hysteresis. */
export function updateLearned(pet: Pet): Pet {
  const learned: Partial<Record<Cue, Trick>> = {};
  for (const cue of CUES) {
    const t = learnedTrick(pet.pairings, cue, pet.learned[cue] ?? null);
    if (t !== null) learned[cue] = t;
  }
  return { ...pet, learned };
}

export function respondToCue(pet: Pet, cue: Cue, rng: Rng): CueResponse {
  if (pet.mood.energy < TUNING.yawnBelowEnergy) return { kind: 'yawn' };
  if (pet.mood.affection < TUNING.walkAwayBelowAffection && rng.next() < TUNING.walkAwayChance) {
    return { kind: 'walk-away' };
  }
  const learned = pet.learned[cue] ?? null;
  if (pet.personality === 'mischievous' && learned !== null && rng.next() < TUNING.cheekyChance) {
    const others = TRICKS.filter((t) => t !== learned);
    return { kind: 'perform', trick: others[Math.floor(rng.next() * others.length)]!, cheeky: true };
  }
  return { kind: 'perform', trick: guessTrick(pet.pairings, cue, rng), cheeky: false };
}
