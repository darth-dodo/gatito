import rigJson from '../../art/rig/cat.json';
import type { BehaviourName } from '../brain/behaviour';
import type { Mood, Trick } from '../brain/types';
import { ART_CELL, PART_NAMES, type PartName, type PoseName } from './artNames';

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
 * One drawn moment. With `pose: 'puppet'` the parts build the standing cat. With a key pose,
 * `parts.body` places the pose image and the other parts are layered over it.
 * `flipX` mirrors relative to the body's facing; `rotation` turns the whole pet about the body pivot.
 */
export interface RigFrame {
  pose: PoseName | 'puppet';
  parts: Partial<Record<PartName, PartPose>>;
  flipX: boolean;
  rotation: number;
}

interface RigPart {
  anchor: [number, number];
  z: number;
  offset: [number, number];
}

export const CELL = ART_CELL;
export const RIG = rigJson.parts as Record<PartName, RigPart>;

/**
 * The pet's box inside its art cell, in cell pixels: the body rect the world and hit boxes use.
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

// Walking legs.
const WALK_STEP_HZ = 2;
const ZOOMIES_STEP_HZ = 4.5;
const LEG_SWING = 0.45;
const WALK_BOB_PX = 1;

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
const PURR_SHAKE_PX = 0.5;
const PURR_SHAKE_HZ = 14;
const DANGLE_SWAY = 0.12;
const DANGLE_SWAY_HZ = 0.8;
const FALL_LEG_SPREAD = 0.5;
const LAND_SQUASH_PX = 2;

/** Where the tail base sits on each key pose, and its rotation (the tail art hangs down and to the left from its base, so rotation 0 is the standing cat). */
const POSE_TAIL: Record<PoseName, { x: number; y: number; rotation: number; swing: number }> = {
  sit: { x: -22, y: 22, rotation: 1.1, swing: 1 },
  loaf: { x: -30, y: 8, rotation: 1.2, swing: 0.6 },
  'sleep-curl': { x: 26, y: 16, rotation: 1, swing: 0.3 },
  'belly-up': { x: -36, y: 4, rotation: 1.1, swing: 1 },
  stretch: { x: -30, y: -21, rotation: 2.3, swing: 0.6 },
  groom: { x: -29, y: 22, rotation: 1.1, swing: 0.6 },
  'sit-up': { x: -17, y: 26, rotation: 1.1, swing: 1 },
  dangle: { x: -11, y: 8, rotation: -0.56, swing: 1.4 },
};

/** The sit pose is drawn without ears and eyes; these parts are always layered on it. Other poses keep their own. */
const SIT_OVERLAY: Partial<Record<PartName, [number, number]>> = {
  'ear-near': [24, -40],
  'ear-far': [31, -44],
  'eyes-open': [33, -37],
  'eyes-closed': [33, -37],
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 0 for a happy cat, 1 for a cross one. Content and Grumpy sit pin it to their ends. */
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

function breath(t: number, seconds: number): number {
  return BREATH_PX * Math.sin((TAU * t) / seconds);
}

function rest(part: PartName): PartPose {
  const [x, y] = RIG[part].offset;
  return { x, y, rotation: 0, visible: part !== 'eyes-closed' && part !== 'paw-raised' };
}

function puppet(anim: AnimName, t: number, mood: Mood): RigFrame {
  const g = crossness(anim, mood);
  const parts = {} as Record<PartName, PartPose>;
  for (const p of PART_NAMES) parts[p] = rest(p);

  const blink = blinking(t);
  parts['eyes-open'].visible = !blink;
  parts['eyes-closed'].visible = blink;
  const ear = earRotation(anim, t, g);
  parts['ear-near'].rotation = ear;
  parts['ear-far'].rotation = ear;
  parts.tail.rotation = tailSwing(t, g);

  const walking = anim === 'walk' || anim === 'wander' || anim === 'zoomies';
  if (walking) {
    const hz = anim === 'zoomies' ? ZOOMIES_STEP_HZ : WALK_STEP_HZ;
    const swing = LEG_SWING * Math.sin(TAU * hz * t);
    parts['leg-front-near'].rotation = swing;
    parts['leg-back-far'].rotation = swing;
    parts['leg-front-far'].rotation = -swing;
    parts['leg-back-near'].rotation = -swing;
    const bob = -WALK_BOB_PX * Math.abs(Math.sin(TAU * hz * t));
    for (const p of PART_NAMES) if (!p.startsWith('leg-')) parts[p].y += bob;
  } else if (anim === 'fall') {
    parts['leg-front-near'].rotation = -FALL_LEG_SPREAD;
    parts['leg-front-far'].rotation = -FALL_LEG_SPREAD;
    parts['leg-back-near'].rotation = FALL_LEG_SPREAD;
    parts['leg-back-far'].rotation = FALL_LEG_SPREAD;
    parts['ear-near'].rotation = -EAR_BACK_MAX;
    parts['ear-far'].rotation = -EAR_BACK_MAX;
  } else if (anim === 'land') {
    const squash = LAND_SQUASH_PX * (1 - clamp01(t / ANIM_SECONDS.land));
    for (const p of PART_NAMES) if (!p.startsWith('leg-')) parts[p].y += squash;
  } else {
    const b = breath(t, BREATH_SECONDS);
    parts.body.y += b;
    parts.head.y += b;
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

function keyPose(pose: PoseName, anim: AnimName, t: number, mood: Mood): RigFrame {
  const g = crossness(anim, mood);
  const sleeping = anim === 'nap' || anim === 'cuddle-nap';
  const parts: Partial<Record<PartName, PartPose>> = {
    body: { x: 0, y: breath(t, sleeping ? NAP_BREATH_SECONDS : BREATH_SECONDS), rotation: 0, visible: true },
  };
  const tail = POSE_TAIL[pose];
  parts.tail = { x: tail.x, y: tail.y, rotation: tail.rotation + tail.swing * tailSwing(t, g), visible: true };

  if (pose === 'sit') {
    const eyesShut = anim === 'purr' || (anim === 'yawn' && t > ANIM_SECONDS.yawn * 0.25) || blinking(t);
    const ear = earRotation(anim, t, g);
    for (const [name, [x, y]] of Object.entries(SIT_OVERLAY) as [PartName, [number, number]][]) {
      const isEar = name === 'ear-near' || name === 'ear-far';
      const visible = name === 'eyes-open' ? !eyesShut : name === 'eyes-closed' ? eyesShut : true;
      parts[name] = { x, y, rotation: isEar ? ear : 0, visible };
    }
  }

  let rotation = 0;
  if (anim === 'purr') {
    rotation = PURR_LEAN;
    parts.body!.y += PURR_SHAKE_PX * Math.sin(TAU * PURR_SHAKE_HZ * t);
  } else if (anim === 'chase-tail') {
    rotation = TAU * CHASE_TAIL_TURNS * clamp01(t / ANIM_SECONDS['chase-tail']);
  } else if (anim === 'dangle') {
    rotation = DANGLE_SWAY * Math.sin(TAU * DANGLE_SWAY_HZ * t);
  }
  return { pose, parts, flipX: false, rotation };
}

/** Pure: the drawn frame for an animation at time t (seconds since it started) and mood. */
export function rigPose(anim: AnimName, t: number, mood: Mood): RigFrame {
  if (anim === 'roll-over') {
    const p = clamp01(t / ANIM_SECONDS['roll-over']);
    if (p >= ROLL_BELLY_FROM && p <= ROLL_BELLY_TO) {
      // On its back: the belly-up drawing already shows half a turn.
      const frame = keyPose('belly-up', anim, t, mood);
      return { ...frame, rotation: TAU * p - Math.PI };
    }
  }
  const pose = POSE_OF[anim];
  return pose ? keyPose(pose, anim, t, mood) : puppet(anim, t, mood);
}
