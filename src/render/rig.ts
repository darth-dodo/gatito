import catRig from '../../art/rig/cat.json';
import dogRig from '../../art/rig/dog.json';
import type { BehaviourName } from '../brain/behaviour';
import type { Mood, Species, Trick } from '../brain/types';
import { ART_CELL, PART_NAMES, WALK_FRAME_NAMES, type PartName, type PoseName, type WalkFrameName } from './artNames';

/** Every animation a pet can play: its behaviours, the tricks, and the handling and petting moments. */
export type AnimName =
  | BehaviourName
  | Trick
  | 'walk'
  | 'dangle'
  | 'fall'
  | 'land'
  | 'purr'
  | 'belly-up'
  | 'yawn';

/** One part's pivot, in cell pixels relative to the body pivot, and rotation in radians (clockwise positive). */
export interface PartPose {
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
}

/**
 * One drawn moment. With `pose: 'puppet'` the parts build the standing pet. With a key pose,
 * `parts.body` places the pose image and the other parts are layered over it.
 * `flipX` mirrors relative to the body's facing; `rotation` turns the whole pet about the body pivot.
 */
export interface RigFrame {
  pose: PoseName | WalkFrameName | 'puppet';
  parts: Partial<Record<PartName, PartPose>>;
  flipX: boolean;
  rotation: number;
}

interface RigPart {
  anchor: [number, number];
  z: number;
  offset: [number, number];
}

/** Where the tail base sits on a key pose, its rest rotation (the standing pet's tail is 0) and how much it moves. */
interface PoseTail {
  x: number;
  y: number;
  rotation: number;
  swing: number;
  /** The pose image already has its tail drawn in, so the tail part is not layered on (no second tail). */
  drawn?: boolean;
}

type Point = { x: number; y: number };

/** One species' puppet, from `art/rig/<species>.json`. */
export interface SpeciesRig {
  parts: Record<PartName, RigPart>;
  poseTail: Record<PoseName, PoseTail>;
  /** The sit pose is drawn without ears and eyes; these parts are always layered on it. Other poses keep their own. */
  sitOverlay: Partial<Record<PartName, [number, number]>>;
  /**
   * Just above the top of the head, measured on the art, in cell pixels relative to the body pivot (facing
   * right): where a napping pet's "z"s start. Looks not listed use the standing pet's (`puppet`).
   */
  headTop: Partial<Record<PoseName, Point>> & { puppet: Point };
  /**
   * Scales and turns the ears' mood rotation: 1 when the ear art stands up (it folds back anticlockwise),
   * negative when it hangs from its root (a floppy ear swings back clockwise, away from the eye, and less far).
   */
  earTurn: number;
}

export const CELL = ART_CELL;
export const RIGS: { readonly [S in Species]: SpeciesRig } = {
  cat: catRig as unknown as SpeciesRig,
  dog: dogRig as unknown as SpeciesRig,
};

/**
 * The pet's box inside its art cell (the same for every species), in cell pixels: the body rect the world and hit boxes use.
 * Symmetric about the cell centre so mirroring keeps the box in place.
 */
export const CAT_BOX = { left: 6, top: 8, right: 90, bottom: 88 } as const;

/** Lengths in seconds of the animations that end by themselves. */
export const ANIM_SECONDS = {
  stretch: 2,
  spin: 1.2,
  'sit-up': 2,
  'roll-over': 1.6,
  'high-five': 1.6,
  'chase-tail': 2.4,
  purr: 3,
  yawn: 1.6,
  'belly-up': 3,
  land: 0.25,
} as const satisfies Partial<Record<AnimName, number>>;

const POSE_OF: Partial<Record<AnimName, PoseName>> = {
  'idle-sit': 'sit',
  'content-sit': 'sit',
  'grumpy-sit': 'sit',
  stare: 'sit',
  purr: 'sit',
  yawn: 'sit',
  nap: 'sleep-curl',
  'cuddle-nap': 'sleep-curl',
  'chase-tail': 'sleep-curl',
  loaf: 'loaf',
  groom: 'groom',
  stretch: 'stretch',
  'sit-up': 'sit-up',
  'belly-up': 'belly-up',
  dangle: 'dangle',
};

/** Where a species draws an animation on a different pose. A dog chases its tail as a spinning ring. */
const POSE_OVERRIDE: { readonly [S in Species]: Partial<Record<AnimName, PoseName>> } = {
  cat: {},
  dog: { 'chase-tail': 'loaf' },
};

const TAU = Math.PI * 2;

// Ears: how far back (anticlockwise) they fold at full grumpiness, and a forward lean when staring.
const EAR_BACK_MAX = 0.6;
const EAR_STARE_FORWARD = 0.15;
const EAR_TWITCH = 0.12;
const EAR_TWITCH_EVERY = 5.3;
const EAR_TWITCH_LENGTH = 0.18;

// Tail: a calm cat swishes slowly, a cross one flicks fast.
const TAIL_HZ_CALM = 0.35;
const TAIL_HZ_CROSS = 1.6;
const TAIL_SWING = 0.25;

// Blinks: irregular gaps, each under 6 s, and a short closed window.
const BLINK_GAPS = [3.1, 4.3, 2.4, 5.0] as const;
const BLINK_SECONDS = 0.15;

// Walking legs: the cut-out lower legs swing at most about 12 degrees about the hip and shoulder.
const WALK_STEP_HZ = 2;
const ZOOMIES_STEP_HZ = 4.5;
const LEG_SWING = 0.21;
const WALK_BOB_PX = 1;

/** Part rotations snap to steps this size (3 degrees), so pixel art turns in clean steps instead of shimmering. */
export const ROTATION_STEP = Math.PI / 60;

// Walk cycle frames ('frames' walk mode): a natural cadence, faster for zoomies.
const WALK_FPS = 9;
const ZOOMIES_FPS = WALK_FPS * (ZOOMIES_STEP_HZ / WALK_STEP_HZ);

// Breathing, in cell pixels.
const BREATH_PX = 1;
const BREATH_SECONDS = 2.4;
const NAP_BREATH_SECONDS = 3.4;

// Code-made moves.
const SPIN_FLIP_SECONDS = 0.15;
const ROLL_BELLY_FROM = 0.3;
const ROLL_BELLY_TO = 0.7;
const CHASE_TAIL_TURNS = 2;
const HIGH_FIVE_FROM = 0.2;
const HIGH_FIVE_TO = 0.8;
const PURR_LEAN = 0.06;
const PURR_SHAKE_PX = 1;
const PURR_SHAKE_HZ = 14;
const DANGLE_SWAY = 0.12;
const DANGLE_SWAY_HZ = 0.8;
const FALL_LEG_SPREAD = 0.5;
const LAND_SQUASH_PX = 2;

// Dogs. Wag (a dog's Purr): the tail lifts and beats fast and the whole back end wiggles.
const WAG_HZ = 4.5;
const WAG_LIFT = 0.6;
const WAG_SWING = 0.55;
const WAG_WIGGLE = 0.05;
const WAG_SHIFT_PX = 1;
// A standing dog's tail wags faster the happier it is, and droops when cross.
const DOG_TAIL_HZ_HAPPY = 2.2;
const DOG_TAIL_HZ_CROSS = 0.3;
const DOG_TAIL_DROOP = 0.6;
// Tail thump in a sit: the tail rests on the floor and beats up in short pulses, quicker when happy.
const THUMP_HZ_HAPPY = 1.1;
const THUMP_HZ_CROSS = 0.35;
const THUMP_LIFT = 0.4;
/** The share of each thump cycle the tail is off the floor. */
const THUMP_UP_SHARE = 0.18;
// Scratch (a dog's Groom): a fast shake from the hind leg going at the ear.
const SCRATCH_HZ = 7;
const SCRATCH_PX = 2;

/** Pure: where a look's head top is, for the species. */
export function headTop(pose: RigFrame['pose'], species: Species = 'cat'): { x: number; y: number } {
  const tops = RIGS[species].headTop;
  return (pose !== 'puppet' && !pose.startsWith('walk-') && tops[pose as PoseName]) || tops.puppet;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 0 for a happy pet, 1 for a cross one. Content and Grumpy sit pin it to their ends. */
function crossness(anim: AnimName, mood: Mood): number {
  const g = clamp01(1 - mood.affection / 100);
  if (anim === 'grumpy-sit') return Math.max(g, 0.9);
  if (anim === 'content-sit' || anim === 'purr') return Math.min(g, 0.1);
  return g;
}

function blinking(t: number): boolean {
  const cycle = BLINK_GAPS.reduce((s, g) => s + g, 0);
  let tt = ((t % cycle) + cycle) % cycle;
  for (const gap of BLINK_GAPS) {
    if (tt < gap) return tt >= gap - BLINK_SECONDS;
    tt -= gap;
  }
  return false;
}

function earRotation(anim: AnimName, t: number, g: number): number {
  const twitch = t % EAR_TWITCH_EVERY < EAR_TWITCH_LENGTH ? -EAR_TWITCH : 0;
  const forward = anim === 'stare' ? EAR_STARE_FORWARD : 0;
  return -EAR_BACK_MAX * g + forward + twitch;
}

function tailSwing(t: number, g: number): number {
  const hz = TAIL_HZ_CALM + (TAIL_HZ_CROSS - TAIL_HZ_CALM) * g;
  return TAIL_SWING * Math.sin(TAU * hz * t);
}

/** A dog's standing tail: wags fast when happy, slow and low when cross. */
function dogTailWag(t: number, g: number): number {
  const hz = DOG_TAIL_HZ_HAPPY + (DOG_TAIL_HZ_CROSS - DOG_TAIL_HZ_HAPPY) * g;
  return TAIL_SWING * (1 - g / 2) * Math.sin(TAU * hz * t) - DOG_TAIL_DROOP * g;
}

/** A sitting dog's tail thump: 0 on the floor, rising briefly once a cycle (clockwise is up for a left-lying tail). */
function tailThump(t: number, g: number): number {
  const hz = THUMP_HZ_HAPPY + (THUMP_HZ_CROSS - THUMP_HZ_HAPPY) * g;
  const phase = (t * hz) % 1;
  if (phase >= THUMP_UP_SHARE) return 0;
  return THUMP_LIFT * (1 - g / 2) * Math.sin((Math.PI * phase) / THUMP_UP_SHARE);
}

function wag(t: number): number {
  return Math.sin(TAU * WAG_HZ * t);
}

function breath(t: number, seconds: number): number {
  return BREATH_PX * Math.sin((TAU * t) / seconds);
}

/** Pure: an angle snapped to the nearest multiple of `step`. */
export function stepAngle(rad: number, step: number = ROTATION_STEP): number {
  return Math.round(rad / step) * step || 0;
}

/** Snaps every part to whole pixels and stepped rotations. */
function settle(frame: RigFrame): RigFrame {
  for (const p of Object.values(frame.parts)) {
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    p.rotation = stepAngle(p.rotation);
  }
  return frame;
}

const isLeg = (p: PartName): boolean => p.startsWith('leg-') || p === 'paw-raised';

function rest(rig: SpeciesRig, part: PartName): PartPose {
  const [x, y] = rig.parts[part].offset;
  // The head is part of the body image; its own image is only kept for other rigs.
  const visible = part !== 'eyes-closed' && part !== 'paw-raised' && part !== 'head';
  return { x, y, rotation: 0, visible };
}

function puppet(species: Species, anim: AnimName, t: number, mood: Mood): RigFrame {
  const g = crossness(anim, mood);
  const parts = {} as Record<PartName, PartPose>;
  for (const p of PART_NAMES) parts[p] = rest(RIGS[species], p);

  const blink = blinking(t);
  parts['eyes-open'].visible = !blink;
  parts['eyes-closed'].visible = blink;
  const turn = RIGS[species].earTurn;
  const ear = turn * earRotation(anim, t, g);
  parts['ear-near'].rotation = ear;
  parts['ear-far'].rotation = ear;
  parts.tail.rotation = species === 'dog' ? dogTailWag(t, g) : tailSwing(t, g);

  const walking = anim === 'walk' || anim === 'wander' || anim === 'zoomies';
  if (walking) {
    const hz = anim === 'zoomies' ? ZOOMIES_STEP_HZ : WALK_STEP_HZ;
    const swing = LEG_SWING * Math.sin(TAU * hz * t);
    parts['leg-front-near'].rotation = swing;
    parts['leg-back-far'].rotation = swing;
    parts['leg-front-far'].rotation = -swing;
    parts['leg-back-near'].rotation = -swing;
    const bob = -WALK_BOB_PX * Math.abs(Math.sin(TAU * hz * t));
    for (const p of PART_NAMES) if (!isLeg(p)) parts[p].y += bob;
  } else if (anim === 'fall') {
    parts['leg-front-near'].rotation = -FALL_LEG_SPREAD;
    parts['leg-front-far'].rotation = -FALL_LEG_SPREAD;
    parts['leg-back-near'].rotation = FALL_LEG_SPREAD;
    parts['leg-back-far'].rotation = FALL_LEG_SPREAD;
    parts['ear-near'].rotation = -turn * EAR_BACK_MAX;
    parts['ear-far'].rotation = -turn * EAR_BACK_MAX;
  } else if (anim === 'land') {
    const squash = LAND_SQUASH_PX * (1 - clamp01(t / ANIM_SECONDS.land));
    for (const p of PART_NAMES) if (!isLeg(p)) parts[p].y += squash;
  } else {
    // The whole cat above the legs breathes together, so the cut-out ears, eyes and tail stay on.
    const b = breath(t, BREATH_SECONDS);
    for (const p of PART_NAMES) if (!isLeg(p)) parts[p].y += b;
  }

  if (anim === 'high-five') {
    const p = t / ANIM_SECONDS['high-five'];
    const up = p >= HIGH_FIVE_FROM && p <= HIGH_FIVE_TO;
    parts['paw-raised'].visible = up;
    parts['leg-front-near'].visible = !up;
  }

  let flipX = false;
  let rotation = 0;
  if (anim === 'spin' && t < ANIM_SECONDS.spin) {
    flipX = Math.floor(t / SPIN_FLIP_SECONDS) % 2 === 1;
  }
  if (anim === 'roll-over') rotation = TAU * clamp01(t / ANIM_SECONDS['roll-over']);
  return { pose: 'puppet', parts, flipX, rotation };
}

/** How the tail moves on a key pose, added to the pose's rest rotation. */
function poseTailMotion(species: Species, pose: PoseName, anim: AnimName, t: number, g: number): number {
  const { swing } = RIGS[species].poseTail[pose];
  if (species === 'cat') return swing * tailSwing(t, g);
  if (anim === 'purr') return WAG_LIFT + WAG_SWING * wag(t);
  if (pose === 'sit') return swing * tailThump(t, g);
  return swing * dogTailWag(t, g);
}

function keyPose(species: Species, pose: PoseName, anim: AnimName, t: number, mood: Mood): RigFrame {
  const dog = species === 'dog';
  const rig = RIGS[species];
  const g = crossness(anim, mood);
  // A dog's Curl nap (its Loaf) breathes like a nap.
  const sleeping = anim === 'nap' || anim === 'cuddle-nap' || (dog && anim === 'loaf');
  const parts: Partial<Record<PartName, PartPose>> = {
    body: { x: 0, y: 0, rotation: 0, visible: true },
  };
  const tail = rig.poseTail[pose];
  parts.tail = {
    x: tail.x,
    y: tail.y,
    rotation: tail.rotation + poseTailMotion(species, pose, anim, t, g),
    visible: !tail.drawn,
  };

  if (pose === 'sit') {
    // A purring cat closes its eyes; a wagging dog keeps them open.
    const eyesShut =
      (anim === 'purr' && !dog) || (anim === 'yawn' && t > ANIM_SECONDS.yawn * 0.25) || blinking(t);
    const ear = rig.earTurn * earRotation(anim, t, g);
    for (const [name, [x, y]] of Object.entries(rig.sitOverlay) as [PartName, [number, number]][]) {
      const isEar = name === 'ear-near' || name === 'ear-far';
      const visible = name === 'eyes-open' ? !eyesShut : name === 'eyes-closed' ? eyesShut : true;
      parts[name] = { x, y, rotation: isEar ? ear : 0, visible };
    }
  }

  let rotation = 0;
  // Breathing (and a purr's shake) moves the pose and everything layered on it together.
  let lift = breath(t, sleeping ? NAP_BREATH_SECONDS : BREATH_SECONDS);
  let shift = 0;
  if (anim === 'purr' && dog) {
    rotation = WAG_WIGGLE * wag(t);
    shift = WAG_SHIFT_PX * wag(t);
  } else if (anim === 'purr') {
    rotation = PURR_LEAN;
    lift += PURR_SHAKE_PX * Math.sin(TAU * PURR_SHAKE_HZ * t);
  } else if (anim === 'groom' && dog) {
    lift += SCRATCH_PX * Math.sin(TAU * SCRATCH_HZ * t);
  } else if (anim === 'chase-tail') {
    rotation = TAU * CHASE_TAIL_TURNS * clamp01(t / ANIM_SECONDS['chase-tail']);
  } else if (anim === 'dangle') {
    rotation = DANGLE_SWAY * Math.sin(TAU * DANGLE_SWAY_HZ * t);
  }
  for (const p of Object.values(parts)) {
    p.x += shift;
    p.y += lift;
  }
  return { pose, parts, flipX: false, rotation };
}

/** A walk cycle frame: the whole cat with its tail, so no parts are layered on. */
function walkFrame(anim: AnimName, t: number): RigFrame {
  const fps = anim === 'zoomies' ? ZOOMIES_FPS : WALK_FPS;
  const i = Math.floor(Math.max(0, t) * fps) % WALK_FRAME_NAMES.length;
  return {
    pose: WALK_FRAME_NAMES[i]!,
    parts: { body: { x: 0, y: 0, rotation: 0, visible: true } },
    flipX: false,
    rotation: 0,
  };
}

export interface RigOptions {
  /** Defaults to cat. Species changes only the look (see rigPose). */
  species?: Species;
  /** Play the walk cycle frames for walking (the coat has them and TUNING.walkMode is 'frames'). */
  walkFrames?: boolean;
}

/**
 * Pure: the drawn frame for an animation at time t (seconds since it started) and mood.
 * Species changes only the look: a dog wags for Purr, curls nose under tail for Loaf,
 * scratches an ear for Groom and thumps its tail in a sit.
 */
export function rigPose(anim: AnimName, t: number, mood: Mood, options: RigOptions = {}): RigFrame {
  const species = options.species ?? 'cat';
  if (options.walkFrames && (anim === 'walk' || anim === 'wander' || anim === 'zoomies')) return walkFrame(anim, t);
  if (anim === 'roll-over') {
    const p = clamp01(t / ANIM_SECONDS['roll-over']);
    if (p >= ROLL_BELLY_FROM && p <= ROLL_BELLY_TO) {
      // On its back: the belly-up drawing already shows half a turn.
      const frame = settle(keyPose(species, 'belly-up', anim, t, mood));
      return { ...frame, rotation: TAU * p - Math.PI };
    }
  }
  const pose = POSE_OVERRIDE[species][anim] ?? POSE_OF[anim];
  return settle(pose ? keyPose(species, pose, anim, t, mood) : puppet(species, anim, t, mood));
}
