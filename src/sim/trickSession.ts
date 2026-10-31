import { noReward, reward, respondToCue, updateLearned } from '../brain/learning';
import { rewardMood } from '../brain/mood';
import type { Rng } from '../brain/rng';
import { TUNING } from '../brain/tuning';
import type { Cue, Pet, Trick } from '../brain/types';

export type TrickAnim = Trick | 'yawn' | 'walk-away';

export type SessionEvent =
  | { kind: 'play'; anim: TrickAnim }
  | { kind: 'rewarded' }
  | { kind: 'not-rewarded' }
  | { kind: 'learned'; cue: Cue; trick: Trick };

export interface SessionResult {
  /** The pet after this step; equal to the input when nothing changed. */
  pet: Pet;
  events: SessionEvent[];
}

type State =
  | { phase: 'idle' }
  /** A trick (`trick` set) or a yawn/walk-away (`trick` null) is playing. */
  | { phase: 'playing'; cue: Cue; trick: Trick | null }
  | { phase: 'window'; cue: Cue; trick: Trick; left: number };

/**
 * One training round for one pet: cue, trick plays, reward window, outcome.
 * Pure: it holds no pet, so callers pass the current pet in and store the returned one.
 */
export class TrickSession {
  private state: State = { phase: 'idle' };

  phase(): 'idle' | 'playing' | 'window' {
    return this.state.phase;
  }

  /** Starts a round. Ignored (no events) while a round is already running. */
  startCue(pet: Pet, cue: Cue, rng: Rng): SessionResult {
    if (this.state.phase !== 'idle') return { pet, events: [] };
    const r = respondToCue(pet, cue, rng);
    if (r.kind === 'perform') {
      this.state = { phase: 'playing', cue, trick: r.trick };
      return { pet, events: [{ kind: 'play', anim: r.trick }] };
    }
    this.state = { phase: 'playing', cue, trick: null };
    return { pet, events: [{ kind: 'play', anim: r.kind }] };
  }

  /** Call when the controller reports the started action has ended. */
  actionEnded(pet: Pet): SessionResult {
    const s = this.state;
    if (s.phase === 'playing') {
      this.state =
        s.trick === null
          ? { phase: 'idle' }
          : { phase: 'window', cue: s.cue, trick: s.trick, left: TUNING.rewardWindowSeconds };
    }
    return { pet, events: [] };
  }

  /** Advances the reward window; expiry is "not rewarded". */
  tick(dt: number, pet: Pet): SessionResult {
    const s = this.state;
    if (s.phase !== 'window') return { pet, events: [] };
    const left = s.left - dt;
    if (left > 0) {
      this.state = { ...s, left };
      return { pet, events: [] };
    }
    this.state = { phase: 'idle' };
    const next = this.settle({ ...pet, pairings: noReward(pet.pairings, s.cue, s.trick) }, s.cue);
    return { pet: next.pet, events: [{ kind: 'not-rewarded' }, ...next.events] };
  }

  /** A stroke inside the window is a reward; strokes at other times do nothing here. */
  onStroke(pet: Pet): SessionResult {
    const s = this.state;
    if (s.phase !== 'window') return { pet, events: [] };
    this.state = { phase: 'idle' };
    const next = this.settle(
      { ...pet, pairings: reward(pet.pairings, s.cue, s.trick), mood: rewardMood(pet.mood) },
      s.cue,
    );
    return { pet: next.pet, events: [{ kind: 'rewarded' }, ...next.events] };
  }

  /** Drops the round (the pet was picked up, removed, etc.) without learning anything. */
  abort(): void {
    this.state = { phase: 'idle' };
  }

  /** Updates learned tricks and reports the sparkle the first time a cue is learned. */
  private settle(pet: Pet, cue: Cue): SessionResult {
    const updated = updateLearned(pet);
    const trick = updated.learned[cue];
    if (trick === undefined || updated.celebrated?.[cue] !== undefined) {
      return { pet: updated, events: [] };
    }
    return {
      pet: { ...updated, celebrated: { ...updated.celebrated, [cue]: trick } },
      events: [{ kind: 'learned', cue, trick }],
    };
  }
}
