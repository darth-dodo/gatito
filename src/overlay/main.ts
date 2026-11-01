import { ipc } from '../ipc';
import { newPairings } from '../brain/learning';
import type { Pet } from '../brain/types';
import { startPets, type PetHost } from './app';

/** How often the OS idle time is read. */
const IDLE_POLL_MS = 5000;

let userIdle = 0;
function pollIdle(): void {
  ipc.userIdleSeconds().then((s) => { userIdle = s; }, () => { userIdle = 0; });
}
pollIdle();
setInterval(pollIdle, IDLE_POLL_MS);

/** The Tauri overlay: floor, cursor, idle time and hit boxes come from Rust. */
const tauriHost: PetHost = {
  getFloor: () => ipc.getFloor(),
  onFloorChanged: (cb) => ipc.onFloorChanged(cb),
  onCursor: (cb) => ipc.onCursor(cb),
  setHitboxes: (rects) => ipc.setHitboxes(rects),
  userIdleSeconds: () => userIdle,
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

async function boot(): Promise<void> {
  const pets = [testPet()];
  const controls = await startPets(tauriHost, { pets, container: document.body });
  // Nap time is kept in memory for now; Task 12 persists it in settings.
  await Promise.all([
    ipc.onNapTime((on) => controls.setNapTime(on)),
    ipc.onCallOver((id) => controls.callOver(id)),
  ]);
  // Task 12 calls this again whenever pets change.
  await ipc.setMenuPets(pets.map((p) => ({ id: p.id, name: p.name })));
}

void boot();
