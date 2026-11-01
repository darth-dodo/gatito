import { describe, expect, it } from 'vitest';
import { newPairings } from '../../src/brain/learning';
import type { SaveFile } from '../../src/brain/save';
import type { Pet } from '../../src/brain/types';
import {
  LIMIT_NOTE,
  colourOptions,
  pickColour,
  formState,
  newPet,
  PERSONALITY_OPTIONS,
  SPECIES_OPTIONS,
  STYLE_OPTIONS,
  withEdit,
  withNewPet,
  withoutPet,
} from '../../src/create/form';

function pet(id: string, over: Partial<Pet> = {}): Pet {
  return {
    id,
    species: 'cat',
    name: `Cat ${id}`,
    style: 'pixel',
    colour: 'black',
    personality: 'curious',
    mood: { affection: 30, energy: 40 },
    pairings: newPairings(),
    learned: { clap: 'spin' },
    ...over,
  };
}

const six = ['1', '2', '3', '4', '5', '6'].map((id) => pet(id));
const save = (pets: Pet[]): SaveFile => ({ version: 1, pets, settings: { napTime: true } });

describe('formState', () => {
  it('lets a new cat be created below the limit', () => {
    const s = formState({ pets: six.slice(0, 5), editing: null, name: 'Mochi' });
    expect(s.mode).toBe('new');
    expect(s.canSubmit).toBe(true);
    expect(s.limitNote).toBeNull();
  });

  it('the seventh cat cannot be created', () => {
    const s = formState({ pets: six, editing: null, name: 'Mochi' });
    expect(s.canSubmit).toBe(false);
    expect(s.limitNote).toBe('6 pets is the limit');
    expect(LIMIT_NOTE).toBe('6 pets is the limit');
  });

  it('editing at the limit is still allowed', () => {
    const s = formState({ pets: six, editing: six[0]!, name: 'Mochi' });
    expect(s.mode).toBe('edit');
    expect(s.canSubmit).toBe(true);
    expect(s.limitNote).toBeNull();
  });

  it('personality and species are read-only when editing, not when creating', () => {
    expect(formState({ pets: [], editing: six[0]!, name: 'A' }).personalityReadOnly).toBe(true);
    expect(formState({ pets: [], editing: six[0]!, name: 'A' }).speciesReadOnly).toBe(true);
    expect(formState({ pets: [], editing: null, name: 'A' }).personalityReadOnly).toBe(false);
  });

  it('an invalid name blocks submit and explains why', () => {
    const empty = formState({ pets: [], editing: null, name: '  ' });
    expect(empty.canSubmit).toBe(false);
    expect(empty.nameError).toBe('Every pet needs a name');
    const long = formState({ pets: [], editing: null, name: 'a'.repeat(21) });
    expect(long.canSubmit).toBe(false);
    expect(long.nameError).toBe('Up to 20 characters');
  });

  it('a name shared with another cat is fine', () => {
    const s = formState({ pets: [pet('1', { name: 'Mochi' })], editing: null, name: 'Mochi' });
    expect(s.canSubmit).toBe(true);
    expect(s.nameError).toBeNull();
  });
});

describe('options', () => {
  it('offers Cat and Dog', () => {
    expect(SPECIES_OPTIONS.filter((o) => o.enabled).map((o) => o.label)).toEqual(['Cat', 'Dog']);
  });

  it('only Pixel is enabled; other styles are coming soon', () => {
    expect(STYLE_OPTIONS.filter((o) => o.enabled).map((o) => o.value)).toEqual(['pixel']);
    for (const o of STYLE_OPTIONS.filter((x) => !x.enabled)) expect(o.note).toBe('coming soon');
  });

  it('offers only coats whose sprite sheet exists', () => {
    const opts = colourOptions('cat', (c) => c === 'black' || c === 'grey');
    expect(opts.filter((o) => o.enabled).map((o) => o.value)).toEqual(['black', 'grey']);
    expect(opts.find((o) => o.value === 'siamese')).toMatchObject({ enabled: false, note: 'art coming' });
    expect(opts.find((o) => o.value === 'orange-tabby')?.label).toBe('Orange tabby');
  });

  it('lists each species its own coats', () => {
    const dog = colourOptions('dog', () => true);
    expect(dog.map((o) => o.label)).toEqual(['Golden', 'Black', 'White', 'Brown', 'Spotted', 'Tricolour', 'Husky grey']);
    expect(colourOptions('cat', () => true).map((o) => o.value)).not.toContain('golden');
  });

  it('keeps a coat both species share when switching species, else picks the first with art', () => {
    const dog = colourOptions('dog', (c) => c !== 'spotted');
    expect(pickColour(dog, 'black')).toBe('black');
    expect(pickColour(dog, 'orange-tabby')).toBe('golden');
    expect(pickColour(dog, 'spotted')).toBe('golden');
    expect(pickColour(dog, null)).toBe('golden');
    expect(pickColour(colourOptions('dog', () => false), 'black')).toBeNull();
  });

  it('lists the four personalities', () => {
    expect(PERSONALITY_OPTIONS.map((o) => o.label)).toEqual(['Cosy', 'Curious', 'Mischievous', 'Social']);
  });
});

describe('save edits', () => {
  it('a new dog is a dog', () => {
    const p = newPet({ species: 'dog', name: 'Biscuit', colour: 'golden', style: 'pixel', personality: 'cosy' }, 'id-2');
    expect(p.species).toBe('dog');
    expect(p.colour).toBe('golden');
  });

  it('a new pet starts at affection 60, energy 80, fresh pairings, nothing learned', () => {
    const p = newPet({ species: 'cat', name: 'Mochi', colour: 'grey', style: 'pixel', personality: 'social' }, 'id-1');
    expect(p).toEqual({
      id: 'id-1',
      species: 'cat',
      name: 'Mochi',
      style: 'pixel',
      colour: 'grey',
      personality: 'social',
      mood: { affection: 60, energy: 80 },
      pairings: newPairings(),
      learned: {},
    });
  });

  it('adds, edits and removes pets, keeping settings', () => {
    const a = pet('a');
    const added = withNewPet(save([a]), pet('b'));
    expect(added.pets.map((p) => p.id)).toEqual(['a', 'b']);
    expect(added.settings.napTime).toBe(true);

    const edited = withEdit(added, 'a', { name: 'Ash', colour: 'grey', style: 'pixel' });
    expect(edited.pets[0]).toEqual({ ...a, name: 'Ash', colour: 'grey' });

    expect(withoutPet(edited, 'a').pets.map((p) => p.id)).toEqual(['b']);
  });

  it('never adds a seventh pet', () => {
    expect(withNewPet(save(six), pet('7')).pets).toHaveLength(6);
  });
});
