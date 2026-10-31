import { TUNING } from './tuning';

/**
 * Counts petting strokes from horizontal cursor samples inside a cat.
 * A stroke is a sweep of at least strokeMinTravelPx in a direction different from the last counted sweep.
 */
export class StrokeDetector {
  private anchor = 0;
  private last = 0;
  private dir = 0;
  private countedDir = 0;
  private started = false;
  private strokeTimes: number[] = [];

  feed(x: number, tSeconds: number): number {
    if (!this.started) {
      this.started = true;
      this.anchor = x;
      this.last = x;
      return this.strokeTimes.length;
    }
    const dx = x - this.last;
    if (dx !== 0) {
      const sdir = Math.sign(dx);
      if (this.dir !== 0 && sdir !== this.dir) this.anchor = this.last;
      this.dir = sdir;
    }
    if (this.dir !== 0 && Math.abs(x - this.anchor) >= TUNING.strokeMinTravelPx && this.dir !== this.countedDir) {
      this.countedDir = this.dir;
      this.strokeTimes.push(tSeconds);
    }
    this.last = x;
    return this.strokeTimes.length;
  }

  purring(tSeconds: number): boolean {
    const recent = this.strokeTimes.filter((t) => tSeconds - t <= TUNING.strokeWindowSeconds && t <= tSeconds);
    return recent.length >= TUNING.strokesForPurr;
  }

  reset(): void {
    this.anchor = 0;
    this.last = 0;
    this.dir = 0;
    this.countedDir = 0;
    this.started = false;
    this.strokeTimes = [];
  }
}
