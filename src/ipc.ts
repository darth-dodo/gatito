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

export const ipc = {
  getFloor(): Promise<Floor> {
    return invoke<Floor>("get_floor");
  },
  onFloorChanged(cb: (floor: Floor) => void): Promise<UnlistenFn> {
    return listen<Floor>("floor-changed", (event) => cb(event.payload));
  },
};
