/// <reference types="vite/client" />
import { Application, Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import type { Floor, Point, Rect } from '../ipc';
import { activeSeconds, clampFrameDelta } from '../brain/clock';
import { fade, updateLearned } from '../brain/learning';
import { tickMood } from '../brain/mood';
import { seededRng } from '../brain/rng';
import { TUNING } from '../brain/tuning';
import type { Colour, Pet } from '../brain/types';
import { floatingZs } from '../render/effects';
import { CAT_BOX, rigPose } from '../render/rig';
import { PetStage } from '../render/stage';
import { PetController } from '../sim/controller';
import { World, type Body } from '../sim/world';

/** Hit boxes go to the host at most this often. */
const HITBOX_MIN_INTERVAL_MS = 1000 / 30;
/** Spreads per-pet seeds apart (golden ratio in 32 bits). */
const SEED_STRIDE = 0x9e3779b9;

const ATLAS_DATA = import.meta.glob<SpritesheetData>('../assets/atlas/*.json', {
  eager: true,
  import: 'default',
});
const ATLAS_IMAGES = import.meta.glob<string>('../assets/atlas/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

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
  container: HTMLElement;
}

interface Living {
  body: Body;
  controller: PetController;
}

async function loadAtlas(species: Pet['species'], colour: Colour): Promise<Spritesheet> {
  const key = `../assets/atlas/${species}-${colour}`;
  const data = ATLAS_DATA[`${key}.json`];
  const url = ATLAS_IMAGES[`${key}.png`];
  if (!data || !url) throw new Error(`No sprite sheet for ${species} ${colour}`);
  const texture = await Assets.load<Texture>(url);
  texture.source.scaleMode = 'nearest';
  const sheet = new Spritesheet(texture, data);
  await sheet.parse();
  return sheet;
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

/** Sends every pet's rect when any of them moved, throttled. */
function hitboxPusher(host: PetHost): (bodies: readonly Body[], now: number) => void {
  let lastKey = '';
  let lastAt = -Infinity;
  return (bodies, now) => {
    const rects: Rect[] = bodies.map((b) => ({
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: b.width,
      height: b.height,
    }));
    const key = JSON.stringify(rects);
    if (key === lastKey || now - lastAt < HITBOX_MIN_INTERVAL_MS) return;
    lastKey = key;
    lastAt = now;
    void host.setHitboxes(rects);
  };
}

/** Runs the pets (brain, world, controllers and PixiJS stage) inside `container`, fed by `host`. */
export async function startPets(host: PetHost, options: PetOptions): Promise<{ stop(): void }> {
  const timeScale = options.timeScale ?? 1;
  const baseSeed = options.seed ?? Date.now();

  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    resizeTo: window,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    antialias: false,
    roundPixels: true,
  });
  options.container.appendChild(app.canvas);

  let floor = await host.getFloor();
  let cursor: Point | null = null;
  const world = new World(floor);
  const stage = new PetStage(app);
  const pushHitboxes = hitboxPusher(host);
  const pets: Living[] = [];

  for (const [i, pet] of options.pets.entries()) {
    const body = spawnBody(pet.id, floor, i, options.pets.length);
    world.add(body);
    stage.add(pet, await loadAtlas(pet.species, pet.colour));
    const rng = seededRng((baseSeed + i * SEED_STRIDE) >>> 0);
    pets.push({ body, controller: new PetController(pet, body, rng) });
  }

  const unlisten = await Promise.all([
    host.onCursor((p) => {
      cursor = p;
    }),
    host.onFloorChanged((f) => {
      floor = f;
      world.setFloor(f);
    }),
  ]);

  app.ticker.add((ticker) => {
    const dt = clampFrameDelta(ticker.deltaMS / 1000) * timeScale;
    const userIdleSeconds = host.userIdleSeconds();
    const active = activeSeconds(dt, { userIdleSeconds, napTime: false });
    const ctx = { cursor, userIdleSeconds, floor };

    for (const p of pets) p.controller.update(dt, ctx);
    world.step(dt);

    for (const { body: b, controller: c } of pets) {
      if (active > 0) {
        c.pet = updateLearned({
          ...c.pet,
          mood: tickMood(c.pet.mood, active, c.activity()),
          pairings: fade(c.pet.pairings, active),
        });
      }
      const { name, t } = c.anim();
      stage.draw(c.pet.id, b, rigPose(name, t, c.pet.mood));
      stage.drawZs(c.pet.id, name === 'nap' || name === 'cuddle-nap' ? floatingZs(t) : []);
    }
    pushHitboxes(world.bodies(), performance.now());
  });

  return {
    stop() {
      for (const off of unlisten) off();
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
