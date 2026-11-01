import { parseSave, serialise, type SaveFile } from '../brain/save';
import { TUNING } from '../brain/tuning';
import type { Pet } from '../brain/types';

/** How often the autosave checks for changes; membership and name changes reach disk within this. */
export const SAVE_DELAY_MS = 2000;

export interface LoadResult {
  save: SaveFile;
  /** The file on disk could not be read as a save and should be moved aside. */
  quarantine: boolean;
  /** No pets: open New pet on launch. */
  firstRun: boolean;
}

export function emptySave(): SaveFile {
  return { version: 1, pets: [], settings: { napTime: false } };
}

/** What to do with the raw save text (null when there is no file yet). */
export function interpretSave(text: string | null): LoadResult {
  if (text === null) return { save: emptySave(), quarantine: false, firstRun: true };
  const parsed = parseSave(text);
  if (!parsed.ok) return { save: emptySave(), quarantine: true, firstRun: true };
  return { save: parsed.save, quarantine: false, firstRun: parsed.save.pets.length === 0 };
}

export type ChangeKind = 'add' | 'edit' | 'rehome';
const CHANGE_KINDS: readonly string[] = ['add', 'edit', 'rehome'];

/** The `pets-changed` payload: the form's view of the save plus the one change it made. */
export interface PetsChanged {
  save: SaveFile;
  change: { kind: ChangeKind; id: string };
}

/** The single change the overlay applies to its running pets. */
export type ChangeAction = { kind: 'add'; pet: Pet } | { kind: 'edit'; pet: Pet } | { kind: 'rehome'; id: string };

/**
 * Turns a `pets-changed` payload into one change to the running pets, or null when it
 * is malformed or does not fit them. Pets absent from the payload are never removed:
 * only the named rehome removes a pet. Mood and learning stay with the overlay.
 */
export function planChange(current: readonly Pet[], payload: unknown): ChangeAction | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { save, change } = payload as { save?: unknown; change?: unknown };
  if (typeof change !== 'object' || change === null) return null;
  const { kind, id } = change as { kind?: unknown; id?: unknown };
  if (typeof kind !== 'string' || !CHANGE_KINDS.includes(kind) || typeof id !== 'string') return null;
  // The payload crosses a process boundary; check it like a file from disk.
  const parsed = parseSave(JSON.stringify(save ?? null));
  if (!parsed.ok) return null;
  const running = current.some((p) => p.id === id);
  if (kind === 'rehome') return running ? { kind, id } : null;
  const pet = parsed.save.pets.find((p) => p.id === id);
  if (!pet) return null;
  if (kind === 'edit') return running ? { kind, pet } : null;
  return !running && current.length < TUNING.maxCats ? { kind: 'add', pet } : null;
}

/** The save without mood and pairings, which drift on every active frame. */
function structure(s: SaveFile): string {
  return serialise({
    ...s,
    pets: s.pets.map((p) => ({ ...p, mood: { affection: 0, energy: 0 }, pairings: {} as Pet['pairings'] })),
  });
}

/**
 * Checks every SAVE_DELAY_MS. Membership, name, colour, style, learned tricks and
 * settings changes are written at once; mood and pairing drift at most every
 * TUNING.moodSaveSeconds. `flush` writes any change immediately (quit, form changes).
 */
export class Autosave {
  private timer: ReturnType<typeof setInterval> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private lastText: string | null;
  private lastStructure: string | null;
  private lastWriteAt = Date.now();

  constructor(
    private readonly snapshot: () => SaveFile,
    private readonly write: (text: string) => Promise<void>,
    /** The save already on disk, so an unchanged state is not rewritten. */
    onDisk: SaveFile | null,
  ) {
    this.lastText = onDisk ? serialise(onDisk) : null;
    this.lastStructure = onDisk ? structure(onDisk) : null;
  }

  start(): void {
    this.lastWriteAt = Date.now();
    this.timer ??= setInterval(() => void this.save(false), SAVE_DELAY_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Writes now if anything changed; writes never overlap. */
  flush(): Promise<void> {
    return this.save(true);
  }

  private save(force: boolean): Promise<void> {
    this.writing = this.writing.then(async () => {
      const state = this.snapshot();
      const text = serialise(state);
      if (text === this.lastText) return;
      const shape = structure(state);
      const driftDue = Date.now() - this.lastWriteAt >= TUNING.moodSaveSeconds * 1000;
      if (!force && shape === this.lastStructure && !driftDue) return;
      try {
        await this.write(text);
        this.lastText = text;
        this.lastStructure = shape;
        this.lastWriteAt = Date.now();
      } catch (e) {
        console.error('Could not save pets', e);
      }
    });
    return this.writing;
  }
}
