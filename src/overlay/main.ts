import { ipc } from '../ipc';
import { startPets, type PetHost } from './app';
import { Autosave, interpretSave, planChange } from './persistence';

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

async function main(): Promise<void> {
  const text = await ipc.loadSave();
  const loaded = interpretSave(text);
  if (loaded.quarantine) {
    console.warn('Save file could not be read; moved aside as windowsill.json.bad');
    await ipc.quarantineSave();
  }
  const settings = loaded.save.settings;

  const running = await startPets(tauriHost, { pets: loaded.save.pets, container: document.body });
  const autosave = new Autosave(
    () => ({ version: 1, pets: running.pets(), settings }),
    (t) => ipc.writeSave(t),
    loaded.quarantine || text === null ? null : loaded.save,
  );
  autosave.start();

  await ipc.onPetsChanged((payload) => {
    // Apply only the one change the form made; never remove a pet for being absent.
    const action = planChange(running.pets(), payload);
    if (!action) return;
    let applied: Promise<void> = Promise.resolve();
    if (action.kind === 'rehome') running.removePet(action.id);
    else if (action.kind === 'edit') applied = running.updatePet(action.pet);
    else applied = running.addPet(action.pet);
    void applied
      .catch((e: unknown) => console.error('Could not apply the pet change', e))
      .finally(() => autosave.flush());
  });

  await Promise.all([
    ipc.onNapTime((on) => running.setNapTime(on)),
    ipc.onCallOver((id) => running.callOver(id)),
  ]);
  await ipc.setMenuPets(running.pets().map((p) => ({ id: p.id, name: p.name })));

  await ipc.onQuitRequested(() => {
    autosave.stop();
    void autosave.flush().finally(() => ipc.quitReady());
  });

  if (loaded.firstRun) await ipc.openCreateWindow(null);
}

void main();
