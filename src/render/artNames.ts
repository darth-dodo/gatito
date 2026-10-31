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

export type PartName = (typeof PART_NAMES)[number];
export type PoseName = (typeof POSE_NAMES)[number];
