import { describe, expect, it } from 'vitest';
import { parseDemoParams } from '../../src/demo/params';

describe('parseDemoParams', () => {
  it('defaults to real speed and no fixed seed', () => {
    expect(parseDemoParams('')).toEqual({ speed: 1, seed: undefined });
  });

  it('reads speed and seed', () => {
    expect(parseDemoParams('?speed=3&seed=7')).toEqual({ speed: 3, seed: 7 });
  });

  it('clamps speed to 1..8', () => {
    expect(parseDemoParams('?speed=20').speed).toBe(8);
    expect(parseDemoParams('?speed=0.2').speed).toBe(1);
    expect(parseDemoParams('?speed=-4').speed).toBe(1);
  });

  it('keeps fractional speeds inside the range', () => {
    expect(parseDemoParams('?speed=2.5').speed).toBe(2.5);
  });

  it('falls back to defaults for junk values', () => {
    expect(parseDemoParams('?speed=fast&seed=abc')).toEqual({ speed: 1, seed: undefined });
    expect(parseDemoParams('?speed=&seed=').speed).toBe(1);
  });

  it('accepts seed 0 and truncates seeds to unsigned 32-bit integers', () => {
    expect(parseDemoParams('?seed=0').seed).toBe(0);
    expect(parseDemoParams('?seed=7.9').seed).toBe(7);
    expect(parseDemoParams('?seed=-1').seed).toBe(4294967295);
  });
});
