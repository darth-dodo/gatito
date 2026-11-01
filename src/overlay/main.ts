import { ipc } from '../ipc';
import { boot } from './boot';
import { startPets, type PetHost } from './app';
import { createWindowTarget, menuPets, withNapTime, type MenuRequest } from './menu';
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
  let settings = loaded.save.settings;

  const running = await startPets(tauriHost, {
    pets: loaded.save.pets,
    napTime: settings.napTime,
    container: document.body,
  });
  const autosave = new Autosave(
    () => ({ version: 1, pets: running.pets(), settings }),
    (t) => ipc.writeSave(t),
    loaded.quarantine || text === null ? null : loaded.save,
  );
  autosave.start();
  const refreshMenu = (): Promise<void> => ipc.setMenuPets(menuPets(running.pets()));
  const logError =
    (what: string) =>
    (e: unknown): void =>
      console.error(what, e);

  const wirePetsChanged = async (): Promise<void> => {
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
        .finally(() => {
          autosave.flush().catch(logError('Could not save'));
          refreshMenu().catch(logError('Could not refresh the menu'));
        });
    });
  };

  const openCreate = (request: MenuRequest): void => {
    ipc.openCreateWindow(createWindowTarget(request)).catch(logError('Could not open the pet window'));
  };
  const wireQuit = async (): Promise<void> => {
    await ipc.onQuitRequested(() => {
      autosave.stop();
      void autosave
        .flush()
        .catch(logError('Could not save on quit'))
        .finally(() => ipc.quitReady().catch(logError('Could not confirm quit')));
    });
  };

  const wireMenu = async (): Promise<void> => {
    await Promise.all([
      ipc.onNapTime((on) => {
        running.setNapTime(on);
        settings = withNapTime(settings, on);
        autosave.flush().catch(logError('Could not save'));
      }),
      ipc.onCallOver((id) => running.callOver(id)),
      ipc.onMenuNewPet(() => openCreate({ kind: 'new-pet' })),
      ipc.onMenuEditPet((id) => openCreate({ kind: 'edit-pet', id })),
      ipc.onMenuRehomePet((id) => openCreate({ kind: 'rehome-pet', id })),
    ]);
  };

  // Failed steps are logged and boot carries on; the first New pet window must still open.
  await boot(
    wireQuit,
    [
      wirePetsChanged,
      wireMenu,
      () => ipc.setNapTime(settings.napTime),
      refreshMenu,
      async () => {
        if (loaded.firstRun) openCreate({ kind: 'new-pet' });
      },
    ],
    logError('Boot step failed'),
  );
}

main().catch((e: unknown) => console.error('Windowsill failed to start', e));
