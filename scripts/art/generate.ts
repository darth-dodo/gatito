// Generates cut-out puppet source art with OpenRouter. Usage:
//   npm run art:generate -- --species cat --coat orange-tabby [--only tail,sit] [--reference path] [--max-calls N]
//   npm run art:generate -- --species dog --coat golden
// Requires OPENROUTER_API_KEY in the environment (never read from or written to disk here).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COATS, SPECIES, type Species } from '../../src/brain/types';
import { isRetryableStatus, parseBody } from './retry';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-3.1-flash-image';
const MAX_CALLS = 45;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 90_000;

/** A failure worth retrying (timeout, 408, 429, 5xx). Anything else fails fast. */
class Retryable extends Error {}

/** One frame of a smooth six-frame side-view walk cycle, the whole cat with its tail, walking in place. */
function walkFrame(n: string, legs: string): string {
  return `whole cat walking in place, frame ${n} of a smooth six-frame side-view walk cycle: ${legs}. Exactly four legs. Same cat, same body, head and tail as the reference, only the legs move; the back stays level, the tail is held as in the reference`;
}

const CAT_SUBJECTS: Record<string, string> = {
  reference: 'one full-body cat standing on four legs, whole body including head, ears, tail and all four legs, relaxed neutral pose',
  body: 'the torso only, spanning about x 20% to 86% and y 36% to 65% of the canvas as in the reference, with no head, no neck, no legs, no tail and no ears',
  head: 'the head only (from the neck up), with the ears and the eyes painted over with plain fur so the face is blank',
  'ear-near': 'the near ear only, the left one of the two ears on top of the head',
  'ear-far': 'the far ear only, a small darker ear at about x 85% to 92% and y 16% to 24% of the canvas as in the reference; no head, no body, no other ear',
  'eyes-open': 'the open eye only, one small dark eye at about x 86% to 92% and y 29% to 33% of the canvas as in the reference; no face, no head, nothing else',
  'eyes-closed': 'a closed eye only, drawn as a short thin dark curved line where the open eye sits',
  tail: 'the tail only, at about x 1% to 24% and y 45% to 80% of the canvas as in the reference, from its base at the rump to its tip; no body, no legs',
  'leg-front-near': 'the near front leg only, from shoulder to paw',
  'leg-front-far': 'the far front leg only, from shoulder to paw',
  'leg-back-near': 'the near back leg only, at about x 23% to 33% and y 60% to 87% of the canvas as in the reference, from hip to paw; no body, no tail, no other leg',
  'leg-back-far': 'the far back leg only, the darker rear leg that is the second from the left, from hip to paw',
  'paw-raised': 'only a front leg raised up with an open paw, rising from the shoulder at about x 63% to 70% of the canvas, reaching up to about y 12%; no body, no head, no tail, no other leg',
  sit: 'whole cat sitting upright, side view, drawn WITHOUT ears and WITHOUT eyes (blank face), without the tail',
  loaf: 'whole cat in a loaf pose, paws tucked under the body, without the tail',
  'sleep-curl': 'whole cat curled up asleep, nose tucked into tail',
  'belly-up': 'whole cat lying on its back with belly up and paws in the air, without the tail',
  stretch: 'whole cat in a stretch, front legs forward, rear raised, without the tail',
  groom: 'whole cat sitting and licking a raised paw, without the tail',
  'sit-up': 'whole cat sitting up on hind legs, front paws held up, without the tail',
  'walk-1': walkFrame('1', 'the near front leg reaches forward and the near back leg is stretched back; the far legs are under the body'),
  'walk-2': walkFrame('2', 'the near front paw is planted under the chest, the far back leg swings forward, the far front leg starts to lift behind'),
  'walk-3': walkFrame('3', 'the far front leg passes under the body, the near back leg swings forward, the near front leg pushes back'),
  'walk-4': walkFrame('4', 'the far front leg reaches forward and the far back leg is stretched back; the near legs are under the body'),
  'walk-5': walkFrame('5', 'the far front paw is planted under the chest, the near back leg swings forward, the near front leg starts to lift behind'),
  'walk-6': walkFrame('6', 'the near front leg passes under the body, the far back leg swings forward, the far front leg pushes back'),
  dangle: 'whole cat hanging limp as if lifted by the scruff from above, body hanging, front paws dangling down, hind legs dangling, tail hanging straight down, no hand, no person, nothing holding it',
};
/** Where a dog's art differs from a cat's: floppy ears, and the dog version of each pose. */
const DOG_SUBJECTS: Record<string, string> = {
  ...CAT_SUBJECTS,
  ...Object.fromEntries(
    Object.entries(CAT_SUBJECTS)
      .filter(([name]) => name.startsWith('walk-'))
      .map(([name, text]) => [name, text.replace(/\bcat\b/g, 'dog')]),
  ),
  reference: 'one full-body dog standing on four legs, whole body including head, floppy ears, muzzle, tail and all four legs, relaxed neutral pose',
  head: 'the head only (from the neck up) with its muzzle and nose, with the ears and the eyes painted over with plain fur so the face is blank',
  'ear-near': 'the near floppy ear only, the one hanging down from the top of the head on the side facing us',
  'ear-far': 'the far floppy ear only, the small darker ear just behind the head; no head, no body, no other ear',
  sit: 'whole dog sitting upright, side view, drawn WITHOUT ears and WITHOUT eyes (blank face), without the tail',
  loaf: 'whole dog curled up tight in a ring, nose tucked in at its back end where its tail would cover it, eyes closed, without the tail',
  'sleep-curl': 'whole dog lying down asleep, chin resting on its stretched-out front paws, eyes closed, without the tail',
  'belly-up': 'whole dog lying on its back with belly up, paws in the air and ears flopped down, without the tail',
  stretch: 'whole dog in a play bow, front legs stretched flat forward, chest low, rear raised, without the tail',
  groom: 'whole dog sitting and scratching behind its ear with a raised hind leg, eyes shut happily, without the tail',
  'sit-up': 'whole dog sitting up on hind legs begging, front paws held up, without the tail',
  dangle: 'whole dog hanging limp as if lifted gently from above, body hanging, front paws dangling down, hind legs dangling, ears hanging down, no hand, no person, nothing holding it',
};

const SUBJECTS: { readonly [S in Species]: Record<string, string> } = { cat: CAT_SUBJECTS, dog: DOG_SUBJECTS };

const PARTS = ['body', 'head', 'ear-near', 'ear-far', 'eyes-open', 'eyes-closed', 'tail', 'leg-front-near', 'leg-front-far', 'leg-back-near', 'leg-back-far', 'paw-raised'];
const POSES = ['sit', 'loaf', 'sleep-curl', 'belly-up', 'stretch', 'groom', 'sit-up', 'dangle'];
// The walk-1..walk-6 frames are optional and only generated when named with --only.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** A lower per-run cap (--max-calls N) for a small batch; never above MAX_CALLS. */
const callCap = Math.min(MAX_CALLS, Number(arg('max-calls') ?? MAX_CALLS) || MAX_CALLS);
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
    if (calls >= callCap) throw new Error(`Call cap of ${callCap} per run reached; aborting.`);
    calls++;
    try {
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], messages: [{ role: 'user', content }] }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new Retryable(`request failed: ${(err as Error).name === 'TimeoutError' ? 'timed out' : (err as Error).message}`);
      }
      const text = await res.text();
      const json = parseBody(text) as any;
      if (!res.ok) {
        const message = `HTTP ${res.status}: ${(json === undefined ? text : JSON.stringify(json)).slice(0, 500)}`;
        throw isRetryableStatus(res.status) ? new Retryable(message) : new Error(message);
      }
      if (json === undefined) throw new Retryable(`HTTP ${res.status} with a non-JSON body: ${text.slice(0, 300)}`);
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
      if (!(err instanceof Retryable) || attempt === MAX_RETRIES) throw err;
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
  if (!(SPECIES as readonly string[]).includes(species)) {
    console.error(`Unknown --species. Species: ${SPECIES.join(', ')}.`);
    process.exit(1);
  }
  const coats: readonly string[] = COATS[species as Species];
  if (!coats.includes(coat)) {
    console.error(`Unknown --coat for a ${species}. Coats: ${coats.join(', ')}.`);
    process.exit(1);
  }
  const subjects = SUBJECTS[species as Species];
  const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const dir = join('art', 'source', species, coat);
  mkdirSync(dir, { recursive: true });
  const coatWords = coat.replace(/-/g, ' ');
  const prompt = (subject: string, isPart: boolean) =>
    isPart
      ? `Edit the attached ${coatWords} ${species} pixel art image (96x96 grid, side view facing right). Keep ONLY ${subject}, exactly as it is in the image: same position, same size, same pixels, same canvas. Paint everything else flat magenta #FF00FF. No shadow, no text, no outline of removed parts. Output one square image.`
      : `pixel art, 96x96 grid, side view facing right, ${coatWords} ${species}, ${subject}, flat magenta #FF00FF background, no shadow, no text. Use the attached image as the reference for style, colours and proportions. Same canvas and same scale as the reference ${species}, with the feet on the same baseline as the reference. Output one square image.`;

  let reference = arg('reference') ?? join(dir, 'reference.png');
  if (!arg('reference') && (!existsSync(reference) || only?.includes('reference'))) {
    console.log('generating reference');
    const refPrompt = `pixel art, 96x96 grid, side view facing right, ${coatWords} ${species}, ${subjects.reference}, flat magenta #FF00FF background, no shadow, no text. Output one square image.`;
    writeFileSync(reference, await generate(refPrompt, key));
    makeSquare(reference);
  }
  const names = (only ?? [...PARTS, ...POSES]).filter((n) => n !== 'reference');
  for (const name of names) {
    if (!subjects[name]) {
      console.error(`unknown name: ${name}`);
      process.exit(1);
    }
    console.log(`generating ${name}`);
    const file = join(dir, `${name}.png`);
    writeFileSync(file, await generate(prompt(subjects[name], PARTS.includes(name)), key, reference));
    makeSquare(file);
  }
  console.log(`done: ${calls} calls${sawCost ? `, reported cost about $${totalCost.toFixed(4)}` : ''}`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
