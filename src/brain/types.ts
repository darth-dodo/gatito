export type Personality = 'cosy' | 'curious' | 'mischievous' | 'social';
export type Colour =
  | 'orange-tabby'
  | 'black'
  | 'white'
  | 'grey'
  | 'tuxedo'
  | 'calico'
  | 'siamese';
export type Species = 'cat' | 'dog';
export type Style = 'pixel' | 'soft' | 'ink' | 'silhouette';
export type Cue = 'whistle' | 'clap' | 'toy-wand' | 'treat-bag';
export type Trick = 'spin' | 'sit-up' | 'roll-over' | 'high-five' | 'chase-tail';

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
}
