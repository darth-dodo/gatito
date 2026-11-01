import { TUNING } from './tuning';

export type NameResult = { ok: true; name: string } | { ok: false; reason: 'empty' | 'too-long' };

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Trims the name and counts what a person sees as characters (graphemes), so one emoji is one. */
export function validateName(raw: string): NameResult {
  const name = raw.trim();
  if (name === '') return { ok: false, reason: 'empty' };
  let count = 0;
  for (const _ of graphemes.segment(name)) {
    count += 1;
    if (count > TUNING.maxNameLength) return { ok: false, reason: 'too-long' };
  }
  return { ok: true, name };
}
