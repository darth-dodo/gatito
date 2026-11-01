import { describe, expect, it } from 'vitest';
import { CAT_COATS, COATS, COLOURS, DOG_COATS, SPECIES } from '../../src/brain/types';

describe('coats', () => {
  it('gives each species the seven coats the spec lists', () => {
    expect(COATS.cat).toEqual(['orange-tabby', 'black', 'white', 'grey', 'tuxedo', 'calico', 'siamese']);
    expect(COATS.dog).toEqual(['golden', 'black', 'white', 'brown', 'spotted', 'tricolour', 'husky-grey']);
    for (const s of SPECIES) expect(new Set(COATS[s]).size).toBe(7);
  });

  it('lists every coat once in COLOURS', () => {
    expect(new Set(COLOURS)).toEqual(new Set([...CAT_COATS, ...DOG_COATS]));
    expect(COLOURS.length).toBe(new Set(COLOURS).size);
  });
});
