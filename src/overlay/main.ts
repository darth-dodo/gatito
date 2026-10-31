import { ipc } from '../ipc';
import { parseSave } from '../brain/save';
import { startPets, type PetHost } from './app';
import { Autosave, diffPets, interpretSave } from './persistence';

/** The Tauri overlay: floor, cursor and hit boxes come from Rust. */
const tauriHost: PetHost = {
  getFloor: () => ipc.getFloor(),
  onFloorChanged: (cb) => ipc.onFloorChanged(cb),
  onCursor: (cb) => ipc.onCursor(cb),
  setHitboxes: (rects) => ipc.setHitboxes(rects),
  /** Task 14 reads the OS idle time here. */
  userIdleSeconds: () => 0,
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
    loaded.quarantine ? null : text,
  );
  autosave.start();

  await ipc.onPetsChanged((incoming) => {
    // The payload crosses a process boundary; check it like a file from disk.
    const parsed = parseSave(JSON.stringify(incoming));
    if (!parsed.ok) return;
    const diff = diffPets(running.pets(), parsed.save.pets);
    for (const id of diff.removed) running.removePet(id);
    void Promise.all([
      ...diff.updated.map((p) => running.updatePet(p)),
      ...diff.added.map((p) => running.addPet(p)),
    ]).then(() => autosave.flush());
  });

  await ipc.onQuitRequested(() => {
    autosave.stop();
    void autosave.flush().finally(() => ipc.quitReady());
  });

  if (loaded.firstRun) await ipc.openCreateWindow(null);
}

void main();
