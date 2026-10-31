import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { main } from './build';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COMMITTED = join(ROOT, 'src/assets/atlas');

const list = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);

async function pixels(file: string): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Compares a committed atlas folder with a freshly generated one. JSON must match byte for byte;
 * PNGs are compared by decoded RGBA pixels, since encoders differ between machines.
 * Returns one line per difference; an empty list means the folders match.
 */
export async function compareAtlasDirs(committed: string, generated: string): Promise<string[]> {
  const have = list(committed);
  const want = list(generated);
  const problems: string[] = [];
  for (const f of have) if (!want.includes(f)) problems.push(`${f}: committed but not generated`);
  for (const f of want) if (!have.includes(f)) problems.push(`${f}: generated but not committed`);
  for (const f of have.filter((n) => want.includes(n))) {
    const a = join(committed, f);
    const b = join(generated, f);
    if (f.endsWith('.png')) {
      const [pa, pb] = await Promise.all([pixels(a), pixels(b)]);
      if (pa.width !== pb.width || pa.height !== pb.height || !pa.data.equals(pb.data)) {
        problems.push(`${f}: pixels differ`);
      }
    } else if (!readFileSync(a).equals(readFileSync(b))) {
      problems.push(`${f}: content differs`);
    }
  }
  return problems;
}

async function run(): Promise<number> {
  const temp = mkdtempSync(join(tmpdir(), 'windowsill-fresh-'));
  try {
    const code = await main(['--placeholders', '--out', temp]);
    if (code !== 0) return code;
    const problems = await compareAtlasDirs(COMMITTED, temp);
    if (problems.length === 0) return 0;
    for (const p of problems) console.error(p);
    console.error('Atlases are stale: run `npm run art -- --placeholders` and commit src/assets/atlas');
    return 1;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await run();
}
