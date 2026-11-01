/**
 * Records the browser demo (demo.html) to docs/assets/demo.mp4 and docs/assets/demo.gif.
 * Builds with Vite, serves dist with `vite preview` on a free port, films 25 s in Playwright
 * Chromium at 1280 by 720, then converts the video with ffmpeg. Run: `npm run demo:record`.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'docs/assets');
const VIEWPORT = { width: 1280, height: 720 };
const RECORD_MS = 25_000;
/** Matches the Dock geometry in demo.html: the floor sits this far above the bottom. */
const FLOOR_FROM_BOTTOM_PX = 80;
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
/** The demo query; override with DEMO_SEED and DEMO_SPEED to try other runs. */
const SEED = process.env.DEMO_SEED ?? '7';
const SPEED = process.env.DEMO_SPEED ?? '3';

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited with ${r.status ?? r.signal}`);
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? ok(address.port) : fail(new Error('no port'))));
    });
  });
}

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Preview server did not start at ${url}`);
}

/** A slow sweep along the floor and back, passing over the cats. */
async function strollCursor(page: Page, ms: number): Promise<void> {
  const y = VIEWPORT.height - FLOOR_FROM_BOTTOM_PX - 30;
  const steps = Math.round(ms / 50);
  for (let i = 0; i <= steps; i++) {
    const phase = i / steps;
    const x = VIEWPORT.width * (0.15 + 0.7 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2)));
    await page.mouse.move(x, y + 18 * Math.sin(phase * Math.PI * 6));
    await page.waitForTimeout(50);
  }
}

function sizeMb(file: string): string {
  return `${(statSync(file).size / 1024 / 1024).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  run('npx', ['vite', 'build']);
  const port = await freePort();
  const preview: ChildProcess = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  const videoDir = mkdtempSync(join(tmpdir(), 'windowsill-demo-'));
  // Synchronous, so it also runs from the 'exit' event after Ctrl+C.
  const cleanUp = (): void => {
    if (preview.pid !== undefined) {
      try {
        process.kill(-preview.pid, 'SIGTERM');
      } catch {
        // ESRCH: the preview group is already gone.
      }
    }
    rmSync(videoDir, { recursive: true, force: true });
  };
  process.once('exit', cleanUp);
  process.once('SIGINT', () => process.exit(130));

  let browser: Browser | undefined;
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForServer(`${base}/demo.html`);

    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: videoDir, size: VIEWPORT },
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto(`${base}/demo.html?speed=${SPEED}&seed=${SEED}`);
    await page.waitForSelector('#pets canvas');
    await page.mouse.move(VIEWPORT.width * 0.5, VIEWPORT.height * 0.3);

    await page.waitForTimeout(8_000);
    await strollCursor(page, 10_000);
    await page.waitForTimeout(RECORD_MS - 18_000);

    const video = page.video();
    await context.close();
    await browser.close();
    if (!video) throw new Error('Playwright did not record a video');
    const raw = await video.path();

    mkdirSync(OUT_DIR, { recursive: true });
    const mp4 = join(OUT_DIR, 'demo.mp4');
    const gif = join(OUT_DIR, 'demo.gif');
    // Skip the first second, while the page loads its sprite sheets.
    run(FFMPEG, [
      '-y', '-loglevel', 'error', '-ss', '1', '-i', raw,
      '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4,
    ]);
    run(FFMPEG, [
      '-y', '-loglevel', 'error', '-ss', '1', '-i', raw,
      '-vf',
      'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
      gif,
    ]);
    console.log(`demo.mp4 ${sizeMb(mp4)}, demo.gif ${sizeMb(gif)}`);
  } finally {
    await browser?.close().catch(() => {});
    cleanUp();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
