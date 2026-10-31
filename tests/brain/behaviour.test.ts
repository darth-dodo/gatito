import { describe, expect, it } from 'vitest';
import {
  behaviourWeights,
  chooseBehaviour,
  type BehaviourName,
} from '../../src/brain/behaviour';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import type { Mood, Pet, Personality } from '../../src/brain/types';

const PERSONALITIES: Personality[] = ['cosy', 'curious', 'mischievous', 'social'];
const MISCHIEF: BehaviourName[] = ['zoomies', 'stare', 'grumpy-sit'];
const idle = { userIdleSeconds: 0, justWoke: false };

function pet(personality: Personality, mood: Mood): Pet {
  return {
    id: 'p1',
    species: 'cat',
    name: 'Miso',
    style: 'soft',
    colour: 'grey',
    personality,
    mood,
    pairings: {} as Pet['pairings'],
  };
}

function entries(w: Record<BehaviourName, number>): [BehaviourName, number][] {
  return Object.entries(w) as [BehaviourName, number][];
}
function top(w: Record<BehaviourName, number>): BehaviourName {
  return entries(w).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
function mischiefShare(p: Personality, affection: number): number {
  const w = behaviourWeights(pet(p, { affection, energy: 50 }), idle);
  const total = entries(w).reduce((s, [, v]) => s + v, 0);
  return MISCHIEF.reduce((s, b) => s + w[b], 0) / total;
}

describe('behaviourWeights', () => {
  it('tired cats mostly nap', () => {
    for (const p of PERSONALITIES) {
      const w = behaviourWeights(pet(p, { affection: 50, energy: 10 }), idle);
      expect(top(w)).toBe('nap');
    }
  });

  it('neglect raises mischief, scaled by personality', () => {
    const neglected = Object.fromEntries(
      PERSONALITIES.map((p) => [p, mischiefShare(p, 10)]),
    ) as Record<Personality, number>;
    const max = Math.max(...Object.values(neglected));
    const min = Math.min(...Object.values(neglected));
    expect(neglected.mischievous).toBe(max);
    expect(neglected.cosy).toBe(min);
    for (const p of PERSONALITIES) {
      expect(neglected[p]).toBeGreaterThan(mischiefShare(p, 90));
    }
  });

  it('cuddle nap needs affection and an idle user', () => {
    const idleOk = TUNING.cuddleNapIdleSeconds;
    const aff = TUNING.cuddleNapMinAffection;
    const w = (a: number, s: number) =>
      behaviourWeights(pet('social', { affection: a, energy: 50 }), {
        userIdleSeconds: s,
        justWoke: false,
      })['cuddle-nap'];
    expect(w(aff, idleOk)).toBeGreaterThan(0);
    expect(w(aff, idleOk - 1)).toBe(0);
    expect(w(aff - 1, idleOk)).toBe(0);
    expect(w(100, 0)).toBe(0);
  });

  it('stretch follows waking', () => {
    for (const p of PERSONALITIES) {
      const w = behaviourWeights(pet(p, { affection: 50, energy: 50 }), {
        userIdleSeconds: 0,
        justWoke: true,
      });
      expect(top(w)).toBe('stretch');
    }
  });

  it('personality leanings', () => {
    const mood = { affection: 50, energy: 50 };
    expect(['nap', 'loaf']).toContain(top(behaviourWeights(pet('cosy', mood), idle)));
    expect(top(behaviourWeights(pet('curious', mood), idle))).toBe('wander');
    expect(mischiefShare('mischievous', 50)).toBeGreaterThan(mischiefShare('cosy', 50));
  });
});

describe('chooseBehaviour', () => {
  it('is deterministic for a seed and matches the weight shares', () => {
    const p = pet('curious', { affection: 40, energy: 60 });
    const ctx = { userIdleSeconds: 0, justWoke: false };
    const w = behaviourWeights(p, ctx);
    const total = entries(w).reduce((s, [, v]) => s + v, 0);
    const draw = (): Record<string, number> => {
      const rng = seededRng(1);
      const counts: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        const b = chooseBehaviour(p, ctx, rng);
        counts[b] = (counts[b] ?? 0) + 1;
      }
      return counts;
    };
    const counts = draw();
    expect(draw()).toEqual(counts);
    for (const [name, weight] of entries(w)) {
      expect(Math.abs((counts[name] ?? 0) / 1000 - weight / total)).toBeLessThan(0.03);
    }
  });

  it('never returns a zero-weight behaviour', () => {
    const p = pet('cosy', { affection: 10, energy: 50 });
    const ctx = { userIdleSeconds: 0, justWoke: false };
    const rng = { next: () => 0.999999999 };
    expect(chooseBehaviour(p, ctx, rng)).not.toBe('cuddle-nap');
    for (const r of [0, 0.5, 0.999999999]) {
      const b = chooseBehaviour(p, ctx, { next: () => r });
      expect(behaviourWeights(p, ctx)[b]).toBeGreaterThan(0);
    }
  });
});
