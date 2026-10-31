import { describe, expect, it } from 'vitest';
import {
  fade,
  guessTrick,
  learnedTrick,
  newPairings,
  noReward,
  respondToCue,
  reward,
  updateLearned,
} from '../../src/brain/learning';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import type { Pairings, Pet, Trick } from '../../src/brain/types';

const TRICKS: Trick[] = ['spin', 'sit-up', 'roll-over', 'high-five', 'chase-tail'];

function learnedSpin(): Pairings {
  let p = newPairings();
  for (let i = 0; i < 8; i++) p = reward(p, 'whistle', 'spin');
  return p;
}

function learnedOf(p: Pairings | undefined): Pet['learned'] {
  return p ? updateLearned({ ...pet(), pairings: p }).learned : {};
}

function pet(over: Partial<Pet> & { affection?: number; energy?: number } = {}): Pet {
  return {
    id: 'p',
    species: 'cat',
    name: 'Mochi',
    style: 'pixel',
    colour: 'black',
    personality: over.personality ?? 'cosy',
    mood: { affection: over.affection ?? 80, energy: over.energy ?? 80 },
    pairings: over.pairings ?? newPairings(),
    learned: over.learned ?? learnedOf(over.pairings),
  };
}

describe('pairings', () => {
  it('starts even at 1.0', () => {
    expect(newPairings().whistle.spin).toBe(1);
    expect(newPairings().clap['chase-tail']).toBe(1);
  });

  it('guessTrick favours stronger pairings', () => {
    const p = reward(reward(newPairings(), 'whistle', 'spin'), 'whistle', 'spin');
    const rng = seededRng(3);
    let spins = 0;
    for (let i = 0; i < 2000; i++) if (guessTrick(p, 'whistle', rng) === 'spin') spins++;
    expect(spins / 2000).toBeCloseTo(5 / 9, 1);
  });
});

describe('reward and noReward', () => {
  it('reward strengthens by 2.0 without mutating', () => {
    const p = newPairings();
    const q = reward(p, 'whistle', 'spin');
    expect(q.whistle.spin).toBe(1 + TUNING.rewardStrength);
    expect(p.whistle.spin).toBe(1);
    expect(q.clap.spin).toBe(1);
  });

  it('no reward weakens by 0.8 with a floor of 0.2', () => {
    let p = noReward(newPairings(), 'whistle', 'spin');
    expect(p.whistle.spin).toBeCloseTo(0.8);
    for (let i = 0; i < 20; i++) p = noReward(p, 'whistle', 'spin');
    expect(p.whistle.spin).toBe(TUNING.minStrength);
  });
});

describe('learnedTrick', () => {
  it('is null when nothing reaches an 80 percent share', () => {
    expect(learnedTrick(newPairings(), 'whistle')).toBeNull();
    let p = newPairings();
    for (let i = 0; i < 7; i++) p = reward(p, 'whistle', 'spin');
    expect(learnedTrick(p, 'whistle')).toBeNull();
  });

  it('returns the trick once its share is at least 80 percent', () => {
    const p = learnedSpin();
    expect(learnedTrick(p, 'whistle')).toBe('spin');
    expect(learnedTrick(p, 'clap')).toBeNull();
  });

  it('teaches in 5 to 8 rewarded rounds (median over 50 seeds)', () => {
    const counts: number[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const rng = seededRng(seed);
      let p = newPairings();
      let rewarded = 0;
      for (let round = 0; round < 500 && learnedTrick(p, 'whistle') !== 'spin'; round++) {
        if (guessTrick(p, 'whistle', rng) === 'spin') {
          p = reward(p, 'whistle', 'spin');
          rewarded++;
        }
      }
      counts.push(rewarded);
    }
    counts.sort((a, b) => a - b);
    const median = (counts[24]! + counts[25]!) / 2;
    expect(median).toBeGreaterThanOrEqual(5);
    expect(median).toBeLessThanOrEqual(8);
  });
});

describe('fade', () => {
  it('lightly trained pairings are within 0.1 of even after 160 active hours', () => {
    let p = reward(newPairings(), 'whistle', 'spin');
    p = noReward(p, 'clap', 'sit-up');
    const faded = fade(p, 160 * 3600);
    for (const cue of Object.keys(faded) as (keyof Pairings)[]) {
      for (const t of TRICKS) expect(Math.abs(faded[cue][t] - 1)).toBeLessThan(0.1);
    }
  });

  it('keeps an 8-round trick learned after 1 and 20 active hours', () => {
    const p = learnedSpin();
    expect(learnedTrick(fade(p, 3600), 'whistle', 'spin')).toBe('spin');
    expect(learnedTrick(fade(p, 20 * 3600), 'whistle', 'spin')).toBe('spin');
  });

  it('forgets an 8-round trick after 80 active hours', () => {
    expect(learnedTrick(fade(learnedSpin(), 80 * 3600), 'whistle', 'spin')).toBeNull();
  });

  it('does not mutate its input', () => {
    const p = learnedSpin();
    fade(p, 40 * 3600);
    expect(p.whistle.spin).toBe(1 + 8 * TUNING.rewardStrength);
  });
});

describe('learned hysteresis', () => {
  // spin share = 0.7: s / (s + 4) = 0.7
  const p: Pairings = newPairings();
  p.whistle.spin = 28 / 3;

  it('stays learned at share 0.7 when previously learned', () => {
    expect(learnedTrick(p, 'whistle', 'spin')).toBe('spin');
  });
  it('is not learned at share 0.7 when not previously learned', () => {
    expect(learnedTrick(p, 'whistle', null)).toBeNull();
    expect(learnedTrick(p, 'whistle')).toBeNull();
  });
  it('updateLearned recomputes every cue from the previous value', () => {
    const base = pet({ pairings: p });
    expect(updateLearned(base).learned).toEqual({});
    expect(updateLearned({ ...base, learned: { whistle: 'spin' } }).learned).toEqual({
      whistle: 'spin',
    });
    const full = pet({ pairings: learnedSpin() });
    expect(updateLearned(full).learned).toEqual({ whistle: 'spin' });
  });
});

describe('respondToCue', () => {
  it('tired cats yawn', () => {
    expect(respondToCue(pet({ energy: 19 }), 'whistle', seededRng(1))).toEqual({ kind: 'yawn' });
  });

  it('yawn takes priority over walking away', () => {
    expect(respondToCue(pet({ energy: 5, affection: 5 }), 'whistle', seededRng(1))).toEqual({
      kind: 'yawn',
    });
  });

  it('unloved cats walk away about half the time', () => {
    const rng = seededRng(9);
    let away = 0;
    for (let i = 0; i < 1000; i++) {
      const r = respondToCue(pet({ affection: 24 }), 'whistle', rng);
      if (r.kind === 'walk-away') away++;
      else expect(r.kind).toBe('perform');
    }
    expect(away / 1000).toBeGreaterThan(0.45);
    expect(away / 1000).toBeLessThan(0.55);
  });

  it('willing cats perform and are not cheeky before learning', () => {
    const r = respondToCue(pet({ personality: 'mischievous' }), 'whistle', seededRng(2));
    expect(r.kind).toBe('perform');
    if (r.kind === 'perform') expect(r.cheeky).toBe(false);
  });

  it('mischievous cats that learned a trick are cheeky 1 in 7', () => {
    const rng = seededRng(11);
    const p = pet({ personality: 'mischievous', pairings: learnedSpin() });
    let cheeky = 0;
    for (let i = 0; i < 7000; i++) {
      const r = respondToCue(p, 'whistle', rng);
      if (r.kind !== 'perform') throw new Error('expected perform');
      if (r.cheeky) {
        cheeky++;
        expect(r.trick).not.toBe('spin');
      }
    }
    expect(Math.abs(cheeky / 7000 - 1 / 7)).toBeLessThan(0.015);
  });

  it('other personalities are never cheeky', () => {
    for (const personality of ['cosy', 'curious', 'social'] as const) {
      const rng = seededRng(5);
      const p = pet({ personality, pairings: learnedSpin() });
      for (let i = 0; i < 1000; i++) {
        const r = respondToCue(p, 'whistle', rng);
        if (r.kind !== 'perform') throw new Error('expected perform');
        expect(r.cheeky).toBe(false);
      }
    }
  });
});
