import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareAtlasDirs } from '../../scripts/art/check-fresh';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'windowsill-fresh-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const pixels = (alpha = 255) => {
  const raw = Buffer.alloc(4 * 4 * 4, 100);
  for (let i = 3; i < raw.length; i += 4) raw[i] = alpha;
  return raw;
};
const png = (raw: Buffer, level: number) =>
  sharp(raw, { raw: { width: 4, height: 4, channels: 4 } }).png({ compressionLevel: level }).toBuffer();

async function dir(name: string, raw: Buffer, level: number, json = '{"a":1}\n') {
  const d = join(root, name);
  mkdirSync(d);
  writeFileSync(join(d, 'cat-x.png'), await png(raw, level));
  writeFileSync(join(d, 'cat-x.json'), json);
  return d;
}

describe('compareAtlasDirs', () => {
  it('passes identical pixels with a different PNG encoding', async () => {
    const a = await dir('a', pixels(), 0);
    const b = await dir('b', pixels(), 9);
    expect(await compareAtlasDirs(a, b)).toEqual([]);
  });

  it('fails when one pixel changed', async () => {
    const changed = pixels();
    changed[0] = 101;
    const a = await dir('a', pixels(), 9);
    const b = await dir('b', changed, 9);
    expect(await compareAtlasDirs(a, b)).toEqual(['cat-x.png: pixels differ']);
  });

  it('fails when the JSON differs by a byte', async () => {
    const a = await dir('a', pixels(), 9);
    const b = await dir('b', pixels(), 9, '{"a":2}\n');
    expect(await compareAtlasDirs(a, b)).toEqual(['cat-x.json: content differs']);
  });

  it('fails on extra and missing files', async () => {
    const a = await dir('a', pixels(), 9);
    const b = await dir('b', pixels(), 9);
    writeFileSync(join(a, 'cat-extra.json'), '{}');
    writeFileSync(join(b, 'cat-new.json'), '{}');
    expect(await compareAtlasDirs(a, b)).toEqual([
      'cat-extra.json: committed but not generated',
      'cat-new.json: generated but not committed',
    ]);
  });
});
