export const SPECIES = ['cat', 'dog'] as const;
export const STYLES = ['pixel', 'soft', 'ink', 'silhouette'] as const;
export const COLOURS = [
  'orange-tabby',
  'black',
  'white',
  'grey',
  'tuxedo',
  'calico',
  'siamese',
] as const;
export const PERSONALITIES = ['cosy', 'curious', 'mischievous', 'social'] as const;
export const CUES = ['whistle', 'clap', 'toy-wand', 'treat-bag'] as const;
export const TRICKS = ['spin', 'sit-up', 'roll-over', 'high-five', 'chase-tail'] as const;

export type Species = (typeof SPECIES)[number];
export type Style = (typeof STYLES)[number];
export type Colour = (typeof COLOURS)[number];
export type Personality = (typeof PERSONALITIES)[number];
export type Cue = (typeof CUES)[number];
export type Trick = (typeof TRICKS)[number];

/** Both meters range from 0 to 100. */
export interface Mood {
  affection: number;
  energy: number;
}

export type Pairings = Record<Cue, Record<Trick, number>>;

export interface Pet {
  id: string;
  species: Species;
  name: string;
  style: Style;
  colour: Colour;
  personality: Personality;
  mood: Mood;
  pairings: Pairings;
  /** The trick currently learned for each cue; persisted so fading has hysteresis. */
  learned: Partial<Record<Cue, Trick>>;
  /** Cues whose first-learned sparkle has already played; survives restarts. */
  celebrated?: Partial<Record<Cue, Trick>>;
}
