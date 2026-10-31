import { parseSave, serialise, type SaveFile } from '../brain/save';
import { TUNING } from '../brain/tuning';
import type { Pet } from '../brain/types';

/** A changed state reaches disk within this long. */
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

export interface PetDiff {
  added: Pet[];
  removed: string[];
  /** Incoming pets whose name, colour or style changed. */
  updated: Pet[];
}

/**
 * Compares the running pets with a `pets-changed` save from the New pet window.
 * Mood and learning are ignored: the overlay owns them.
 */
export function diffPets(current: readonly Pet[], incoming: readonly Pet[]): PetDiff {
  const byId = new Map(current.map((p) => [p.id, p]));
  const incomingIds = new Set(incoming.map((p) => p.id));
  const removed = current.filter((p) => !incomingIds.has(p.id)).map((p) => p.id);
  const updated: Pet[] = [];
  const added: Pet[] = [];
  let count = current.length - removed.length;
  for (const p of incoming) {
    const old = byId.get(p.id);
    if (old) {
      if (old.name !== p.name || old.colour !== p.colour || old.style !== p.style) updated.push(p);
    } else if (count < TUNING.maxCats) {
      added.push(p);
      count += 1;
    }
  }
  return { added, removed, updated };
}

/** Writes the save when it changed, at most every SAVE_DELAY_MS, and at once on flush. */
export class Autosave {
  private timer: ReturnType<typeof setInterval> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly snapshot: () => SaveFile,
    private readonly write: (text: string) => Promise<void>,
    /** The text already on disk, so an unchanged state is not rewritten. */
    private lastWritten: string | null,
  ) {}

  start(): void {
    this.timer ??= setInterval(() => void this.flush(), SAVE_DELAY_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Writes now if the state changed; writes never overlap. */
  flush(): Promise<void> {
    this.writing = this.writing.then(async () => {
      const text = serialise(this.snapshot());
      if (text === this.lastWritten) return;
      try {
        await this.write(text);
        this.lastWritten = text;
      } catch (e) {
        console.error('Could not save pets', e);
      }
    });
    return this.writing;
  }
}
