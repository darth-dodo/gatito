/// <reference types="vite/client" />
import { Application, Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import { ipc, type Floor, type Point, type Rect } from '../ipc';
import { activeSeconds, clampFrameDelta } from '../brain/clock';
import { fade, newPairings, updateLearned } from '../brain/learning';
import { tickMood } from '../brain/mood';
import { seededRng } from '../brain/rng';
import { TUNING } from '../brain/tuning';
import type { Colour, Pet } from '../brain/types';
import { floatingZs } from '../render/effects';
import { CAT_BOX, rigPose } from '../render/rig';
import { PetStage } from '../render/stage';
import { PetController } from '../sim/controller';
import { World, type Body } from '../sim/world';

/** Hit boxes go to Rust at most this often. */
const HITBOX_MIN_INTERVAL_MS = 1000 / 30;

const ATLAS_DATA = import.meta.glob<SpritesheetData>('../assets/atlas/*.json', {
  eager: true,
  import: 'default',
});
const ATLAS_IMAGES = import.meta.glob<string>('../assets/atlas/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

interface Living {
  body: Body;
  controller: PetController;
}

/** Seconds since the user's last input. Task 14 reads the OS idle time here. */
function currentUserIdleSeconds(): number {
  return 0;
}

/** The single hard-coded pet until creation and saving arrive (Task 12). */
function testPet(): Pet {
  return {
    id: 'mochi',
    species: 'cat',
    name: 'Mochi',
    style: 'pixel',
    colour: 'orange-tabby',
    personality: 'cosy',
    mood: { affection: 60, energy: 70 },
    pairings: newPairings(),
    learned: {},
  };
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

function spawnBody(id: string, floor: Floor): Body {
  const s = TUNING.renderScale;
  const width = (CAT_BOX.right - CAT_BOX.left) * s;
  const height = (CAT_BOX.bottom - CAT_BOX.top) * s;
  return {
    id,
    x: floor.x + (floor.width - width) / 2,
    y: floor.bottom - height,
    vx: 0,
    vy: 0,
    facing: 1,
    held: false,
    grounded: true,
    width,
    height,
  };
}

/** Sends every pet's rect when any of them moved, throttled. */
function hitboxPusher(): (bodies: readonly Body[], now: number) => void {
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
    void ipc.setHitboxes(rects);
  };
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    resizeTo: window,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);

  let floor = await ipc.getFloor();
  let cursor: Point | null = null;
  const world = new World(floor);
  const stage = new PetStage(app);
  const pushHitboxes = hitboxPusher();
  const pets: Living[] = [];

  const pet = testPet();
  const body = spawnBody(pet.id, floor);
  world.add(body);
  stage.add(pet, await loadAtlas(pet.species, pet.colour));
  pets.push({ body, controller: new PetController(pet, body, seededRng(Date.now() >>> 0)) });

  void ipc.onCursor((p) => {
    cursor = p;
  });
  void ipc.onFloorChanged((f) => {
    floor = f;
    world.setFloor(f);
  });

  app.ticker.add((ticker) => {
    const dt = clampFrameDelta(ticker.deltaMS / 1000);
    const userIdleSeconds = currentUserIdleSeconds();
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
}

void main();
