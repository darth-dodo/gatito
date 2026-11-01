/// <reference types="vite/client" />
import { Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import type { Colour, Species } from '../brain/types';

const ATLAS_DATA = import.meta.glob<SpritesheetData>('../assets/atlas/*.json', {
  eager: true,
  import: 'default',
});
const ATLAS_IMAGES = import.meta.glob<string>('../assets/atlas/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const key = (species: Species, colour: Colour): string => `../assets/atlas/${species}-${colour}`;

/** True when this coat has a sprite sheet to draw it with. */
export function hasAtlas(species: Species, colour: Colour): boolean {
  const k = key(species, colour);
  return `${k}.json` in ATLAS_DATA && `${k}.png` in ATLAS_IMAGES;
}

export async function loadAtlas(species: Species, colour: Colour): Promise<Spritesheet> {
  const k = key(species, colour);
  const data = ATLAS_DATA[`${k}.json`];
  const url = ATLAS_IMAGES[`${k}.png`];
  if (!data || !url) throw new Error(`No sprite sheet for ${species} ${colour}`);
  const texture = await Assets.load<Texture>(url);
  texture.source.scaleMode = 'nearest';
  const sheet = new Spritesheet(texture, data);
  await sheet.parse();
  return sheet;
}
