import { describe, expect, it } from 'vitest';
import { validateName } from '../../src/brain/names';

describe('validateName', () => {
  it('rejects a blank name as empty', () => {
    expect(validateName('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateName('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('trims whitespace', () => {
    expect(validateName('  Mochi ')).toEqual({ ok: true, name: 'Mochi' });
  });

  it('counts graphemes, not code units: 20 emoji pass, 21 fail', () => {
    const cat = '\u{1F408}‍⬛'; // black cat: one grapheme, several code units
    expect(validateName(cat.repeat(20))).toEqual({ ok: true, name: cat.repeat(20) });
    expect(validateName(cat.repeat(21))).toEqual({ ok: false, reason: 'too-long' });
  });

  it('allows exactly 20 letters and rejects 21', () => {
    expect(validateName('a'.repeat(20)).ok).toBe(true);
    expect(validateName('a'.repeat(21))).toEqual({ ok: false, reason: 'too-long' });
  });

  it('measures length after trimming', () => {
    expect(validateName(`  ${'a'.repeat(20)}  `)).toEqual({ ok: true, name: 'a'.repeat(20) });
  });

  it('has no opinion about other pets: two cats may share a name', () => {
    expect(validateName('Mochi')).toEqual(validateName('Mochi'));
    expect(validateName('Mochi').ok).toBe(true);
  });
});
