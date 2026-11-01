export const SPECIES = ['cat', 'dog'] as const;
export const STYLES = ['pixel', 'soft', 'ink', 'silhouette'] as const;
/** Cat coats, in New pet order. */
export const CAT_COATS = ['orange-tabby', 'black', 'white', 'grey', 'tuxedo', 'calico', 'siamese'] as const;
/** Dog coats, in New pet order. */
export const DOG_COATS = ['golden', 'black', 'white', 'brown', 'spotted', 'tricolour', 'husky-grey'] as const;
export const PERSONALITIES = ['cosy', 'curious', 'mischievous', 'social'] as const;
export const CUES = ['whistle', 'clap', 'toy-wand', 'treat-bag'] as const;
export const TRICKS = ['spin', 'sit-up', 'roll-over', 'high-five', 'chase-tail'] as const;

export type Species = (typeof SPECIES)[number];
export type Style = (typeof STYLES)[number];
export type Colour = (typeof CAT_COATS)[number] | (typeof DOG_COATS)[number];
export type Personality = (typeof PERSONALITIES)[number];
export type Cue = (typeof CUES)[number];
export type Trick = (typeof TRICKS)[number];

/** The coats each species can have; a pet's colour must be one of its species' coats. */
export const COATS: { readonly [S in Species]: readonly Colour[] } = { cat: CAT_COATS, dog: DOG_COATS };

/** Every coat of every species, each once. */
export const COLOURS: readonly Colour[] = [...new Set<Colour>([...CAT_COATS, ...DOG_COATS])];

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
