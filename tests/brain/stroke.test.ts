import { describe, expect, it } from 'vitest';
import { StrokeDetector } from '../../src/brain/stroke';

function run(xs: number[], times: number[]): { d: StrokeDetector; strokes: number } {
  const d = new StrokeDetector();
  let strokes = 0;
  xs.forEach((x, i) => {
    strokes = d.feed(x, times[i]);
  });
  return { d, strokes };
}

describe('StrokeDetector', () => {
  it('three strokes in two seconds purr', () => {
    const { d, strokes } = run([0, 20, 0, 20], [0, 0.5, 1, 1.5]);
    expect(strokes).toBe(3);
    expect(d.purring(1.5)).toBe(true);
  });
  it('slow strokes do not purr', () => {
    const { d, strokes } = run([0, 20, 0, 20], [0, 5 / 3, 10 / 3, 5]);
    expect(strokes).toBe(3);
    expect(d.purring(5)).toBe(false);
  });
  it('jitter is not a stroke', () => {
    const { strokes } = run([0, 4, 0, 4, 0, 4], [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(strokes).toBe(0);
  });
  it('reset clears strokes', () => {
    const { d } = run([0, 20, 0, 20], [0, 0.5, 1, 1.5]);
    d.reset();
    expect(d.purring(1.5)).toBe(false);
    expect(d.feed(0, 2)).toBe(0);
  });
});
