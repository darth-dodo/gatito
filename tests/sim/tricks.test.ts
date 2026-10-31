import { describe, expect, it } from 'vitest';
import { newPairings } from '../../src/brain/learning';
import type { Rng } from '../../src/brain/rng';
import { TUNING } from '../../src/brain/tuning';
import type { Cue, Pet, Trick } from '../../src/brain/types';
import { TrickSession } from '../../src/sim/trickSession';

function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'mochi',
    species: 'cat',
    name: 'Mochi',
    style: 'pixel',
    colour: 'orange-tabby',
    personality: 'cosy',
    mood: { affection: 60, energy: 60 },
    pairings: newPairings(),
    learned: {},
    ...over,
  };
}

/** An rng that always returns the same value. */
const fixed = (v: number): Rng => ({ next: () => v });

const WINDOW = TUNING.rewardWindowSeconds;

describe('TrickSession', () => {
  it('cue plays a trick and waits; the window opens only when the trick ends', () => {
    const s = new TrickSession();
    const r = s.startCue(pet(), 'whistle', fixed(0));
    expect(r.events).toEqual([{ kind: 'play', anim: 'spin' }]);
    expect(s.phase()).toBe('playing');
    // Time passing while the trick plays does not expire anything.
    expect(s.tick(WINDOW * 5, r.pet).events).toEqual([]);
    expect(s.onStroke(r.pet).events).toEqual([]);
    s.actionEnded(r.pet);
    expect(s.phase()).toBe('window');
  });

  it('petting inside the window rewards once', () => {
    const s = new TrickSession();
    const p0 = pet();
    s.startCue(p0, 'whistle', fixed(0));
    s.actionEnded(p0);
    const t1 = s.tick(WINDOW - 0.5, p0);
    expect(t1.events).toEqual([]);
    const r = s.onStroke(p0);
    expect(r.events).toEqual([{ kind: 'rewarded' }]);
    expect(r.pet.pairings.whistle.spin).toBeGreaterThan(p0.pairings.whistle.spin);
    expect(r.pet.mood.affection).toBeGreaterThan(p0.mood.affection);
    expect(s.phase()).toBe('idle');
    // A second stroke or the old timer does nothing.
    expect(s.onStroke(r.pet).events).toEqual([]);
    expect(s.tick(WINDOW * 2, r.pet).events).toEqual([]);
  });

  it('silence is no reward, applied once', () => {
    const s = new TrickSession();
    const p0 = pet();
    s.startCue(p0, 'clap', fixed(0));
    s.actionEnded(p0);
    expect(s.tick(WINDOW - 0.1, p0).events).toEqual([]);
    const r = s.tick(0.2, p0);
    expect(r.events).toEqual([{ kind: 'not-rewarded' }]);
    expect(r.pet.pairings.clap.spin).toBeLessThan(p0.pairings.clap.spin);
    expect(r.pet.mood).toEqual(p0.mood);
    expect(s.tick(WINDOW, r.pet).events).toEqual([]);
    expect(s.onStroke(r.pet).events).toEqual([]);
  });

  it('first learn sparkles once, not on later rounds', () => {
    const s = new TrickSession();
    let p = pet();
    let learnedEvents = 0;
    let rounds = 0;
    for (; rounds < 40; rounds++) {
      p = s.startCue(p, 'whistle', fixed(0)).pet; // fixed rng always picks the first trick, spin
      s.actionEnded(p);
      const r = s.onStroke(p);
      p = r.pet;
      learnedEvents += r.events.filter((e) => e.kind === 'learned').length;
      if (rounds === 0) expect(learnedEvents).toBe(0);
    }
    expect(learnedEvents).toBe(1);
    expect(p.learned.whistle).toBe('spin');
    expect(p.celebrated?.whistle).toBe('spin');
  });

  it('the learned event names the cue and trick', () => {
    const s = new TrickSession();
    let p = pet({ pairings: { ...newPairings(), clap: { spin: 1, 'sit-up': 1, 'roll-over': 1, 'high-five': 30, 'chase-tail': 1 } } });
    p = s.startCue(p, 'clap', fixed(0.99)).pet; // lands on a weighted trick
    s.actionEnded(p);
    const r = s.onStroke(p);
    const ev = r.events.find((e) => e.kind === 'learned');
    expect(ev).toEqual({ kind: 'learned', cue: 'clap', trick: 'high-five' });
  });

  it('does not re-celebrate a cue already celebrated before a restart', () => {
    const s = new TrickSession();
    const strong = { ...newPairings(), clap: { spin: 30, 'sit-up': 1, 'roll-over': 1, 'high-five': 1, 'chase-tail': 1 } };
    let p = pet({ pairings: strong, learned: { clap: 'spin' }, celebrated: { clap: 'spin' } });
    p = s.startCue(p, 'clap', fixed(0)).pet;
    s.actionEnded(p);
    expect(s.onStroke(p).events.map((e) => e.kind)).toEqual(['rewarded']);
  });

  it('low energy yawns instead of a trick, with no reward window', () => {
    const s = new TrickSession();
    const p0 = pet({ mood: { affection: 60, energy: 5 } });
    const r = s.startCue(p0, 'whistle', fixed(0));
    expect(r.events).toEqual([{ kind: 'play', anim: 'yawn' }]);
    expect(r.pet).toEqual(p0);
    s.actionEnded(r.pet);
    expect(s.phase()).toBe('idle');
    expect(s.tick(WINDOW * 2, r.pet).events).toEqual([]);
    expect(s.onStroke(r.pet).events).toEqual([]);
  });

  it('low affection can walk away instead of a trick', () => {
    const s = new TrickSession();
    const p0 = pet({ mood: { affection: 5, energy: 60 } });
    const r = s.startCue(p0, 'whistle', fixed(0)); // 0 < walkAwayChance
    expect(r.events).toEqual([{ kind: 'play', anim: 'walk-away' }]);
    s.actionEnded(r.pet);
    expect(s.phase()).toBe('idle');
  });

  it('a mischievous cat that has learned a cue sometimes performs a different trick', () => {
    const s = new TrickSession();
    const p0 = pet({ personality: 'mischievous', learned: { whistle: 'spin' } });
    const r = s.startCue(p0, 'whistle', fixed(0));
    expect(r.events).toEqual([{ kind: 'play', anim: 'sit-up' }]);
    expect(r.pet).toEqual(p0);
  });

  it('ignores a new cue while a round is running', () => {
    const s = new TrickSession();
    const p0 = pet();
    s.startCue(p0, 'whistle', fixed(0));
    expect(s.startCue(p0, 'clap', fixed(0)).events).toEqual([]);
    s.actionEnded(p0);
    expect(s.startCue(p0, 'clap', fixed(0)).events).toEqual([]);
  });

  it('abort drops the round without learning', () => {
    const s = new TrickSession();
    const p0 = pet();
    s.startCue(p0, 'whistle', fixed(0));
    s.abort();
    expect(s.phase()).toBe('idle');
    expect(s.tick(WINDOW * 2, p0).events).toEqual([]);
  });

  it('types: cue and trick are the shared unions', () => {
    const c: Cue = 'whistle';
    const t: Trick = 'spin';
    expect([c, t]).toEqual(['whistle', 'spin']);
  });
});
