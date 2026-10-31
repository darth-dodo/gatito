// Generates cut-out puppet source art with OpenRouter. Usage:
//   npm run art:generate -- --species cat --coat orange-tabby [--only tail,sit] [--reference path]
// Requires OPENROUTER_API_KEY in the environment (never read from or written to disk here).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-3.1-flash-image';
const MAX_CALLS = 45;
const MAX_RETRIES = 2;

const SUBJECTS: Record<string, string> = {
  reference: 'one full-body cat standing on four legs, whole body including head, ears, tail and all four legs, relaxed neutral pose',
  body: 'only the torso, no head, no legs, no tail, no ears',
  head: 'only the head in profile facing right, blank face with no eyes and no ears, no body, no neck, the whole head fits inside the canvas with magenta margin on all sides',
  'ear-near': 'only a single small triangular cat ear with a pink inner, drawn large and centered, no head, nothing else',
  'ear-far': 'only a single small triangular cat ear, slightly smaller, drawn large and centered, no head, nothing else',
  'eyes-open': 'only two small dark oval eyes with a light highlight side by side, drawn large and centered, no face, no head, nothing else',
  'eyes-closed': 'only two short thin dark curved lines side by side, like closed eyelids, floating on the plain magenta background, no fur, no skin, no face, no head, nothing else',
  tail: 'only the tail, isolated, curved upward, base on the left',
  'leg-front-near': 'only the near front leg and paw, isolated, hanging straight down, top at the upper edge',
  'leg-front-far': 'only the far front leg and paw, isolated, same orange colours as the reference, hanging straight down, top at the upper edge',
  'leg-back-near': 'only the near back leg with the bent haunch and paw, isolated, nothing else',
  'leg-back-far': 'only the far back leg and paw, isolated, slightly darker, nothing else',
  'paw-raised': 'only a single disembodied cat front leg and open paw pointing straight up, vertical, centered, with magenta on both sides, no cat body, no head, no tail, nothing else',
  sit: 'whole cat sitting upright, side view, tail not shown',
  loaf: 'whole cat in a loaf pose, paws tucked under the body, tail not shown',
  'sleep-curl': 'whole cat curled up asleep, nose tucked into tail',
  'belly-up': 'whole cat lying on its back with belly up and paws in the air, tail not shown',
  stretch: 'whole cat in a stretch, front legs forward, rear raised, no tail at all',
  groom: 'whole cat sitting and licking a raised paw, tail not shown',
  'sit-up': 'whole cat sitting up on hind legs, front paws held up, tail not shown',
  dangle: 'whole cat held up by the scruff, body hanging limp with legs dangling, tail not shown',
};
const PARTS = ['body', 'head', 'ear-near', 'ear-far', 'eyes-open', 'eyes-closed', 'tail', 'leg-front-near', 'leg-front-far', 'leg-back-near', 'leg-back-far', 'paw-raised'];
const POSES = ['sit', 'loaf', 'sleep-curl', 'belly-up', 'stretch', 'groom', 'sit-up', 'dangle'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

let calls = 0;
let totalCost = 0;
let sawCost = false;

async function generate(prompt: string, key: string, referencePath?: string): Promise<Buffer> {
  const content: unknown[] = [{ type: 'text', text: prompt }];
  if (referencePath) {
    const b64 = readFileSync(referencePath).toString('base64');
    content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } });
  }
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (calls >= MAX_CALLS) throw new Error(`Call cap of ${MAX_CALLS} per run reached; aborting.`);
    calls++;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], messages: [{ role: 'user', content }] }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
      if (typeof json?.usage?.cost === 'number') {
        totalCost += json.usage.cost;
        sawCost = true;
      }
      const url: unknown = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (typeof url !== 'string' || !url.startsWith('data:image')) {
        throw new Error(`Unexpected response shape: ${JSON.stringify(json, (_k, v) => (typeof v === 'string' && v.length > 120 ? v.slice(0, 60) + '...' : v)).slice(0, 1500)}`);
      }
      return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.error(`  attempt ${attempt + 1} failed: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  throw new Error('unreachable');
}

function makeSquare(file: string): void {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  const w = Number(/pixelWidth: (\d+)/.exec(out)?.[1]);
  const h = Number(/pixelHeight: (\d+)/.exec(out)?.[1]);
  if (w !== h) {
    const s = String(Math.min(w, h));
    execFileSync('sips', ['--cropToHeightWidth', s, s, file], { stdio: 'ignore' });
  }
}

async function main(): Promise<void> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('OPENROUTER_API_KEY is not set. Load it into this command\'s environment, e.g. set -a; . path/to/.env; set +a');
    process.exit(1);
  }
  const species = arg('species');
  const coat = arg('coat');
  if (!species || !coat) {
    console.error('Usage: npm run art:generate -- --species cat --coat orange-tabby [--only a,b] [--reference path]');
    process.exit(1);
  }
  const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const dir = join('art', 'source', species, coat);
  mkdirSync(dir, { recursive: true });
  const coatWords = coat.replace(/-/g, ' ');
  const prompt = (subject: string, isPart: boolean) =>
    `pixel art, 48x48 grid, side view facing right, ${coatWords} ${species}, ${subject}, flat magenta #FF00FF background, no shadow, no text. Use the attached image as the style, colour and proportion reference. Output one square image.${isPart ? ' Do not draw the whole cat: show only this part, enlarged to fill most of the canvas.' : ''}`;

  let reference = arg('reference') ?? join(dir, 'reference.png');
  if (!arg('reference') && (!existsSync(reference) || only?.includes('reference'))) {
    console.log('generating reference');
    const refPrompt = `pixel art, 48x48 grid, side view facing right, ${coatWords} ${species}, ${SUBJECTS.reference}, flat magenta #FF00FF background, no shadow, no text. Output one square image.`;
    writeFileSync(reference, await generate(refPrompt, key));
    makeSquare(reference);
  }
  const names = (only ?? [...PARTS, ...POSES]).filter((n) => n !== 'reference');
  for (const name of names) {
    if (!SUBJECTS[name]) {
      console.error(`unknown name: ${name}`);
      process.exit(1);
    }
    console.log(`generating ${name}`);
    const file = join(dir, `${name}.png`);
    writeFileSync(file, await generate(prompt(SUBJECTS[name], PARTS.includes(name)), key, reference));
    makeSquare(file);
  }
  console.log(`done: ${calls} calls${sawCost ? `, reported cost about $${totalCost.toFixed(4)}` : ''}`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
