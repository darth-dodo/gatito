import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SaveFile } from "./brain/save";

/** Usable screen area in logical pixels, relative to the overlay window. */
export interface Floor {
  x: number;
  y: number;
  width: number;
  /** Bottom edge of the usable area (above the Dock). */
  bottom: number;
}

/** Rectangle in logical pixels, relative to the overlay window. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Point in logical pixels, relative to the overlay window. */
export interface Point {
  x: number;
  y: number;
}

export const ipc = {
  getFloor(): Promise<Floor> {
    return invoke<Floor>("get_floor");
  },
  /** Raw save text, or null when no save exists yet. */
  loadSave(): Promise<string | null> {
    return invoke<string | null>("load_save");
  },
  writeSave(text: string): Promise<void> {
    return invoke<void>("write_save", { text });
  },
  /** Move a save that failed to parse aside as windowsill.json.bad. */
  quarantineSave(): Promise<void> {
    return invoke<void>("quarantine_save");
  },
  /** Replace the pet hit boxes; the overlay only catches clicks inside them. */
  setHitboxes(rects: Rect[]): Promise<void> {
    return invoke<void>("set_hitboxes", { boxes: rects });
  },
  /** Open (or bring forward) the New pet window; with an id it edits that pet. */
  openCreateWindow(petId: string | null): Promise<void> {
    return invoke<void>("open_create_window", { petId });
  },
  /** The pet the New pet window was opened for, or null for a new pet. */
  createWindowPet(): Promise<string | null> {
    return invoke<string | null>("create_window_pet");
  },
  /** Tell Rust the save is flushed so the app can exit. */
  quitReady(): Promise<void> {
    return invoke<void>("quit_ready");
  },
  onQuitRequested(cb: () => void): Promise<UnlistenFn> {
    return listen("quit-requested", () => cb());
  },
  /** The New pet window opened for a different pet. */
  onCreateTarget(cb: () => void): Promise<UnlistenFn> {
    return listen("create-target", () => cb());
  },
  /** The full save after creating, editing or rehoming a pet. */
  emitPetsChanged(save: SaveFile): Promise<void> {
    return emit("pets-changed", save);
  },
  onPetsChanged(cb: (save: SaveFile) => void): Promise<UnlistenFn> {
    return listen<SaveFile>("pets-changed", (event) => cb(event.payload));
  },
  onCursor(cb: (p: Point) => void): Promise<UnlistenFn> {
    return listen<Point>("cursor", (event) => cb(event.payload));
  },
  onFloorChanged(cb: (floor: Floor) => void): Promise<UnlistenFn> {
    return listen<Floor>("floor-changed", (event) => cb(event.payload));
  },
};
