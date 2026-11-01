import { Application, UPDATE_PRIORITY, type Spritesheet } from 'pixi.js';
import type { Floor, Point, Rect } from '../ipc';
import { activeSeconds, clampFrameDelta } from '../brain/clock';
import { fade, updateLearned } from '../brain/learning';
import { tickMood } from '../brain/mood';
import { seededRng } from '../brain/rng';
import { TUNING } from '../brain/tuning';
import type { Pet } from '../brain/types';
import { loadAtlas } from '../render/atlas';
import { floatingZs, heartBurst, risingHearts } from '../render/effects';
import { debugEnabled, frameReadout } from '../render/frameStats';
import { CAT_BOX, headTop, rigPose } from '../render/rig';
import { PetStage } from '../render/stage';
import { PetController } from '../sim/controller';
import { NapTime, callOverX } from './napTime';
import { World, type Body, type Box } from '../sim/world';
import { HELD_HITBOX_PAD_PX, InputRouter, cursorEscapedHold } from './input';

/** Hit boxes go to the host at most this often. */
const HITBOX_MIN_INTERVAL_MS = 1000 / 30;
/** Spreads per-pet seeds apart (golden ratio in 32 bits). */
const SEED_STRIDE = 0x9e3779b9;

type Unlisten = () => void;

/** Everything the pet loop needs from the place it runs: the Tauri overlay or the browser demo. */
export interface PetHost {
  getFloor(): Promise<Floor>;
  onFloorChanged(cb: (floor: Floor) => void): Promise<Unlisten>;
  onCursor(cb: (p: Point) => void): Promise<Unlisten>;
  setHitboxes(rects: Rect[]): Promise<void>;
  /** Seconds since the user's last input. */
  userIdleSeconds(): number;
}

export interface PetOptions {
  pets: Pet[];
  /** Fixed seed for every pet's random choices; a fresh one per run when left out. */
  seed?: number;
  /** Multiplies the clamped frame delta for the simulation only. Defaults to 1. */
  timeScale?: number;
  /** Nap time as saved; when on, the pets start hidden. Defaults to off. */
  napTime?: boolean;
  container: HTMLElement;
}

interface Living {
  body: Body;
  controller: PetController;
  /** The coat has walk cycle frames and TUNING.walkMode asks for them. */
  walkFrames: boolean;
}

/** True when TUNING.walkMode asks for walk cycle frames and this coat's sheet has them. */
function usesWalkFrames(atlas: Spritesheet): boolean {
  return TUNING.walkMode === 'frames' && atlas.textures['walk-1'] !== undefined;
}

/** Places pet `index` of `count` evenly along the floor; a lone pet starts in the middle. */
function spawnBody(id: string, floor: Floor, index: number, count: number): Body {
  const s = TUNING.renderScale;
  const width = (CAT_BOX.right - CAT_BOX.left) * s;
  const height = (CAT_BOX.bottom - CAT_BOX.top) * s;
  return {
    id,
    x: floor.x + (floor.width * (index + 1)) / (count + 1) - width / 2,
    y: floor.bottom - height,
    vx: 0,
    vy: 0,
    facing: index % 2 === 0 ? 1 : -1,
    held: false,
    grounded: true,
    width,
    height,
  };
}

/** What a pet shows while Nap time has it curled up. */
function curledAnim(t: number): { name: 'nap'; t: number } {
  return { name: 'nap', t };
}

/** A newcomer drops in from the top of the floor at `x01` (0 to 1) across it, and falls. */
function dropBody(id: string, floor: Floor, x01: number): Body {
  const body = spawnBody(id, floor, 0, 1);
  body.x = floor.x + x01 * Math.max(0, floor.width - body.width);
  body.y = floor.y;
  body.grounded = false;
  return body;
}

/**
 * Sends every pet's rect when any of them moved, throttled. A held pet's rect, padded, goes
 * every frame so the drag keeps the mouse.
 */
function hitboxPusher(
  host: PetHost,
  boxOf: (b: Body) => Box,
): (bodies: readonly Body[], now: number, heldId: string | null) => void {
  let lastKey = '';
  let lastAt = -Infinity;
  return (bodies, now, heldId) => {
    const rects: Rect[] = bodies.map((b) => {
      const pad = b.id === heldId ? HELD_HITBOX_PAD_PX : 0;
      const box = boxOf(b);
      return {
        x: box.x - pad,
        y: box.y - pad,
        width: b.width + 2 * pad,
        height: b.height + 2 * pad,
      };
    });
    const key = JSON.stringify(rects);
    if (key === lastKey || (heldId === null && now - lastAt < HITBOX_MIN_INTERVAL_MS)) return;
    lastKey = key;
    lastAt = now;
    void host.setHitboxes(rects);
  };
}

/** `WINDOWSILL_DEBUG` at build time, injected by vite.config.ts `define`. */
declare const __WINDOWSILL_DEBUG__: string;

/** `localStorage.windowsillDebug`, or null where storage is unavailable. */
function storedDebugFlag(): string | null {
  try {
    return window.localStorage.getItem('windowsillDebug');
  } catch {
    return null;
  }
}

/**
 * Feeds the canvas's button events to the router: press, drag, release and right click. Strokes
 * never come from here; they come from the host cursor (see startPets). The overlay only gets
 * pointer events while the cursor is over a pet hit box; a pet captures the pointer as it lifts
 * so the drag survives fast moves.
 */
function listenPointer(canvas: HTMLCanvasElement, router: InputRouter): Unlisten {
  const off = new AbortController();
  const opts = { signal: off.signal };
  canvas.style.touchAction = 'none';
  canvas.addEventListener(
    'pointermove',
    (e) => {
      // Capture as the pet lifts, so a fast drag keeps every move and the release.
      if (router.pointerMove(e.clientX, e.clientY, e.buttons) === 'lifted') {
        canvas.setPointerCapture(e.pointerId);
      }
    },
    opts,
  );
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      router.pointerDown(e.clientX, e.clientY, e.button);
    },
    opts,
  );
  canvas.addEventListener(
    'pointerup',
    (e) => {
      if (e.button === 0) router.pointerUp(e.clientX, e.clientY, performance.now() / 1000);
      else router.release();
    },
    opts,
  );
  const release = (): void => router.release();
  canvas.addEventListener('pointercancel', release, opts);
  canvas.addEventListener('lostpointercapture', release, opts);
  canvas.addEventListener('pointerleave', () => router.pointerLeave(), opts);
  // The right button belongs to the cue ring, never the browser menu.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
  return () => off.abort();
}

export interface RunningPets {
  stop(): void;
  /** The pets as they are now, moods and learning included. */
  pets(): Pet[];
  /** Adds a pet that drops in from the top of the screen. */
  addPet(pet: Pet): Promise<void>;
  removePet(id: string): void;
  /** Applies a new name, colour or style; mood and learning stay as they are. */
  updatePet(pet: Pet): Promise<void>;
  /** Nap time: the cats curl up and fade out (mood clock stops), or fade back in. */
  setNapTime(on: boolean): void;
  /** Walks the pet to the middle of the screen. */
  callOver(id: string): void;
}

/** Runs the pets (brain, world, controllers and PixiJS stage) inside `container`, fed by `host`. */
export async function startPets(host: PetHost, options: PetOptions): Promise<RunningPets> {
  const timeScale = options.timeScale ?? 1;
  const baseSeed = options.seed ?? Date.now();

  const app = new Application();
  // One canvas pixel per CSS pixel: the full-screen transparent canvas draws about 4x fewer pixels on a
  // Retina display, and `pixelated` keeps the browser's upscale of the pixel art crisp.
  await app.init({
    backgroundAlpha: 0,
    resizeTo: window,
    resolution: 1,
    antialias: false,
    roundPixels: true,
  });
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.style.imageRendering = 'pixelated';
  options.container.appendChild(app.canvas);

  let floor = await host.getFloor();
  let cursor: Point | null = null;
  const world = new World(floor);
  const stage = new PetStage(app);
  const pushHitboxes = hitboxPusher(host, (b) => world.drawnBox(b));
  const pets: Living[] = [];
  const nap = new NapTime(options.napTime ?? false);
  let napT = 0;
  /** Ids being added; removing one before its art loads cancels it. */
  const arriving = new Set<string>();
  let spawned = 0;

  const live = async (pet: Pet, body: Body): Promise<void> => {
    arriving.add(pet.id);
    let atlas: Awaited<ReturnType<typeof loadAtlas>>;
    try {
      atlas = await loadAtlas(pet.species, pet.colour);
    } catch (e) {
      // A failed load must not leave the id stuck, or the pet could never be added again.
      arriving.delete(pet.id);
      throw e;
    }
    if (!arriving.delete(pet.id)) return;
    world.add(body);
    stage.add(pet, atlas);
    const rng = seededRng((baseSeed + spawned++ * SEED_STRIDE) >>> 0);
    pets.push({ body, controller: new PetController(pet, body, rng), walkFrames: usesWalkFrames(atlas) });
  };

  for (const [i, pet] of options.pets.entries()) {
    await live(pet, spawnBody(pet.id, floor, i, options.pets.length));
  }

  /** When each pet was last tapped (performance.now() seconds), for its heart burst. */
  const tappedAt = new Map<string, number>();
  const router = new InputRouter({
    pets,
    world,
    /** Task 13 opens the cue ring here. */
    onCueRequest: () => undefined,
    onTap: (id) => tappedAt.set(id, performance.now() / 1000),
    boxOf: (b) => world.drawnBox(b),
  });
  const offPointer = listenPointer(app.canvas, router);

  const unlisten = await Promise.all([
    // The one source of strokes: the webview never sees plain mouse moves in the real overlay.
    host.onCursor((p) => {
      cursor = p;
      // Curled or hidden pets cannot be stroked.
      if (!nap.curled) router.cursorMove(p.x, p.y, performance.now() / 1000);
    }),
    host.onFloorChanged((f) => {
      floor = f;
      world.setFloor(f);
    }),
  ]);

  const readout = debugEnabled(window.location.search, storedDebugFlag(), __WINDOWSILL_DEBUG__)
    ? frameReadout(document.body)
    : null;

  if (readout) {
    // Brackets each frame's work: before the pets update and after Pixi has drawn them.
    let workStart = 0;
    app.ticker.add(() => (workStart = performance.now()), undefined, UPDATE_PRIORITY.HIGH);
    app.ticker.add(
      (ticker) => {
        const now = performance.now();
        readout(ticker.deltaMS, now - workStart, now);
      },
      undefined,
      UPDATE_PRIORITY.UTILITY,
    );
  }

  app.ticker.add((ticker) => {
    const dt = clampFrameDelta(ticker.deltaMS / 1000) * timeScale;
    const userIdleSeconds = host.userIdleSeconds();
    const active = activeSeconds(dt, { userIdleSeconds, napTime: nap.on });
    const ctx = { cursor, userIdleSeconds, floor };

    nap.update(dt);
    const heldId = router.heldId();
    const held = heldId === null ? undefined : pets.find((p) => p.body.id === heldId);
    // A pet cannot stay in your hand once Nap time hides it.
    if (held && (nap.hidden || cursorEscapedHold(held.body, cursor))) router.release();

    if (!nap.curled) for (const p of pets) p.controller.update(dt, ctx);
    else for (const p of pets) if (!p.body.held) p.body.vx = 0;
    world.step(dt);

    const nowSeconds = performance.now() / 1000;
    for (const { body: b, controller: c, walkFrames } of pets) {
      if (active > 0) {
        c.pet = updateLearned({
          ...c.pet,
          mood: tickMood(c.pet.mood, active, c.activity()),
          pairings: fade(c.pet.pairings, active),
        });
      }
      const { name, t } = nap.curled ? curledAnim(napT) : c.anim();
      const frame = rigPose(name, t, c.pet.mood, { walkFrames });
      stage.setAlpha(c.pet.id, nap.alpha);
      stage.draw(c.pet.id, b, frame, world.drawPosition(b));
      stage.drawZs(c.pet.id, name === 'nap' || name === 'cuddle-nap' ? floatingZs(t, headTop(frame.pose)) : []);
      const tapAge = nowSeconds - (tappedAt.get(c.pet.id) ?? -Infinity);
      stage.drawHearts(c.pet.id, name === 'purr' ? risingHearts(t) : heartBurst(tapAge));
    }
    napT = nap.curled ? napT + dt : 0;
    pushHitboxes(nap.hidden ? [] : world.bodies(), performance.now(), router.heldId());
  });

  return {
    setNapTime: (on) => nap.setOn(on),
    callOver(id) {
      const p = pets.find((q) => q.controller.pet.id === id);
      const x = p ? callOverX(nap, floor, p.body.width) : null;
      if (p && x !== null) p.controller.start({ kind: 'go-to', x });
    },
    stop() {
      offPointer();
      for (const off of unlisten) off();
      app.destroy({ removeView: true }, { children: true });
    },
    pets: () => pets.map((p) => p.controller.pet),
    async addPet(pet) {
      if (arriving.has(pet.id) || pets.some((p) => p.controller.pet.id === pet.id)) return;
      await live(pet, dropBody(pet.id, floor, Math.random()));
    },
    removePet(id) {
      arriving.delete(id);
      const i = pets.findIndex((p) => p.controller.pet.id === id);
      if (i < 0) return;
      world.remove(id);
      stage.remove(id);
      pets.splice(i, 1);
    },
    async updatePet(pet) {
      const find = (): Living | undefined => pets.find((p) => p.controller.pet.id === pet.id);
      const before = find();
      if (!before) return;
      const recoloured = pet.colour !== before.controller.pet.colour;
      const atlas = recoloured ? await loadAtlas(pet.species, pet.colour) : null;
      const living = find();
      if (!living) return;
      const next = { ...living.controller.pet, name: pet.name, colour: pet.colour, style: pet.style };
      if (atlas) {
        stage.add(next, atlas);
        living.walkFrames = usesWalkFrames(atlas);
      }
      living.controller.pet = next;
    },
  };
}
