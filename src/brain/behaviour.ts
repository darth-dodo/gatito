import type { Rng } from './rng';
import { TUNING } from './tuning';
import type { Pet, Personality } from './types';

export type BehaviourName =
  | 'idle-sit'
  | 'wander'
  | 'groom'
  | 'stretch'
  | 'nap'
  | 'loaf'
  | 'zoomies'
  | 'stare'
  | 'cuddle-nap'
  | 'content-sit'
  | 'grumpy-sit';

export interface BehaviourContext {
  userIdleSeconds: number;
  justWoke: boolean;
}

const BEHAVIOURS: readonly BehaviourName[] = [
  'idle-sit',
  'wander',
  'groom',
  'stretch',
  'nap',
  'loaf',
  'zoomies',
  'stare',
  'cuddle-nap',
  'content-sit',
  'grumpy-sit',
];

const MISCHIEF: readonly BehaviourName[] = ['zoomies', 'stare', 'grumpy-sit'];

const BASE: Record<Personality, Record<BehaviourName, number>> = {
  cosy: {
    'idle-sit': 14, wander: 6, groom: 12, stretch: 4, nap: 22, loaf: 20,
    zoomies: 2, stare: 3, 'cuddle-nap': 10, 'content-sit': 10, 'grumpy-sit': 2,
  },
  curious: {
    'idle-sit': 12, wander: 26, groom: 8, stretch: 4, nap: 6, loaf: 4,
    zoomies: 8, stare: 12, 'cuddle-nap': 6, 'content-sit': 6, 'grumpy-sit': 3,
  },
  mischievous: {
    'idle-sit': 8, wander: 14, groom: 6, stretch: 3, nap: 8, loaf: 4,
    zoomies: 12, stare: 10, 'cuddle-nap': 4, 'content-sit': 4, 'grumpy-sit': 6,
  },
  social: {
    'idle-sit': 12, wander: 14, groom: 8, stretch: 4, nap: 6, loaf: 6,
    zoomies: 6, stare: 14, 'cuddle-nap': 14, 'content-sit': 14, 'grumpy-sit': 2,
  },
};

export function behaviourWeights(
  pet: Pet,
  ctx: BehaviourContext,
): Record<BehaviourName, number> {
  const { affection, energy } = pet.mood;
  const w = { ...BASE[pet.personality] };

  const neglect = 1 - affection / 100;
  const mischief = 1 + neglect * TUNING.mischiefMultiplier[pet.personality];
  for (const b of MISCHIEF) w[b] *= mischief;

  w.nap *= 1 + (1 - energy / 100) * TUNING.napEnergyFactor;
  w['content-sit'] *= affection / 100;
  w['grumpy-sit'] *= neglect;

  const cuddleOk =
    ctx.userIdleSeconds >= TUNING.cuddleNapIdleSeconds &&
    affection >= TUNING.cuddleNapMinAffection;
  if (!cuddleOk) w['cuddle-nap'] = 0;

  if (ctx.justWoke) w.stretch *= TUNING.wokeStretchFactor;
  return w;
}

export function chooseBehaviour(pet: Pet, ctx: BehaviourContext, rng: Rng): BehaviourName {
  const w = behaviourWeights(pet, ctx);
  const live = BEHAVIOURS.filter((b) => w[b] > 0);
  const total = live.reduce((s, b) => s + w[b], 0);
  let roll = rng.next() * total;
  for (const b of live) {
    roll -= w[b];
    if (roll < 0) return b;
  }
  return live[live.length - 1] as BehaviourName;
}
