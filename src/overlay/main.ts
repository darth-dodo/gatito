import { ipc, type Floor } from "../ipc";

const SQUARE = 64;

const square = document.createElement("div");
square.style.cssText = `position:fixed;width:${SQUARE}px;height:${SQUARE}px;background:#ff8a1f;`;
document.body.appendChild(square);

function place(floor: Floor): void {
  square.style.left = `${floor.x}px`;
  square.style.top = `${floor.bottom - SQUARE}px`;
}

void ipc.getFloor().then(place);
void ipc.onFloorChanged(place);
