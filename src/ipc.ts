import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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
  onCursor(cb: (p: Point) => void): Promise<UnlistenFn> {
    return listen<Point>("cursor", (event) => cb(event.payload));
  },
  onFloorChanged(cb: (floor: Floor) => void): Promise<UnlistenFn> {
    return listen<Floor>("floor-changed", (event) => cb(event.payload));
  },
  /** Seconds since the user's last keyboard or mouse input (0 if unknown). */
  userIdleSeconds(): Promise<number> {
    return invoke<number>("user_idle_seconds");
  },
  /** Rebuild the menu bar menu's per-pet submenus. */
  setMenuPets(pets: { id: string; name: string }[]): Promise<void> {
    return invoke<void>("set_menu_pets", { pets });
  },
  onNapTime(cb: (on: boolean) => void): Promise<UnlistenFn> {
    return listen<{ on: boolean }>("nap-time", (event) => cb(event.payload.on));
  },
  onCallOver(cb: (id: string) => void): Promise<UnlistenFn> {
    return listen<{ id: string }>("call-over", (event) => cb(event.payload.id));
  },
  /** Menu "New pet…"; a later step opens Task 12's window. */
  onMenuNewPet(cb: () => void): Promise<UnlistenFn> {
    return listen("menu-new-pet", () => cb());
  },
  onMenuEditPet(cb: (id: string) => void): Promise<UnlistenFn> {
    return listen<{ id: string }>("menu-edit-pet", (event) => cb(event.payload.id));
  },
  onMenuRehomePet(cb: (id: string) => void): Promise<UnlistenFn> {
    return listen<{ id: string }>("menu-rehome-pet", (event) => cb(event.payload.id));
  },
};
