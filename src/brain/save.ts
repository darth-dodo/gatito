import { TUNING } from './tuning';
import { COLOURS, CUES, PERSONALITIES, STYLES, TRICKS } from './types';
import type { Cue, Pairings, Pet, Trick } from './types';

export interface SaveFile {
  version: 1;
  pets: Pet[];
  settings: { napTime: boolean };
}

export type ParseResult = { ok: true; save: SaveFile } | { ok: false; reason: string };

export function serialise(s: SaveFile): string {
  return JSON.stringify(s);
}

type Obj = Record<string, unknown>;

class Invalid extends Error {}

function fail(msg: string): never {
  throw new Invalid(msg);
}

function obj(v: unknown, what: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${what} must be an object`);
  return v as Obj;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], what: string): T {
  if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) fail(`unknown ${what}`);
  return v as T;
}

function str(v: unknown, what: string): string {
  if (typeof v !== 'string') fail(`${what} must be a string`);
  return v;
}

function meter(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) {
    fail(`${what} must be a number from 0 to 100`);
  }
  return v;
}

function exactKeys(o: Obj, list: readonly string[], what: string): void {
  for (const k of Object.keys(o)) if (!list.includes(k)) fail(`unknown ${what} key ${k}`);
}

function pairings(v: unknown): Pairings {
  const rows = obj(v, 'pairings');
  exactKeys(rows, CUES, 'cue');
  const out = {} as Pairings;
  for (const cue of CUES) {
    const row = obj(rows[cue], `pairings.${cue}`);
    exactKeys(row, TRICKS, 'trick');
    const r = {} as Record<Trick, number>;
    for (const trick of TRICKS) {
      const n = row[trick];
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
        fail(`pairing ${cue}/${trick} must be a positive finite number`);
      }
      r[trick] = n;
    }
    out[cue] = r;
  }
  return out;
}

function learned(v: unknown, what = 'learned'): Pet['learned'] {
  const o = obj(v, what);
  const out: Partial<Record<Cue, Trick>> = {};
  for (const [k, t] of Object.entries(o)) {
    out[oneOf(k, CUES, `${what} cue`)] = oneOf(t, TRICKS, `${what} trick`);
  }
  return out;
}

function pet(v: unknown): Pet {
  const o = obj(v, 'pet');
  if (o.species !== 'cat') fail('unknown species (only cat is supported)');
  const mood = obj(o.mood, 'mood');
  const out: Pet = {
    id: str(o.id, 'id'),
    species: 'cat',
    name: str(o.name, 'name'),
    style: oneOf(o.style, STYLES, 'style'),
    colour: oneOf(o.colour, COLOURS, 'colour'),
    personality: oneOf(o.personality, PERSONALITIES, 'personality'),
    mood: { affection: meter(mood.affection, 'affection'), energy: meter(mood.energy, 'energy') },
    pairings: pairings(o.pairings),
    learned: learned(o.learned),
  };
  if (o.celebrated !== undefined) out.celebrated = learned(o.celebrated, 'celebrated');
  return out;
}

/** Never throws; any problem is reported as `{ ok: false, reason }`. */
export function parseSave(text: string): ParseResult {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'not valid JSON' };
    }
    const root = obj(raw, 'save');
    if (root.version !== 1) fail('unsupported version');
    if (!Array.isArray(root.pets)) fail('pets must be an array');
    if (root.pets.length > TUNING.maxCats) fail(`more than ${TUNING.maxCats} pets`);
    const settings = obj(root.settings, 'settings');
    if (typeof settings.napTime !== 'boolean') fail('napTime must be a boolean');
    return {
      ok: true,
      save: { version: 1, pets: root.pets.map(pet), settings: { napTime: settings.napTime } },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Invalid ? e.message : 'invalid save' };
  }
}
