import { describe, expect, it } from 'vitest';
import { newPairings } from '../../src/brain/learning';
import { parseSave, serialise, type SaveFile } from '../../src/brain/save';
import type { Pet } from '../../src/brain/types';

function pet(id: string, over: Partial<Pet> = {}): Pet {
  return {
    id,
    species: 'cat',
    name: `Cat ${id}`,
    style: 'pixel',
    colour: 'calico',
    personality: 'curious',
    mood: { affection: 40, energy: 60 },
    pairings: newPairings(),
    learned: { whistle: 'spin' },
    ...over,
  };
}

function save(pets: Pet[]): SaveFile {
  return { version: 1, pets, settings: { napTime: false } };
}

function reason(text: string): string {
  const r = parseSave(text);
  if (r.ok) throw new Error('expected failure');
  return r.reason;
}

function mutated(fn: (p: Record<string, any>) => void): string {
  const obj = JSON.parse(serialise(save([pet('a')])));
  fn(obj.pets[0]);
  return JSON.stringify(obj);
}

describe('save file', () => {
  it('round trips two cats identically', () => {
    const s = save([pet('a'), pet('b', { colour: 'black', learned: {} })]);
    const r = parseSave(serialise(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.save).toEqual(s);
    if (r.ok) expect(serialise(r.save)).toBe(serialise(s));
  });

  it('round trips cats and dogs together, with coats both species share', () => {
    const s = save([
      pet('a'),
      pet('b', { species: 'dog', colour: 'golden' }),
      pet('c', { species: 'dog', colour: 'black', personality: 'social' }),
      pet('d', { species: 'dog', colour: 'husky-grey', learned: {} }),
    ]);
    const r = parseSave(serialise(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.save).toEqual(s);
  });

  it('accepts an empty pet list', () => {
    expect(parseSave(serialise(save([]))).ok).toBe(true);
  });

  it.each([
    ['empty text', ''],
    ['truncated json', '{'],
    ['json null', 'null'],
    ['an array', '[]'],
    ['wrong version', JSON.stringify({ ...save([]), version: 2 })],
    ['missing version', JSON.stringify({ pets: [], settings: { napTime: false } })],
    ['missing settings', JSON.stringify({ version: 1, pets: [] })],
    ['non-boolean napTime', JSON.stringify({ version: 1, pets: [], settings: { napTime: 1 } })],
    ['pets not an array', JSON.stringify({ version: 1, pets: {}, settings: { napTime: false } })],
  ])('rejects %s without throwing', (_n, text) => {
    expect(parseSave(text).ok).toBe(false);
  });

  it('rejects more than 6 pets', () => {
    const pets = Array.from({ length: 7 }, (_, i) => pet(`p${i}`));
    expect(parseSave(serialise(save(pets))).ok).toBe(false);
    expect(parseSave(serialise(save(pets.slice(0, 6)))).ok).toBe(true);
  });

  it.each([
    ['unknown colour', (p: Record<string, any>) => (p.colour = 'purple')],
    ['unknown style', (p: Record<string, any>) => (p.style = 'neon')],
    ['unknown personality', (p: Record<string, any>) => (p.personality = 'grumpy')],
    ['unknown species', (p: Record<string, any>) => (p.species = 'rabbit')],
    ['a dog in a cat-only coat', (p: Record<string, any>) => (p.species = 'dog')],
    ['a cat in a dog-only coat', (p: Record<string, any>) => (p.colour = 'golden')],
    ['missing id', (p: Record<string, any>) => delete p.id],
    ['numeric id', (p: Record<string, any>) => (p.id = 5)],
    ['missing name', (p: Record<string, any>) => delete p.name],
    ['numeric name', (p: Record<string, any>) => (p.name = 7)],
    ['meter above 100', (p: Record<string, any>) => (p.mood.affection = 150)],
    ['meter below 0', (p: Record<string, any>) => (p.mood.energy = -1)],
    ['string meter', (p: Record<string, any>) => (p.mood.energy = '50')],
    ['null meter', (p: Record<string, any>) => (p.mood.energy = null)],
    ['zero pairing', (p: Record<string, any>) => (p.pairings.clap.spin = 0)],
    ['negative pairing', (p: Record<string, any>) => (p.pairings.clap.spin = -2)],
    ['string pairing', (p: Record<string, any>) => (p.pairings.clap.spin = '1')],
    ['null pairing (Infinity)', (p: Record<string, any>) => (p.pairings.clap.spin = null)],
    ['missing cue in pairings', (p: Record<string, any>) => delete p.pairings.clap],
    ['missing trick in pairings', (p: Record<string, any>) => delete p.pairings.clap['roll-over']],
    ['unknown cue in pairings', (p: Record<string, any>) => (p.pairings.bell = p.pairings.clap)],
    ['unknown trick in pairings', (p: Record<string, any>) => (p.pairings.clap.fly = 1)],
    ['unknown cue in learned', (p: Record<string, any>) => (p.learned = { bell: 'spin' })],
    ['unknown trick in learned', (p: Record<string, any>) => (p.learned = { clap: 'fly' })],
  ])('rejects %s', (_n, fn) => {
    expect(parseSave(mutated(fn)).ok).toBe(false);
  });

  it('rejects a pairing of Infinity written as a huge literal', () => {
    const text = serialise(save([pet('a')])).replace('"spin":1', '"spin":1e999');
    expect(parseSave(text).ok).toBe(false);
  });

  it('gives a reason string', () => {
    expect(reason('{')).toMatch(/json/i);
    expect(reason(mutated((p) => (p.colour = 'purple')))).toMatch(/colour/);
    expect(reason(mutated((p) => (p.species = 'dog')))).toBe('unknown colour for a dog');
  });
});

describe('celebrated field', () => {
  it('round trips an optional celebrated map', () => {
    const p = pet('a', { celebrated: { whistle: 'spin', clap: 'sit-up' } });
    const r = parseSave(serialise(save([p])));
    expect(r.ok && r.save.pets[0]).toEqual(p);
  });

  it('accepts saves without celebrated', () => {
    const r = parseSave(serialise(save([pet('a')])));
    expect(r.ok && r.save.pets[0]!.celebrated).toBeUndefined();
  });

  it('rejects an unknown celebrated cue or trick', () => {
    expect(reason(mutated((p) => { p.celebrated = { bark: 'spin' }; }))).toMatch(/celebrated/);
    expect(reason(mutated((p) => { p.celebrated = { whistle: 'fly' }; }))).toMatch(/trick/);
    expect(reason(mutated((p) => { p.celebrated = 3; }))).toMatch(/celebrated/);
  });
});
