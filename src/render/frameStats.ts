/** Frame-time numbers over the last second, for the debug readout. */
export interface FrameSummary {
  fps: number;
  /** Time between frames. */
  avgMs: number;
  worstMs: number;
  /** Time spent per frame updating and drawing the pets (main thread). */
  workAvgMs: number;
  workWorstMs: number;
}

const WINDOW_MS = 1000;

/** Pure: keeps the frame times of the last second and sums them up. */
export class FrameStats {
  private samples: { at: number; ms: number; work: number }[] = [];

  add(frameMs: number, workMs: number, now: number): void {
    this.samples.push({ at: now, ms: frameMs, work: workMs });
    while (this.samples.length > 0 && this.samples[0]!.at <= now - WINDOW_MS) this.samples.shift();
  }

  summary(): FrameSummary {
    const n = this.samples.length;
    if (n === 0) return { fps: 0, avgMs: 0, worstMs: 0, workAvgMs: 0, workWorstMs: 0 };
    const sum = (f: (x: { ms: number; work: number }) => number) => this.samples.reduce((s, x) => s + f(x), 0);
    const max = (f: (x: { ms: number; work: number }) => number) => Math.max(...this.samples.map(f));
    return {
      fps: n,
      avgMs: sum((x) => x.ms) / n,
      worstMs: max((x) => x.ms),
      workAvgMs: sum((x) => x.work) / n,
      workWorstMs: max((x) => x.work),
    };
  }
}

/** Pure: the readout is on with `?debug=1`, `localStorage.windowsillDebug = '1'` or `WINDOWSILL_DEBUG=1` at build time. */
export function debugEnabled(search: string, stored: string | null, env: string | undefined): boolean {
  return new URLSearchParams(search).get('debug') === '1' || stored === '1' || env === '1';
}

export function formatSummary(s: FrameSummary): string {
  const f = (v: number) => v.toFixed(1);
  return `${s.fps} fps  avg ${f(s.avgMs)} ms  worst ${f(s.worstMs)} ms\nwork avg ${f(s.workAvgMs)} ms  worst ${f(s.workWorstMs)} ms`;
}

/** A small fixed readout in the top left corner, refreshed four times a second. */
export function frameReadout(parent: HTMLElement): (frameMs: number, workMs: number, now: number) => void {
  const stats = new FrameStats();
  const el = document.createElement('div');
  el.id = 'windowsill-debug';
  el.style.cssText =
    'position:fixed;left:8px;top:36px;z-index:10;padding:2px 6px;font:11px/1.4 ui-monospace,monospace;' +
    'color:#fff;background:rgba(0,0,0,0.6);border-radius:4px;pointer-events:none;white-space:pre';
  parent.appendChild(el);
  let shownAt = -Infinity;
  return (frameMs, workMs, now) => {
    stats.add(frameMs, workMs, now);
    if (now - shownAt < 250) return;
    shownAt = now;
    el.textContent = formatSummary(stats.summary());
  };
}
