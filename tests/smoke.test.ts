import { describe, expect, it } from "vitest";
import type { Floor } from "../src/ipc";

describe("smoke", () => {
  it("describes the floor as a plain rectangle edge", () => {
    const floor: Floor = { x: 0, y: 25, width: 1440, bottom: 825 };
    expect(floor.bottom).toBeGreaterThan(floor.y);
  });
});
