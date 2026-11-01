import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newPairings } from '../../src/brain/learning';
import { serialise, type SaveFile } from '../../src/brain/save';
import type { Pet } from '../../src/brain/types';
import { TUNING } from '../../src/brain/tuning';
import { Autosave, interpretSave, planChange, SAVE_DELAY_MS } from '../../src/overlay/persistence';

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

describe('planChange', () => {
  const payload = (pets: Pet[], kind: 'add' | 'edit' | 'rehome', id: string) => ({
    save: save(pets),
    change: { kind, id },
  });

  it('adds only the named new pet', () => {
    const action = planChange([pet('a')], payload([pet('a'), pet('b')], 'add', 'b'));
    expect(action).toEqual({ kind: 'add', pet: pet('b') });
  });

  it('an edit payload missing another pet does not remove it', () => {
    const current = [pet('a'), pet('b'), pet('c')];
    const action = planChange(current, payload([pet('a', { name: 'Ash' })], 'edit', 'a'));
    expect(action).toEqual({ kind: 'edit', pet: pet('a', { name: 'Ash' }) });
  });

  it('rehomes only the named pet', () => {
    const action = planChange([pet('a'), pet('b')], payload([], 'rehome', 'b'));
    expect(action).toEqual({ kind: 'rehome', id: 'b' });
  });

  it('ignores changes that do not fit the running pets', () => {
    expect(planChange([pet('a')], payload([pet('a')], 'add', 'a'))).toBeNull();
    expect(planChange([pet('a')], payload([pet('b')], 'edit', 'b'))).toBeNull();
    expect(planChange([pet('a')], payload([], 'rehome', 'z'))).toBeNull();
    expect(planChange([pet('a')], payload([], 'add', 'b'))).toBeNull();
  });

  it('never adds beyond the pet limit', () => {
    const six = ['1', '2', '3', '4', '5', '6'].map((id) => pet(id));
    expect(planChange(six, payload([pet('7')], 'add', '7'))).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(planChange([pet('a')], null)).toBeNull();
    expect(planChange([pet('a')], { save: save([]), change: { kind: 'eat', id: 'a' } })).toBeNull();
    expect(planChange([pet('a')], { save: { version: 2 }, change: { kind: 'rehome', id: 'a' } })).toBeNull();
  });
});

describe('Autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const drifted = (s: SaveFile): SaveFile => ({
    ...s,
    pets: s.pets.map((p) => ({ ...p, mood: { ...p.mood, affection: p.mood.affection + 1 } })),
  });

  it('writes nothing while nothing changes', async () => {
    const state = save([pet('a')]);
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => state, write, state);
    auto.start();
    await vi.advanceTimersByTimeAsync(TUNING.moodSaveSeconds * 3000);
    expect(write).not.toHaveBeenCalled();
    auto.stop();
  });

  it('saves mood drift at most every moodSaveSeconds', async () => {
    let state = save([pet('a')]);
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => state, write, state);
    auto.start();
    const drift = setInterval(() => {
      state = drifted(state);
    }, 100);
    await vi.advanceTimersByTimeAsync(TUNING.moodSaveSeconds * 1000 - SAVE_DELAY_MS);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(TUNING.moodSaveSeconds * 1000 - SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(2);
    clearInterval(drift);
    auto.stop();
  });

  it('writes an added pet, a rename or a settings change straight away', async () => {
    const start = save([pet('a')]);
    let state = start;
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => state, write, start);
    auto.start();

    state = save([pet('a'), pet('b')]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);

    state = save([pet('a', { name: 'Ash' }), pet('b')]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(2);

    state = save([pet('a', { name: 'Ash' }), pet('b')], true);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenLastCalledWith(serialise(state));
    auto.stop();
  });

  it('a rename after unsaved drift is written straight away, drift included', async () => {
    let state = save([pet('a')]);
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => state, write, state);
    auto.start();
    state = drifted(state);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2);
    expect(write).not.toHaveBeenCalled();
    state = { ...state, pets: state.pets.map((p) => ({ ...p, name: 'Ash' })) };
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(serialise(state));
    auto.stop();
  });

  it('flush writes drift at once', async () => {
    const start = save([pet('b')]);
    const write = vi.fn(() => Promise.resolve());
    const auto = new Autosave(() => drifted(start), write, start);
    await auto.flush();
    expect(write).toHaveBeenCalledWith(serialise(drifted(start)));
  });

  it('retries after a failed write', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    const auto = new Autosave(() => save([pet('c')]), write, null);
    await auto.flush();
    await auto.flush();
    expect(write).toHaveBeenCalledTimes(2);
  });
});
