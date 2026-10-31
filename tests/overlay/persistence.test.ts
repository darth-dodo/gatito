import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newPairings } from '../../src/brain/learning';
import { serialise, type SaveFile } from '../../src/brain/save';
import type { Pet } from '../../src/brain/types';
import { Autosave, diffPets, interpretSave, SAVE_DELAY_MS } from '../../src/overlay/persistence';

function pet(id: string, over: Partial<Pet> = {}): Pet {
  return {
    id,
    species: 'cat',
    name: `Cat ${id}`,
    style: 'pixel',
    colour: 'black',
    personality: 'cosy',
    mood: { affection: 50, energy: 50 },
    pairings: newPairings(),
    learned: {},
    ...over,
  };
}
const save = (pets: Pet[], napTime = false): SaveFile => ({ version: 1, pets, settings: { napTime } });

describe('interpretSave', () => {
  it('no file is a first run with an empty save', () => {
    expect(interpretSave(null)).toEqual({ save: save([]), quarantine: false, firstRun: true });
  });

  it('a good file loads its pets', () => {
    const s = save([pet('a')], true);
    expect(interpretSave(serialise(s))).toEqual({ save: s, quarantine: false, firstRun: false });
  });

  it('a good file with no pets is a first run', () => {
    expect(interpretSave(serialise(save([]))).firstRun).toBe(true);
  });

  it('a bad file is quarantined and treated as a first run', () => {
    const r = interpretSave('{not json');
    expect(r.quarantine).toBe(true);
    expect(r.firstRun).toBe(true);
    expect(r.save).toEqual(save([]));
  });
});

describe('diffPets', () => {
  it('finds added, removed and renamed or recoloured pets', () => {
    const current = [pet('a'), pet('b'), pet('c')];
    const incoming = [pet('a'), pet('c', { name: 'Cleo', colour: 'grey' }), pet('d')];
    const d = diffPets(current, incoming);
    expect(d.added.map((p) => p.id)).toEqual(['d']);
    expect(d.removed).toEqual(['b']);
    expect(d.updated.map((p) => p.id)).toEqual(['c']);
  });

  it('ignores mood differences, which the overlay owns', () => {
    const d = diffPets([pet('a')], [pet('a', { mood: { affection: 1, energy: 1 } })]);
    expect(d).toEqual({ added: [], removed: [], updated: [] });
  });

  it('never adds beyond the pet limit', () => {
    const current = ['1', '2', '3', '4', '5'].map((id) => pet(id));
    const d = diffPets(current, [...current, pet('6'), pet('7')]);
    expect(d.added.map((p) => p.id)).toEqual(['6']);
  });
});

describe('Autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a changed state within the delay, and nothing when unchanged', async () => {
    let state = save([pet('a')]);
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => state, write, serialise(state));
    auto.start();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3);
    expect(write).not.toHaveBeenCalled();

    state = save([pet('a', { mood: { affection: 51, energy: 50 } })]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(serialise(state));

    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 3);
    expect(write).toHaveBeenCalledTimes(1);
    auto.stop();
  });

  it('flush writes at once', async () => {
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => save([pet('b')]), write, null);
    await auto.flush();
    expect(write).toHaveBeenCalledWith(serialise(save([pet('b')])));
  });

  it('retries after a failed write', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    const auto = new Autosave(() => save([pet('c')]), write, null);
    await auto.flush();
    await auto.flush();
    expect(write).toHaveBeenCalledTimes(2);
  });
});
