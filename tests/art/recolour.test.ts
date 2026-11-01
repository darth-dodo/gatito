import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { COAT_PALETTES, GOLDEN_PALETTE, KEPT_COLOURS, ORANGE_PALETTE, recolour } from '../../scripts/art/recolour';
import { toPng, type Rgb } from './fixtures/images';

async function pixelsOf(png: Buffer): Promise<Rgb[]> {
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out: Rgb[] = [];
  for (let i = 0; i < data.length; i += 3) out.push([data[i], data[i + 1], data[i + 2]]);
  return out;
}

describe('recolour', () => {
  it('maps tabby to grey: each orange palette entry maps to its grey counterpart', async () => {
    const src = await toPng(ORANGE_PALETTE, 5);
    const out = await pixelsOf(await recolour(src, 'orange-tabby', 'grey'));
    expect(out.slice(0, 5)).toEqual(COAT_PALETTES.grey);
    expect(out).toHaveLength(25);
  });

  it('leaves outline and eye colours unchanged', async () => {
    const src = await toPng(KEPT_COLOURS, 2);
    const expected = KEPT_COLOURS;
    for (const to of ['black', 'white', 'grey'] as const) {
      expect(await pixelsOf(await recolour(src, 'orange-tabby', to))).toEqual(expected);
    }
  });

  it('keys by nearest colour, so slightly off shades still map', async () => {
    const near: Rgb[] = ORANGE_PALETTE.slice(0, 4).map(([r, g, b]) => [r + 3, g - 3, b + 2]);
    const out = await pixelsOf(await recolour(await toPng(near, 2), 'orange-tabby', 'black'));
    expect(out).toEqual(COAT_PALETTES.black.slice(0, 4));
  });

  it('keeps transparent pixels transparent', async () => {
    const raw = Buffer.from([255, 0, 0, 0]);
    const src = await sharp(raw, { raw: { width: 1, height: 1, channels: 4 } }).png().toBuffer();
    const { data } = await sharp(await recolour(src, 'orange-tabby', 'white'))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it('passes the magenta key through so it can still be removed afterwards', async () => {
    const keyed: Rgb[] = [[255, 0, 255], [250, 8, 247]];
    const out = await pixelsOf(await recolour(await toPng(keyed, 2), 'orange-tabby', 'white'));
    expect(out.slice(0, 2)).toEqual(keyed);
  });

  it('rejects colours it cannot derive', async () => {
    await expect(recolour(await toPng([[0, 0, 0]], 1), 'orange-tabby', 'calico')).rejects.toThrow(
      /calico/,
    );
    await expect(recolour(await toPng([[0, 0, 0]], 1), 'black', 'grey')).rejects.toThrow(/black/);
  });

  it('maps golden to brown, black and white for dogs, keeping outline, eyes and nose', async () => {
    for (const to of ['brown', 'black', 'white'] as const) {
      const out = await pixelsOf(await recolour(await toPng([...GOLDEN_PALETTE, ...KEPT_COLOURS], 9), 'golden', to));
      expect(out.slice(0, 5), to).toEqual(COAT_PALETTES[to]);
      expect(out.slice(5, 9), to).toEqual(KEPT_COLOURS);
    }
  });

  it('derives each species only its own plain coats', async () => {
    const px = await toPng([[0, 0, 0]], 1);
    await expect(recolour(px, 'golden', 'grey')).rejects.toThrow(/dog to grey/);
    await expect(recolour(px, 'orange-tabby', 'brown')).rejects.toThrow(/cat to brown/);
    await expect(recolour(px, 'golden', 'spotted')).rejects.toThrow(/spotted/);
  });
});
