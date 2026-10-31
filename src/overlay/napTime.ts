/** Seconds the cats take to curl up before fading out. */
export const CURL_SECONDS = 1.2;
/** Seconds to fade out, and to fade back in. */
export const FADE_SECONDS = 0.8;

type Phase = 'awake' | 'curling' | 'fading-out' | 'hidden' | 'fading-in';

/**
 * Nap time as seen by the pets: on, they curl up then fade out; off, they fade back in
 * (still curled) and stand up. The flag itself stops the mood clock at once.
 */
export class NapTime {
  private phase: Phase = 'awake';
  private elapsed = 0;
  private level = 1;
  private requested = false;

  /** The Nap time toggle, which is what `activeSeconds` must see. */
  get on(): boolean {
    return this.requested;
  }

  /** 1 when fully visible, 0 when hidden. */
  get alpha(): number {
    return this.level;
  }

  /** True while the cats should be drawn curled up. */
  get curled(): boolean {
    return this.phase !== 'awake';
  }

  /** True when nothing is visible, so there is nothing to click. */
  get hidden(): boolean {
    return this.phase === 'hidden';
  }

  setOn(on: boolean): void {
    if (on === this.requested) return;
    this.requested = on;
    if (on) {
      this.phase = 'curling';
      this.elapsed = 0;
    } else if (this.phase === 'curling') {
      this.phase = 'awake';
    } else {
      this.phase = 'fading-in';
    }
  }

  update(dt: number): void {
    if (this.phase === 'curling') {
      this.elapsed += dt;
      if (this.elapsed >= CURL_SECONDS) this.phase = 'fading-out';
    } else if (this.phase === 'fading-out') {
      this.level = Math.max(0, this.level - dt / FADE_SECONDS);
      if (this.level === 0) this.phase = 'hidden';
    } else if (this.phase === 'fading-in') {
      this.level = Math.min(1, this.level + dt / FADE_SECONDS);
      if (this.level === 1) this.phase = 'awake';
    }
  }
}
