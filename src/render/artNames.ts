/** Every art image is a square cell of this many pixels, shown at TUNING.renderScale. */
export const ART_CELL = 96;

/** Cut-out parts of the standing puppet. Task 10 looks sprite sheet frames up by these exact names. */
export const PART_NAMES = [
  'body',
  'head',
  'ear-near',
  'ear-far',
  'eyes-open',
  'eyes-closed',
  'tail',
  'leg-front-near',
  'leg-front-far',
  'leg-back-near',
  'leg-back-far',
  'paw-raised',
] as const;

/** Whole-body key poses (without the tail, which is layered on). */
export const POSE_NAMES = [
  'sit',
  'loaf',
  'sleep-curl',
  'belly-up',
  'stretch',
  'groom',
  'sit-up',
  'dangle',
] as const;

/**
 * Optional whole-cat walk cycle frames (with the tail), used when TUNING.walkMode is 'frames'.
 * A coat without them walks as a puppet.
 */
export const WALK_FRAME_NAMES = ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6'] as const;

export type WalkFrameName = (typeof WALK_FRAME_NAMES)[number];
export type PartName = (typeof PART_NAMES)[number];
export type PoseName = (typeof POSE_NAMES)[number];
