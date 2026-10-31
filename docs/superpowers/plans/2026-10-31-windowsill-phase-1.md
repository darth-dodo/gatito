# Windowsill Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel cats that live on the macOS desktop: create them, pet them, pick them up, and teach them tricks from the cue ring, with mood and memory.

**Architecture:** A Tauri 2 app with one transparent, always-on-top, non-focusable overlay window per primary display. A pure TypeScript "brain" (mood, behaviour choice, learning, stroke detection, save format) is unit-tested with no DOM; a simulation layer moves cats on a fixed step; PixiJS draws each pet as a cut-out puppet (parts plus key poses) from a sprite sheet built by an art pipeline. Rust owns OS work: click-through by polling the cursor against pet hit boxes, the usable screen area, user idle time, the save file and the menu bar menu.

**Tech Stack:** Tauri 2 (Rust stable), `@tauri-apps/api` 2.12.4, `@tauri-apps/cli` 2.12.4, `@tauri-apps/plugin-autostart` 2.7.0, Vite 8.3.5, TypeScript 7.0.2, Vitest 5.0.5, `pixi.js` 8.22.0, `sharp` 0.35.5 (dev, art pipeline only), Rust crate `user-idle` (latest at scaffold time, pinned in `Cargo.lock`).

**Spec:** `docs/product.md`. Executors read the spec and this plan together; behaviour names in **bold** come from the spec.

**Linear:** https://linear.app/ai-adventures/project/windowsill-4763d10a1709

## Global Constraints

- Platform: macOS only; primary display only in Phase 1.
- No accounts, no telemetry, no analytics; the app makes no network calls in Phase 1.
- Clicks pass through everywhere except on a cat; the overlay never takes focus and never appears in the Dock or Cmd-Tab, and shows on every Space.
- Cats never move, resize or focus real windows.
- At most 6 pets. Name: required, up to 20 characters (count graphemes, trim whitespace).
- Species: `cat` only in Phase 1; the type includes `dog` (Phase 2) so dogs need no engine change. Styles: `pixel` only in Phase 1 (the type lists all four). Colours: orange tabby, black, white, grey, tuxedo, calico, Siamese. Personalities: Cosy, Curious, Mischievous, Social; personality is fixed at birth.
- Cues: Whistle, Clap, Toy wand, Treat bag. Tricks: Spin, Sit up, Roll over, High five, Chase tail.
- Mood and trick fading move only on active time: app running, user input within the last 300 s, Nap time off.
- Save state: one versioned JSON file in the OS app-data folder; meter values, not timestamps.
- No sounds in Phase 1.
- Art: pixel art on a 48 by 48 grid, side view facing right, cut-out parts and key poses exactly as named in the spec's Art section; real art and placeholders share those names.
- Never use em or en dashes in code, comments, docs or commit messages. Conventional commits.
- Every numeric value marked *(tunable)* in the spec lives in `src/brain/tuning.ts`, nowhere else.

## Review Focus

1. **The usable screen area changes while running** (Dock resized or moved, resolution changed): every cat re-floors onto the new bottom edge and none is left off screen. Test in Task 7.
2. **A corrupt, empty or newer-version save file**: the app starts with no cats (first run), keeps the bad file as `windowsill.json.bad`, and never crashes. Test in Task 6.
3. **A cat dropped or dragged off screen** (above the top, past an edge): it is clamped back inside the screen and lands on the floor. Test in Task 7.
4. **Resume after sleep produces a huge frame delta**: the fixed-step loop clamps the delta so cats do not teleport and mood does not jump. Test in Task 10.
5. **Awkward names** (only spaces, emoji, 21 graphemes, duplicates): spaces-only is rejected, emoji counts as one character each, the 21st grapheme is rejected, duplicate names are allowed. Test in Task 12.

---

## File Structure

```
windowsill/
  package.json  tsconfig.json  vite.config.ts  index.html  create.html
  src/
    brain/                  pure logic, no DOM, unit tested
      types.ts              Pet, Species, Mood, Personality, Colour, Style, Cue, Trick, BehaviourName
      tuning.ts             every tunable number from the spec
      rng.ts                seeded Rng for deterministic tests
      mood.ts               meters over active time, petting, rewards
      behaviour.ts          weighted behaviour choice from personality and mood
      learning.ts           cue to trick strengths, guessing, reward, fade, willingness
      stroke.ts             stroke detection from cursor samples
      clock.ts              active-time accounting and frame-delta clamp
      save.ts               save format v1: serialise, parse, validate
      names.ts              name validation
    sim/
      world.ts              cats in space: floor, gravity, drag, clamping
      controller.ts         per-cat action state machine driven by the brain
    render/
      rig.ts                pure: animation + time + mood -> pose and part transforms
      stage.ts              PixiJS stage: one puppet container per pet
      effects.ts            hearts, z, sparkle particles and the cue ring
    assets/atlas/           built sprite sheets (<species>-<coat>.png + .json)
  art/
    source/<species>/<coat>/<name>.png   owner's GenAI images
    rig/<species>.json      part pivots and layer order
  scripts/art/
    build.ts                magenta key, grid snap, 16 colours, trim, pack
    recolour.ts             orange tabby -> black, white, grey palette maps
    placeholder.ts          code-drawn placeholder parts and poses
    overlay/
      main.ts               overlay entry: loop, IPC wiring
      input.ts              hover, stroke, drag, right-click routing
      cueRing.ts            cue ring layout and hit test
    create/main.ts          New and Edit pet window
    ipc.ts                  typed wrappers for Tauri commands and events
  src-tauri/
    Cargo.toml  tauri.conf.json  capabilities/default.json
    src/main.rs  src/lib.rs
    src/overlay.rs          overlay window setup and click-through polling
    src/screen.rs           usable screen area
    src/idle.rs             user idle seconds
    src/store.rs            load and atomic save of windowsill.json
    src/tray.rs             menu bar menu
  tests/                    Vitest, mirrors src/ (tests/brain/mood.test.ts ...)
```

---

### Task 1: Scaffold and a visible overlay

**Files:**
- Create: everything under the root listed above except `src/brain`, `src/sim`, `src/render`, `src/create` contents; `src-tauri/src/overlay.rs`, `screen.rs`, `lib.rs`, `main.rs`
- Test: `tests/smoke.test.ts`, `src-tauri/src/overlay.rs` (unit tests)

**Interfaces:**
- Produces: Rust command `get_floor() -> Floor { x: f64, y: f64, width: f64, bottom: f64 }` in logical pixels relative to the overlay window (bottom is the usable area's bottom edge). Event `floor-changed` with the same payload. Front end `ipc.getFloor(): Promise<Floor>` and `ipc.onFloorChanged(cb)`.

- [ ] **Step 1: Install prerequisites.** Rust stable via `rustup` (`curl https://sh.rustup.rs -sSf | sh`, then restart the shell); and Xcode Command Line Tools (`xcode-select --install`). Verify: `cargo --version` prints a version.
- [ ] **Step 2: Scaffold** a Tauri 2 + Vite + vanilla TypeScript app (`npm create tauri-app@latest`, template `vanilla-ts`, identifier `com.darthdodo.windowsill`), then pin the npm versions listed in Tech Stack and add Vitest with `npm test` running `vitest run`.
- [ ] **Step 3: Write failing Rust test** `floor_uses_work_area_bottom`: given a monitor rect `(0,0,1440,900)` and work area `(0,25,1440,800)` (logical), `floor_from(monitor, work_area)` returns `Floor { x: 0, y: 25, width: 1440, bottom: 825 }`.
- [ ] **Step 4: Run** `cd src-tauri && cargo test floor_uses_work_area_bottom`. Expected: FAIL, `floor_from` not found.
- [ ] **Step 5: Implement** `screen.rs::floor_from(monitor: Rect, work: Rect) -> Floor` and `get_floor` using the primary monitor's `work_area()`; emit `floor-changed` when the monitor's work area differs on a 2 s poll.
- [ ] **Step 6: Overlay window** in `overlay.rs`: label `overlay`, sized to the primary monitor, `transparent(true)`, `decorations(false)`, `always_on_top(true)`, `focusable(false)`, `shadow(false)`, `visible_on_all_workspaces(true)`; `ActivationPolicy::Accessory` so there is no Dock icon. Enable `macOSPrivateApi` for transparency. Body and canvas backgrounds are transparent.
- [ ] **Step 7: Smoke test** `tests/smoke.test.ts`: `npm test` passes with one trivial assertion that imports `src/ipc.ts` types.
- [ ] **Step 8: Run** `npm test` and `cargo test`. Expected: PASS. Then `npm run tauri dev`: a 64 px orange square sits on the bottom edge of the usable area, above the Dock; the desktop behind is visible. (Clicks are blocked everywhere until Task 8; that is expected now.)
- [ ] **Step 9: Commit** `feat: scaffold Tauri overlay window on the usable screen area`.

### Task 2: Brain types, tuning, rng and mood

**Files:**
- Create: `src/brain/types.ts`, `tuning.ts`, `rng.ts`, `mood.ts`
- Test: `tests/brain/mood.test.ts`

**Interfaces:**
- Produces:
  - `type Personality = 'cosy' | 'curious' | 'mischievous' | 'social'`
  - `type Colour = 'orange-tabby' | 'black' | 'white' | 'grey' | 'tuxedo' | 'calico' | 'siamese'`
  - `type Species = 'cat' | 'dog'`
  - `type Style = 'pixel' | 'soft' | 'ink' | 'silhouette'`
  - `type Cue = 'whistle' | 'clap' | 'toy-wand' | 'treat-bag'`
  - `type Trick = 'spin' | 'sit-up' | 'roll-over' | 'high-five' | 'chase-tail'`
  - `interface Mood { affection: number; energy: number }` (0 to 100)
  - `interface Pet { id: string; species: Species; name: string; style: Style; colour: Colour; personality: Personality; mood: Mood; pairings: Pairings }` (`Pairings` from Task 4, declared here as `Record<Cue, Record<Trick, number>>`)
  - `interface Rng { next(): number }` and `seededRng(seed: number): Rng` (mulberry32)
  - `tickMood(mood: Mood, activeSeconds: number, activity: 'napping' | 'resting' | 'active'): Mood`
  - `petMood(mood: Mood, strokes: number): Mood`, `rewardMood(mood: Mood): Mood`

- [ ] **Step 1: Write failing tests** in `tests/brain/mood.test.ts`:
  - `affection drains 10 per active hour`: `tickMood({affection: 50, energy: 50}, 3600, 'resting').affection` is `40`.
  - `napping restores energy`: energy rises by `TUNING.energyNapPerHour` per hour napping.
  - `activity drains energy`: energy falls by `TUNING.energyActivePerHour` per active hour.
  - `meters clamp to 0..100`: 20 hours resting from affection 50 gives `0`; petting at 99 gives `100`.
  - `petting raises affection by strokes`: `petMood(m, 3).affection === m.affection + 3 * TUNING.affectionPerStroke`.
  - `reward raises affection`: `+ TUNING.affectionPerReward`.
- [ ] **Step 2: Run** `npm test -- mood`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** types, `seededRng`, and `mood.ts`. `tuning.ts` starting values: `affectionDrainPerHour: 10`, `energyNapPerHour: 40`, `energyActivePerHour: 15`, `affectionPerStroke: 2`, `affectionPerReward: 5`, `activeIdleSeconds: 300`, `underCursorSeconds: 2`, `strokesForPurr: 3`, `strokeWindowSeconds: 2`, `cuddleNapIdleSeconds: 180`, `rewardWindowSeconds: 3`, `learnedShare: 0.8`, `fadeActiveHours: 40`, `cheekyChance: 1 / 7`, `maxCats: 6`, `maxNameLength: 20`.
- [ ] **Step 4: Run** `npm test -- mood`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(brain): add cat types, tuning and mood meters`.

### Task 3: Behaviour choice

**Files:**
- Create: `src/brain/behaviour.ts`
- Test: `tests/brain/behaviour.test.ts`

**Interfaces:**
- Consumes: `Pet`, `Mood`, `Rng`, `TUNING`.
- Produces: `type BehaviourName = 'idle-sit' | 'wander' | 'groom' | 'stretch' | 'nap' | 'loaf' | 'zoomies' | 'stare' | 'cuddle-nap' | 'content-sit' | 'grumpy-sit'`; `behaviourWeights(pet: Pet, ctx: { userIdleSeconds: number; justWoke: boolean }): Record<BehaviourName, number>`; `chooseBehaviour(cat, ctx, rng): BehaviourName`.

- [ ] **Step 1: Write failing tests:**
  - `tired cats mostly nap`: energy 10 gives `nap` the largest weight for every personality.
  - `neglect raises mischief, scaled by personality`: at affection 10, the share of `zoomies + stare + grumpy-sit` is highest for mischievous and lowest for cosy, and every personality's share is higher than at affection 90.
  - `cuddle nap needs affection and an idle user`: `cuddle-nap` weight is 0 unless `userIdleSeconds >= 180` and affection >= 70.
  - `stretch follows waking`: `justWoke: true` makes `stretch` the largest weight.
  - `personality leanings`: at neutral mood (50/50), cosy's top weight is `nap` or `loaf`; curious's is `wander`; mischievous's mischief share beats cosy's.
  - `choice is deterministic for a seed`: 1000 draws with `seededRng(1)` match the weight shares within 3 percentage points.
- [ ] **Step 2: Run** `npm test -- behaviour`. Expected: FAIL.
- [ ] **Step 3: Implement.** Base weight table per personality, then multipliers: mischief behaviours multiplied by `1 + (1 - affection/100) * m` where `m` is 3.0 mischievous, 1.8 curious, 1.5 social, 0.9 cosy; `nap` multiplied by `1 + (1 - energy/100) * 6`; `content-sit` scales with affection, `grumpy-sit` with its inverse. Exact base numbers are the builder's call.
- [ ] **Step 4: Run** `npm test -- behaviour`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(brain): choose behaviours from personality and mood`.

### Task 4: Learning tricks

**Files:**
- Create: `src/brain/learning.ts`
- Test: `tests/brain/learning.test.ts`

**Interfaces:**
- Consumes: `Cue`, `Trick`, `Pet`, `Rng`, `TUNING`.
- Produces: `type Pairings = Record<Cue, Record<Trick, number>>`; `newPairings(): Pairings` (all 1.0); `guessTrick(p: Pairings, cue: Cue, rng: Rng): Trick`; `reward(p, cue, trick): Pairings`; `noReward(p, cue, trick): Pairings`; `fade(p, activeSeconds): Pairings`; `learnedTrick(p, cue): Trick | null`; `respondToCue(pet: Pet, cue: Cue, rng: Rng): { kind: 'perform'; trick: Trick; cheeky: boolean } | { kind: 'yawn' } | { kind: 'walk-away' }`.

- [ ] **Step 1: Write failing tests:**
  - `reward strengthens`: strength rises by 2.0.
  - `no reward weakens`: strength multiplied by 0.8, floor 0.2.
  - `learned at 80 percent share`: `learnedTrick` returns the trick once its strength over the cue's total is at least 0.8, else `null`.
  - `teaches in 5 to 8 rewarded rounds`: simulate a trainer who rewards only `spin` for `whistle` and ignores other guesses, with `seededRng(seed)` for seeds 1 to 50; the median number of rewarded rounds until `learnedTrick` returns `spin` is between 5 and 8.
  - `fades toward even over 40 active hours`: after `fade(p, 40 * 3600)` every strength is within 0.1 of 1.0; after 1 active hour a learned pairing is still learned.
  - `tired cats yawn`: energy below 20 gives `{ kind: 'yawn' }`.
  - `unloved cats may walk away`: affection below 25 gives `walk-away` about half the time over 1000 seeded draws.
  - `cheeky mischief`: a mischievous cat that has learned `spin` for `whistle` performs another trick with `cheeky: true` in 1/7 of 7000 draws (within 1.5 points); other personalities are never cheeky.
- [ ] **Step 2: Run** `npm test -- learning`. Expected: FAIL.
- [ ] **Step 3: Implement.** `guessTrick` samples proportional to strength. `fade` moves each strength toward 1.0: `s = 1 + (s - 1) * exp(-hours / (fadeActiveHours / 3))`.
- [ ] **Step 4: Run** `npm test -- learning`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(brain): reward-based trick learning with fading and willingness`.

### Task 5: Stroke detection and the active clock

**Files:**
- Create: `src/brain/stroke.ts`, `src/brain/clock.ts`
- Test: `tests/brain/stroke.test.ts`, `tests/brain/clock.test.ts`

**Interfaces:**
- Produces: `class StrokeDetector { feed(x: number, tSeconds: number): number /* completed strokes so far */; purring(tSeconds: number): boolean; reset(): void }` where a stroke is a horizontal direction reversal after at least 12 px of travel inside the cat; `activeSeconds(dtSeconds: number, s: { userIdleSeconds: number; napTime: boolean }): number`; `clampFrameDelta(dtSeconds: number): number` (max 0.25 s).

- [ ] **Step 1: Write failing tests:**
  - `three strokes in two seconds purr`: x samples 0, 20, 0, 20 over 1.5 s give 3 strokes and `purring` true.
  - `slow strokes do not purr`: the same samples over 5 s give `purring` false.
  - `jitter is not a stroke`: back-and-forth of 4 px gives 0 strokes.
  - `idle user stops the clock`: `activeSeconds(1, { userIdleSeconds: 301, napTime: false })` is 0; at 299 it is 1.
  - `nap time stops the clock`: `napTime: true` gives 0.
  - `huge deltas are clamped`: `clampFrameDelta(7200)` is 0.25.
- [ ] **Step 2: Run** `npm test -- stroke clock`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(brain): detect petting strokes and count only active time`.

### Task 6: Save file

**Files:**
- Create: `src/brain/save.ts`, `src-tauri/src/store.rs`
- Test: `tests/brain/save.test.ts`, unit tests in `store.rs`

**Interfaces:**
- Consumes: `Pet`.
- Produces: `interface SaveFile { version: 1; pets: Pet[]; settings: { napTime: boolean } }`; `serialise(s: SaveFile): string`; `parseSave(text: string): { ok: true; save: SaveFile } | { ok: false; reason: string }`; Rust commands `load_save() -> Option<String>` and `write_save(text: String)`; on a parse failure the front end calls `quarantine_save()` which renames the file to `windowsill.json.bad`.

- [ ] **Step 1: Write failing TS tests:** round trip of two cats is identical; `parseSave('')`, `parseSave('{')`, `parseSave('{"version":2,...}')`, a cat with an unknown colour, a pet with species `dog` (Phase 2, so rejected in Phase 1), and a meter of 150 each return `ok: false`; more than 6 cats is rejected.
- [ ] **Step 2: Write failing Rust tests:** `write_is_atomic` (writes to `windowsill.json.tmp` then renames; a pre-existing file survives a failed write); `quarantine_renames` moves the file to `windowsill.json.bad`.
- [ ] **Step 3: Run** `npm test -- save` and `cargo test store`. Expected: FAIL.
- [ ] **Step 4: Implement.** File lives in `app.path().app_data_dir()`/`windowsill.json`. Front end writes debounced 2 s after any change and on quit.
- [ ] **Step 5: Run both.** Expected: PASS.
- [ ] **Step 6: Commit** `feat: versioned save file with atomic writes and quarantine`.

### Task 7: World physics

**Files:**
- Create: `src/sim/world.ts`
- Test: `tests/sim/world.test.ts`

**Interfaces:**
- Consumes: `Floor` from `ipc.ts`.
- Produces: `interface Body { id: string; x: number; y: number; vx: number; vy: number; facing: 1 | -1; held: boolean; grounded: boolean; width: number; height: number }`; `class World { constructor(floor: Floor); setFloor(f: Floor): void; add(b: Body): void; remove(id: string): void; step(dt: number): void; pickUp(id: string, x: number, y: number): void; dragTo(id: string, x: number, y: number): void; drop(id: string): void; bodies(): Body[] }`.

- [ ] **Step 1: Write failing tests:**
  - `dropped cats fall and land on the floor`: a body released 300 px above the floor is grounded on `floor.bottom` within 2 s of steps, with `vy` 0.
  - `walkers turn at screen edges`: a body walking right at the right edge flips `facing` and stays inside.
  - `floor change re-floors every cat` (Review Focus 1): after `setFloor` with a bottom 80 px higher, every grounded body sits on the new bottom after one step.
  - `off-screen drops are clamped` (Review Focus 3): drop at `x = -500, y = -400` ends grounded with `x` inside `[floor.x, floor.x + floor.width - width]`.
  - `held cats do not fall`: a held body stays at its drag point.
- [ ] **Step 2: Run** `npm test -- world`. Expected: FAIL.
- [ ] **Step 3: Implement** with gravity 2400 px/s², fixed step 1/60 s inside `step`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(sim): floor, gravity, dragging and screen clamping`.

### Task 8: Click-through

**Files:**
- Modify: `src-tauri/src/overlay.rs`, `src/ipc.ts`
- Test: unit tests in `overlay.rs`; manual checklist below

**Interfaces:**
- Produces: Rust command `set_hitboxes(boxes: Vec<Rect>)` (logical px, window-relative); event `cursor` `{ x: f64, y: f64 }` emitted at 20 Hz; Rust pure fn `cursor_hits(boxes: &[Rect], p: Point) -> bool`; front end `ipc.setHitboxes(rects)`, `ipc.onCursor(cb)`.

- [ ] **Step 1: Write failing Rust tests:** `cursor_hits` true inside a box, false outside, false with no boxes, true on the box edge.
- [ ] **Step 2: Run** `cargo test cursor_hits`. Expected: FAIL.
- [ ] **Step 3: Implement** a 60 Hz polling thread: read `app.cursor_position()`, convert to window logical coordinates, call `set_ignore_cursor_events(!hit)` only when the result changes; the window starts ignoring events. Emit `cursor` at 20 Hz regardless.
- [ ] **Step 4: Run** `cargo test`. Expected: PASS.
- [ ] **Step 5: Manual check** with `npm run tauri dev` and the Task 1 square registered as a hit box: clicking anywhere else reaches the app underneath (Finder, a browser); hovering the square makes it receive clicks; the overlay never shows in Cmd-Tab or the Dock.
- [ ] **Step 6: Commit** `feat: click-through except on cat hit boxes`.

### Task 9: Art pipeline and placeholder sprite sheets

**Files:**
- Create: `scripts/art/build.ts`, `scripts/art/recolour.ts`, `scripts/art/placeholder.ts`, `art/rig/cat.json`, `src/render/artNames.ts`
- Modify: `package.json` (`"art": "tsx scripts/art/build.ts"`; add `sharp` 0.35.5 and `tsx` as dev dependencies)
- Test: `tests/art/build.test.ts`, `tests/art/recolour.test.ts`, fixtures in `tests/art/fixtures/`

**Interfaces:**
- Produces: `PART_NAMES` (`body`, `head`, `ear-near`, `ear-far`, `eyes-open`, `eyes-closed`, `tail`, `leg-front-near`, `leg-front-far`, `leg-back-near`, `leg-back-far`, `paw-raised`) and `POSE_NAMES` (`sit`, `loaf`, `sleep-curl`, `belly-up`, `stretch`, `groom`, `sit-up`, `dangle`) in `src/render/artNames.ts`; `buildAtlas(species: Species, coat: Colour, srcDir: string, outDir: string): Promise<{ missing: string[] }>`; `recolour(png: Buffer, from: Colour, to: Colour): Promise<Buffer>`; `writePlaceholders(species: Species, coat: Colour, dir: string): Promise<void>`; output `src/assets/atlas/<species>-<coat>.json` in PixiJS sprite sheet format, frame names equal to part and pose names, pivots from `art/rig/cat.json`.

- [ ] **Step 1: Write failing tests:**
  - `magenta becomes transparent`: a fixture with a `#FF00FF` background has alpha 0 there after the build, and the cat pixels are untouched.
  - `any size snaps to the 48 grid`: a 480 by 480 fixture made of 10 by 10 blocks becomes 48 by 48 with each block one pixel (nearest neighbour, no blending).
  - `at most 16 colours`: a fixture with 40 colours comes out with 16 or fewer.
  - `missing parts are listed`: a source folder without `tail` and `sit` returns `missing: ['tail', 'sit']` and `npm run art` exits 1 naming them.
  - `placeholders cover every name`: after `writePlaceholders`, `buildAtlas` reports nothing missing and the atlas JSON has every part and pose frame.
  - `recolour maps tabby to grey`: each orange palette entry in a fixture maps to its grey counterpart; outline and eye colours are unchanged.
- [ ] **Step 2: Run** `npm test -- art`. Expected: FAIL.
- [ ] **Step 3: Implement.** `npm run art` builds every species and coat folder under `art/source`; for black, white and grey with no folder of their own it recolours the orange tabby set; for any missing coat set it writes placeholders only when `--placeholders` is passed (the default script in dev).
- [ ] **Step 4: Run** `npm test -- art` and `npm run art -- --placeholders`. Expected: PASS, and `src/assets/atlas/cat-orange-tabby.json` exists.
- [ ] **Step 5: Commit** `feat(art): pipeline from GenAI images to PixiJS sprite sheets, with placeholders`.

### Task 10: PixiJS puppets and the living loop

**Files:**
- Create: `src/render/rig.ts`, `src/render/stage.ts`, `src/render/effects.ts`, `src/sim/controller.ts`, `src/overlay/main.ts`
- Test: `tests/render/rig.test.ts`, `tests/sim/controller.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 9.
- Produces: `type AnimName` covering every `BehaviourName`, the five tricks, `walk`, `dangle`, `fall`, `land`, `purr`, `belly-up`, `yawn`; `rigPose(anim: AnimName, t: number, mood: Mood): RigFrame` where `RigFrame = { pose: PoseName | 'puppet'; parts: Partial<Record<PartName, { x: number; y: number; rotation: number; visible: boolean }>>; flipX: boolean; rotation: number }`; `class PetController { constructor(pet: Pet, body: Body, rng: Rng); update(dt: number, ctx: ControllerContext): void; anim(): { name: AnimName; t: number }; start(action: { kind: 'trick'; trick: Trick } | { kind: 'purr' } | { kind: 'yawn' } | { kind: 'walk-away' }): void }`; `class PetStage { constructor(app: Application); add(pet: Pet, atlas: Spritesheet): void; remove(id: string): void; draw(id: string, body: Body, frame: RigFrame): void }`.

- [ ] **Step 1: Write failing tests:**
  - `behaviours use the spec's poses`: `rigPose('nap', 0, m).pose` is `sleep-curl`, `loaf` is `loaf`, `idle-sit`, `content-sit` and `grumpy-sit` are `sit`, `walk` is `puppet`.
  - `walking swings legs in pairs`: during `walk`, `leg-front-near` and `leg-back-far` share a rotation sign, opposite to the other pair, across a cycle.
  - `mood moves ears and tail`: at affection 10 the ears rotate further back and the tail swings faster than at affection 90.
  - `blinks`: `eyes-closed` is visible for a short window at least once every 6 s of `idle-sit`.
  - `spin and roll over are code-made`: `spin` toggles `flipX` within its duration; `roll-over` passes through `belly-up` with a full `rotation` turn.
  - `controller plays a behaviour then picks the next`: a seeded cat finishes `groom` and starts another behaviour; waking from `nap` always plays `stretch` before `wander`.
  - `huge resume delta is safe` (Review Focus 4): one `update(7200)` through `clampFrameDelta` moves a walking cat by at most one clamped step.
  - `never in the way`: with the cursor still over a cat for more than 2 s, it starts a short `wander` aside.
- [ ] **Step 2: Run** `npm test -- rig controller`. Expected: FAIL.
- [ ] **Step 3: Implement.** `PetStage` builds one container per pet: pose sprites and puppet parts from the atlas, layered by `art/rig/cat.json`, `texture.source.scaleMode = 'nearest'`, whole-number scale (2x). `overlay/main.ts` creates a transparent PixiJS `Application` (`backgroundAlpha: 0`), runs its ticker, clamps the delta, steps world and controllers, ticks mood with `activeSeconds`, pushes hit boxes to Rust when they move, and draws. `effects.ts` holds the floating "z" here; hearts and sparkle arrive with Tasks 11 and 13.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: one hard-coded placeholder cat wanders, grooms, naps with a floating "z", stretches awake, and its tail and blinks keep moving.
- [ ] **Step 5: Commit** `feat: PixiJS puppet pets that live on the floor`.

### Task 11: Petting, picking up and dropping

**Files:**
- Create: `src/overlay/input.ts`
- Modify: `src/overlay/main.ts`, `src/sim/controller.ts`
- Test: `tests/overlay/input.test.ts`

**Interfaces:**
- Consumes: `StrokeDetector`, `World.pickUp/dragTo/drop`, `PetController.start`.
- Produces: `class InputRouter { pointerMove(x, y, t): void; pointerDown(x, y, button: 0 | 2): void; pointerUp(x, y): void }` dispatching to **Purr**, **Belly up**, **Pick up**, **Drop**, and (Task 13) the cue ring.

- [ ] **Step 1: Write failing tests:** moving back and forth over a cat 3 times in 1.5 s starts `purr` and raises affection by `3 * affectionPerStroke`; continued stroking for 3 more strokes starts `belly-up` for a cat with affection at least 70; press and move on a cat calls `pickUp` then `dragTo` and plays `dangle`; release calls `drop`, plays `fall` then `land`, and leaves mood unchanged.
- [ ] **Step 2: Run** `npm test -- input`. Expected: FAIL.
- [ ] **Step 3: Implement** and add rising hearts to `effects.ts` during purr.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: pet, pick up and drop on macOS.
- [ ] **Step 5: Commit** `feat: petting, purring and pick up and drop`.

### Task 12: Creating, editing and remembering pets

**Files:**
- Create: `src/brain/names.ts`, `create.html`, `src/create/main.ts`
- Modify: `src-tauri/src/lib.rs` (open the `create` window, `cats-changed` event), `src/overlay/main.ts`
- Test: `tests/brain/names.test.ts`, `tests/create/form.test.ts`

**Interfaces:**
- Produces: `validateName(raw: string): { ok: true; name: string } | { ok: false; reason: 'empty' | 'too-long' }`; Rust command `open_create_window(cat_id: Option<String>)`; event `cats-changed` carrying the full `SaveFile`.

- [ ] **Step 1: Write failing tests** (Review Focus 5): `'   '` is `empty`; `'  Mochi '` becomes `'Mochi'`; 20 emoji pass and 21 graphemes fail (`Intl.Segmenter`); two cats may share a name. Form: the seventh cat cannot be created (`maxCats` 6, the button is disabled with "6 cats is the limit"); personality is read-only when editing.
- [ ] **Step 2: Run** `npm test -- names form`. Expected: FAIL.
- [ ] **Step 3: Implement** **New pet** (species with only Cat enabled and Dog shown as "coming in Phase 2", name, style with only Pixel enabled and the others shown as "coming soon", colour, personality, live preview using `PetStage`; only coats whose sprite sheet exists are offered), **Edit pet**, **Rehome pet** (confirm dialog). A new cat drops in from the top of the screen. With no saved cats, **New pet** opens on launch (**First run**). New cats start at affection 60, energy 80, `newPairings()`.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: create two cats, quit, relaunch, both return with their moods.
- [ ] **Step 5: Commit** `feat: create, edit, rehome and remember pets`.

### Task 13: The cue ring and tricks

**Files:**
- Create: `src/overlay/cueRing.ts`
- Modify: `src/overlay/input.ts`, `src/sim/controller.ts`, `src/render/effects.ts`
- Test: `tests/overlay/cueRing.test.ts`, `tests/sim/tricks.test.ts`

**Interfaces:**
- Consumes: `respondToCue`, `reward`, `noReward`, `learnedTrick`, `rewardMood`.
- Produces: `cueRingLayout(center: Point): { cue: Cue; rect: Rect }[]`; `cueAt(layout, p: Point): Cue | null`. While the ring is open its rects are added to the hit boxes so the ring is clickable.

- [ ] **Step 1: Write failing tests:**
  - `ring has the four cues around the cat`: four rects, one per cue, none overlapping, all inside the screen even for a cat at the left edge.
  - `petting inside the window rewards`: cue, trick ends, strokes within 3 s call `reward` and `rewardMood`.
  - `silence is no reward`: no strokes for 3 s calls `noReward` once.
  - `first learn sparkles once`: the sparkle plays the first time `learnedTrick` turns non-null for a cue, not on later rounds.
  - `yawn and walk-away play their animations` instead of a trick.
  - `clicking outside the ring closes it` without choosing a cue.
- [ ] **Step 2: Run** `npm test -- cueRing tricks`. Expected: FAIL.
- [ ] **Step 3: Implement** right-click opening the ring with the icons 🎵 👏 🪶 🐟.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: teach a fresh cat Whistle to Spin and count the rounds (expect about 5 to 8).
- [ ] **Step 5: Commit** `feat: cue ring and reward-trained tricks`.

### Task 14: Menu bar menu, Nap time, idle time and launch at login

**Files:**
- Create: `src-tauri/src/tray.rs`, `src-tauri/src/idle.rs`
- Modify: `src-tauri/src/lib.rs`, `src/overlay/main.ts`
- Test: unit test in `idle.rs`; `tests/overlay/napTime.test.ts`

**Interfaces:**
- Produces: Rust command `user_idle_seconds() -> u64` (via `user-idle`, 0 on error); events `nap-time` `{ on: bool }`, `call-over` `{ id }`; tray built from the current cats on `cats-changed`.

- [ ] **Step 1: Write failing tests:** `idle_never_panics` (returns a number on the CI host); `nap time hides and stops the clock`: with `napTime` on, cats play curl-up then fade out, `activeSeconds` returns 0, and toggling off fades them back with moods unchanged; `call over walks to the centre`.
- [ ] **Step 2: Run** `cargo test idle` and `npm test -- napTime`. Expected: FAIL.
- [ ] **Step 3: Implement** the menu bar menu (Tauri tray API): icon is a small monochrome cat head template image; items **New pet…**, one submenu per cat (**Edit…**, **Call over**, **Rehome…**), **Nap time** (check item, persisted in settings), **Launch at login** (check item via `tauri-plugin-autostart`, off by default), **Quit Windowsill** (saves first). The Gemma status entry is Phase 2 and is not added. The overlay polls `user_idle_seconds` every 5 s and feeds `activeSeconds` and **Cuddle nap**.
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: tray menu, nap time, idle-aware clock and launch at login`.

### Task 15: macOS release checks

**Files:**
- Create: `docs/release-checklist.md`, `.github/workflows/ci.yml`
- Modify: `README.md` (install and use), `src-tauri/tauri.conf.json` (bundle target `dmg`, `LSUIElement` true)

- [ ] **Step 1: CI** on `macos-latest` runs `npm ci`, `npm run art -- --placeholders`, `npm test`, `npx tsc --noEmit`, `cargo test`, `cargo clippy -- -D warnings`.
- [ ] **Step 2: Release checklist** in `docs/release-checklist.md`: zero clicks lost outside a pet (10 clicks across Finder and a browser); Dock at bottom, left, right and auto-hidden; pets on every Space and over a fullscreen app's Space switch; three cats for 10 minutes average under 2 % CPU and 150 MB memory (Activity Monitor, counting the WebKit process); state survives quit and reboot; a friend gets the pet-and-trick moment within 10 seconds.
- [ ] **Step 3: Build** `npm run tauri build`; an unsigned `.dmg` is fine for Phase 1. README covers install (right-click Open for the unidentified-developer warning), the menu bar menu, and how to drop GenAI art into `art/source` and run `npm run art`.
- [ ] **Step 4: Run** the checklist on a real Mac and record results in the checklist file.
- [ ] **Step 5: Commit** `chore: CI, macOS bundle and release checklist`.
