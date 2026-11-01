export const TUNING = {
  affectionDrainPerHour: 10,
  energyNapPerHour: 40,
  energyActivePerHour: 15,
  affectionPerStroke: 2,
  affectionPerReward: 5,
  activeIdleSeconds: 300,
  underCursorSeconds: 2,
  /** A napping cat under a still cursor stretches this long, then leaves by underCursorSeconds. */
  quickStretchSeconds: 0.8,
  strokesForPurr: 3,
  strokeWindowSeconds: 2,
  strokeMinTravelPx: 12,
  /** Taps (press and release without lifting) within strokeWindowSeconds that start a purr; taps and strokes add up. */
  tapsForPurr: 3,
  /** Keep stroking a purring cat with at least this affection and it rolls belly up. */
  bellyUpMinAffection: 70,
  /** A press on a pet becomes a pick up only after the pointer moves this far with the button held. */
  dragStartPx: 4,
  maxFrameDeltaSeconds: 0.25,
  cuddleNapIdleSeconds: 180,
  cuddleNapMinAffection: 70,
  mischiefMultiplier: { mischievous: 3.0, curious: 1.8, social: 1.5, cosy: 0.9 },
  napEnergyFactor: 6,
  wokeStretchFactor: 100,
  rewardWindowSeconds: 3,
  learnedShare: 0.8,
  learnedKeepShare: 0.6,
  fadeActiveHours: 40,
  cheekyChance: 1 / 7,
  rewardStrength: 2.0,
  noRewardFactor: 0.8,
  minStrength: 0.2,
  yawnBelowEnergy: 20,
  walkAwayBelowAffection: 25,
  walkAwayChance: 0.5,
  maxCats: 6,
  maxNameLength: 20,
  /** Mood and learning drift reaches the save at most this often; other changes save at once. */
  moodSaveSeconds: 60,
  gravityPxPerS2: 2400,
  simStepSeconds: 1 / 60,
  /** Whole-number screen scale for the 48 px pixel art. */
  renderScale: 1,
  /**
   * How a cat walks: 'puppet' swings the cut-out legs, 'frames' plays the generated walk-1..walk-6
   * frames when the coat has them (and falls back to the puppet when it does not). 'frames' is the default:
   * the generated cycle keeps the reference's body and adds real knee bends.
   */
  walkMode: 'frames' as 'puppet' | 'frames',
} as const;
