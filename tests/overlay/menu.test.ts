import { describe, expect, it } from 'vitest';
import { newPairings } from '../../src/brain/learning';
import type { Pet } from '../../src/brain/types';
import { createWindowTarget, menuPets, withNapTime } from '../../src/overlay/menu';

function pet(id: string, name: string): Pet {
  return {
    id,
    name,
    species: 'cat',
    colour: 'black',
    style: 'pixel',
    personality: 'curious',
    mood: { affection: 60, energy: 80 },
    pairings: newPairings(),
    learned: {},
  };
}

describe('menu bar events', () => {
  it('New pet opens the window with no pet', () => {
    expect(createWindowTarget({ kind: 'new-pet' })).toEqual({ petId: null, rehome: false });
  });

  it('Edit opens the window for that pet', () => {
    expect(createWindowTarget({ kind: 'edit-pet', id: 'mochi' })).toEqual({ petId: 'mochi', rehome: false });
  });

  it('Rehome opens the window for that pet on the confirmation', () => {
    expect(createWindowTarget({ kind: 'rehome-pet', id: 'mochi' })).toEqual({ petId: 'mochi', rehome: true });
  });

  it('lists every running pet by id and name, in order', () => {
    expect(menuPets([pet('a', 'Mochi'), pet('b', 'Moon')])).toEqual([
      { id: 'a', name: 'Mochi' },
      { id: 'b', name: 'Moon' },
    ]);
    expect(menuPets([])).toEqual([]);
  });

  it('toggling Nap time changes only that setting and leaves the old object alone', () => {
    const off = { napTime: false };
    const on = withNapTime(off, true);
    expect(on).toEqual({ napTime: true });
    expect(off).toEqual({ napTime: false });
    expect(withNapTime(on, false)).toEqual({ napTime: false });
  });
});
