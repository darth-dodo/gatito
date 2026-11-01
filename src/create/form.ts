import { newPairings } from '../brain/learning';
import { validateName } from '../brain/names';
import type { SaveFile } from '../brain/save';
import { TUNING } from '../brain/tuning';
import { COATS, type Colour, type Personality, type Pet, type Species, type Style } from '../brain/types';

export interface Option<T extends string> {
  value: T;
  label: string;
  enabled: boolean;
  /** Why a disabled option is not available yet. */
  note?: string;
}

export const SPECIES_OPTIONS: readonly Option<Species>[] = [
  { value: 'cat', label: 'Cat', enabled: true },
  { value: 'dog', label: 'Dog', enabled: true },
];

export const STYLE_OPTIONS: readonly Option<Style>[] = [
  { value: 'pixel', label: 'Pixel', enabled: true },
  { value: 'soft', label: 'Soft and cute', enabled: false, note: 'coming soon' },
  { value: 'ink', label: 'Ink doodle', enabled: false, note: 'coming soon' },
  { value: 'silhouette', label: 'Silhouette', enabled: false, note: 'coming soon' },
];

export const PERSONALITY_OPTIONS: readonly Option<Personality>[] = [
  { value: 'cosy', label: 'Cosy', enabled: true },
  { value: 'curious', label: 'Curious', enabled: true },
  { value: 'mischievous', label: 'Mischievous', enabled: true },
  { value: 'social', label: 'Social', enabled: true },
];

const COLOUR_LABELS: Record<Colour, string> = {
  'orange-tabby': 'Orange tabby',
  black: 'Black',
  white: 'White',
  grey: 'Grey',
  tuxedo: 'Tuxedo',
  calico: 'Calico',
  siamese: 'Siamese',
  golden: 'Golden',
  brown: 'Brown',
  spotted: 'Spotted',
  tricolour: 'Tricolour',
  'husky-grey': 'Husky grey',
};

/** Every coat of the species, enabled only where its sprite sheet exists. */
export function colourOptions(species: Species, hasArt: (c: Colour) => boolean): Option<Colour>[] {
  return COATS[species].map((value) =>
    hasArt(value)
      ? { value, label: COLOUR_LABELS[value], enabled: true }
      : { value, label: COLOUR_LABELS[value], enabled: false, note: 'art coming' },
  );
}

/** Keeps the current coat if it is on offer (black and white are both species' coats), else the first that is. */
export function pickColour(options: readonly Option<Colour>[], current: Colour | null): Colour | null {
  if (current !== null && options.some((o) => o.value === current && o.enabled)) return current;
  return options.find((o) => o.enabled)?.value ?? null;
}

export const LIMIT_NOTE = `${TUNING.maxCats} pets is the limit`;

const NAME_ERRORS = {
  empty: 'Every pet needs a name',
  'too-long': `Up to ${TUNING.maxNameLength} characters`,
} as const;

export interface FormState {
  mode: 'new' | 'edit';
  canSubmit: boolean;
  /** Shown instead of creating when the pet limit is reached. */
  limitNote: string | null;
  nameError: string | null;
  /** Species and personality are fixed at birth. */
  speciesReadOnly: boolean;
  personalityReadOnly: boolean;
}

export function formState(input: {
  pets: readonly Pet[];
  editing: Pet | null;
  name: string;
}): FormState {
  const mode = input.editing ? 'edit' : 'new';
  const full = mode === 'new' && input.pets.length >= TUNING.maxCats;
  const name = validateName(input.name);
  return {
    mode,
    canSubmit: !full && name.ok,
    limitNote: full ? LIMIT_NOTE : null,
    nameError: name.ok ? null : NAME_ERRORS[name.reason],
    speciesReadOnly: mode === 'edit',
    personalityReadOnly: mode === 'edit',
  };
}

export interface NewPetFields {
  species: Species;
  name: string;
  colour: Colour;
  style: Style;
  personality: Personality;
}

export type EditFields = Pick<Pet, 'name' | 'colour' | 'style'>;

/** A newborn pet: affection 60, energy 80, nothing learned yet. */
export function newPet(f: NewPetFields, id: string): Pet {
  return {
    id,
    species: f.species,
    name: f.name,
    style: f.style,
    colour: f.colour,
    personality: f.personality,
    mood: { affection: 60, energy: 80 },
    pairings: newPairings(),
    learned: {},
  };
}

export function withNewPet(save: SaveFile, pet: Pet): SaveFile {
  if (save.pets.length >= TUNING.maxCats) return save;
  return { ...save, pets: [...save.pets, pet] };
}

export function withEdit(save: SaveFile, id: string, f: EditFields): SaveFile {
  return {
    ...save,
    pets: save.pets.map((p) =>
      p.id === id ? { ...p, name: f.name, colour: f.colour, style: f.style } : p,
    ),
  };
}

export function withoutPet(save: SaveFile, id: string): SaveFile {
  return { ...save, pets: save.pets.filter((p) => p.id !== id) };
}
