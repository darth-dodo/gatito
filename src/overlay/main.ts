import { ipc } from '../ipc';
import { newPairings } from '../brain/learning';
import type { Pet } from '../brain/types';
import { startPets, type PetHost } from './app';

/** The Tauri overlay: floor, cursor and hit boxes come from Rust. */
const tauriHost: PetHost = {
  getFloor: () => ipc.getFloor(),
  onFloorChanged: (cb) => ipc.onFloorChanged(cb),
  onCursor: (cb) => ipc.onCursor(cb),
  setHitboxes: (rects) => ipc.setHitboxes(rects),
  /** Task 14 reads the OS idle time here. */
  userIdleSeconds: () => 0,
};

/** The single hard-coded pet until creation and saving arrive (Task 12). */
function testPet(): Pet {
  return {
    id: 'mochi',
    species: 'cat',
    name: 'Mochi',
    style: 'pixel',
    colour: 'orange-tabby',
    personality: 'curious',
    mood: { affection: 60, energy: 70 },
    pairings: newPairings(),
    learned: {},
  };
}

void startPets(tauriHost, { pets: [testPet()], container: document.body });
