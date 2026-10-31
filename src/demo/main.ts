import type { Floor, Point } from '../ipc';
import { newPairings } from '../brain/learning';
import type { Colour, Mood, Personality, Pet } from '../brain/types';
import { startPets, type PetHost } from '../overlay/app';
import { parseDemoParams } from './params';

/** Must match --menu-h, --dock-h and --dock-gap in demo.html. */
const MENU_BAR_PX = 28;
const DOCK_PX = 64;
const DOCK_GAP_PX = 8;

function floor(): Floor {
  return {
    x: 0,
    y: MENU_BAR_PX,
    width: window.innerWidth,
    bottom: window.innerHeight - DOCK_PX - DOCK_GAP_PX * 2,
  };
}

function cat(name: string, colour: Colour, personality: Personality, mood: Mood): Pet {
  return {
    id: name.toLowerCase(),
    species: 'cat',
    name,
    style: 'pixel',
    colour,
    personality,
    mood,
    pairings: newPairings(),
    learned: {},
  };
}

/** A browser stand-in for the Tauri overlay: the page is the desktop. */
function browserHost(): PetHost {
  let lastInputAt = performance.now();
  const input = (): void => {
    lastInputAt = performance.now();
  };
  for (const type of ['mousedown', 'keydown', 'wheel', 'touchstart'] as const) {
    window.addEventListener(type, input, { passive: true });
  }
  return {
    getFloor: () => Promise.resolve(floor()),
    onFloorChanged: (cb) => {
      const listener = (): void => cb(floor());
      window.addEventListener('resize', listener);
      return Promise.resolve(() => window.removeEventListener('resize', listener));
    },
    onCursor: (cb) => {
      const listener = (e: MouseEvent): void => {
        input();
        const p: Point = { x: e.clientX, y: e.clientY };
        cb(p);
      };
      window.addEventListener('mousemove', listener);
      return Promise.resolve(() => window.removeEventListener('mousemove', listener));
    },
    setHitboxes: () => Promise.resolve(),
    userIdleSeconds: () => (performance.now() - lastInputAt) / 1000,
  };
}

const { speed, seed } = parseDemoParams(window.location.search);
const container = document.getElementById('pets');
if (!container) throw new Error('demo.html is missing #pets');

void startPets(browserHost(), {
  pets: [
    cat('Mochi', 'orange-tabby', 'cosy', { affection: 70, energy: 55 }),
    cat('Pixel', 'black', 'mischievous', { affection: 40, energy: 85 }),
    cat('Snow', 'white', 'curious', { affection: 60, energy: 75 }),
    cat('Ash', 'grey', 'social', { affection: 80, energy: 65 }),
  ],
  seed,
  timeScale: speed,
  container,
});
