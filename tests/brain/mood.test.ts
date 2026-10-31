import { describe, expect, it } from 'vitest';
import { petMood, rewardMood, tickMood } from '../../src/brain/mood';
import { seededRng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';

const mood = { affection: 50, energy: 50 };

describe('tickMood', () => {
  it('affection drains 10 per active hour', () => {
    expect(tickMood(mood, 3600, 'resting').affection).toBe(40);
  });
  it('napping restores energy', () => {
    const m = tickMood(mood, 3600, 'napping');
    expect(m.energy).toBe(50 + TUNING.energyNapPerHour);
    expect(m.affection).toBe(40);
  });
  it('activity drains energy', () => {
    expect(tickMood(mood, 3600, 'active').energy).toBe(50 - TUNING.energyActivePerHour);
  });
  it('resting leaves energy alone', () => {
    expect(tickMood(mood, 3600, 'resting').energy).toBe(50);
  });
  it('meters clamp to 0..100', () => {
    expect(tickMood(mood, 20 * 3600, 'resting').affection).toBe(0);
    expect(tickMood(mood, 20 * 3600, 'napping').energy).toBe(100);
    expect(tickMood(mood, 20 * 3600, 'active').energy).toBe(0);
    expect(petMood({ affection: 99, energy: 50 }, 3).affection).toBe(100);
    expect(rewardMood({ affection: 99, energy: 50 }).affection).toBe(100);
  });
  it('does not mutate its input', () => {
    tickMood(mood, 3600, 'active');
    expect(mood).toEqual({ affection: 50, energy: 50 });
  });
});

describe('petting and rewards', () => {
  it('petting raises affection by strokes', () => {
    expect(petMood(mood, 3).affection).toBe(mood.affection + 3 * TUNING.affectionPerStroke);
    expect(petMood(mood, 3).energy).toBe(50);
  });
  it('reward raises affection', () => {
    expect(rewardMood(mood).affection).toBe(mood.affection + TUNING.affectionPerReward);
  });
});

describe('seededRng', () => {
  it('is deterministic per seed and within [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 50; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(seededRng(1).next()).not.toBe(seededRng(2).next());
  });
});
