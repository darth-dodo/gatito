import type { SaveFile } from '../brain/save';
import type { Pet } from '../brain/types';

/** A menu bar click that opens the New pet window. */
export type MenuRequest =
  | { kind: 'new-pet' }
  | { kind: 'edit-pet'; id: string }
  | { kind: 'rehome-pet'; id: string };

/** How the New pet window opens: for a pet (edit) or none (new), with the rehome dialog up or not. */
export interface CreateWindowTarget {
  petId: string | null;
  rehome: boolean;
}

/** Maps a menu click to the window it opens. */
export function createWindowTarget(request: MenuRequest): CreateWindowTarget {
  switch (request.kind) {
    case 'new-pet':
      return { petId: null, rehome: false };
    case 'edit-pet':
      return { petId: request.id, rehome: false };
    case 'rehome-pet':
      return { petId: request.id, rehome: true };
  }
}

/** A pet as the menu lists it. */
export interface MenuPet {
  id: string;
  name: string;
}

/** The per-pet submenus, in the order the pets run. */
export function menuPets(pets: readonly Pet[]): MenuPet[] {
  return pets.map((p) => ({ id: p.id, name: p.name }));
}

/** Settings with Nap time set to `on`; the rest unchanged. */
export function withNapTime(settings: SaveFile['settings'], on: boolean): SaveFile['settings'] {
  return { ...settings, napTime: on };
}
