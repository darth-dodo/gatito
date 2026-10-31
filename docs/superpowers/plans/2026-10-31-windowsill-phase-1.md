# Windowsill Phase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel cats that live on the macOS and Windows desktop: create them, pet them, pick them up, and teach them tricks from the cue ring, with mood and memory.

**Architecture:** A Tauri 2 app with one transparent, always-on-top, non-focusable overlay window per primary display. A pure TypeScript "brain" (mood, behaviour choice, learning, stroke detection, save format) is unit-tested with no DOM; a simulation layer moves cats on a fixed step; a canvas renderer draws code-generated pixel sprites. Rust owns OS work: click-through by polling the cursor against cat hit boxes, the usable screen area, user idle time, the save file and the tray.

**Tech Stack:** Tauri 2 (Rust stable), `@tauri-apps/api` 2.12.4, `@tauri-apps/cli` 2.12.4, `@tauri-apps/plugin-autostart` 2.7.0, Vite 8.3.5, TypeScript 7.0.2, Vitest 5.0.5, Rust crate `user-idle` (latest at scaffold time, pinned in `Cargo.lock`).

**Spec:** `docs/product.md`. Executors read the spec and this plan together; behaviour names in **bold** come from the spec.

**Linear:** https://linear.app/ai-adventures/project/gatito-4763d10a1709

## Global Constraints

- Platforms: macOS and Windows; primary display only in Phase 1.
- No accounts, no telemetry, no analytics; the app makes no network calls in Phase 1.
- Clicks pass through everywhere except on a cat; the overlay never takes focus and never appears in the Dock, taskbar or Alt-Tab.
- Cats never move, resize or focus real windows.
- At most 6 pets. Name: required, up to 20 characters (count graphemes, trim whitespace).
- Species: `cat` only in Phase 1; the type includes `dog` (Phase 2) so dogs need no engine change. Styles: `pixel` only in Phase 1 (the type lists all four). Colours: orange tabby, black, white, grey, tuxedo, calico, Siamese. Personalities: Cosy, Curious, Mischievous, Social; personality is fixed at birth.
- Cues: Whistle, Clap, Toy wand, Treat bag. Tricks: Spin, Sit up, Roll over, High five, Chase tail.
- Mood and trick fading move only on active time: app running, user input within the last 300 s, Nap time off.
- Save state: one versioned JSON file in the OS app-data folder; meter values, not timestamps.
- No sounds in Phase 1.
- Never use em or en dashes in code, comments, docs or commit messages. Conventional commits.
- Every numeric value marked *(tunable)* in the spec lives in `src/brain/tuning.ts`, nowhere else.

## Review Focus

1. **The usable screen area changes while running** (Dock resized or moved, resolution changed): every cat re-floors onto the new bottom edge and none is left off screen. Test in Task 7.
2. **A corrupt, empty or newer-version save file**: the app starts with no cats (first run), keeps the bad file as `windowsill.json.bad`, and never crashes. Test in Task 6.
3. **A cat dropped or dragged off screen** (above the top, past an edge): it is clamped back inside the screen and lands on the floor. Test in Task 7.
4. **Resume after sleep produces a huge frame delta**: the fixed-step loop clamps the delta so cats do not teleport and mood does not jump. Test in Task 9.
5. **Awkward names** (only spaces, emoji, 21 graphemes, duplicates): spaces-only is rejected, emoji counts as one character each, the 21st grapheme is rejected, duplicate names are allowed. Test in Task 11.

---

## File Structure

```
pet/
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
      pixelArt.ts           code-generated pixel frames per animation
      palette.ts            coat palettes and palette swap
      renderer.ts           draws cats and effects (hearts, z, sparkle, cue ring)
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
    src/tray.rs             tray menu
  tests/                    Vitest, mirrors src/ (tests/brain/mood.test.ts ...)
```

---

### Task 1: Scaffold and a visible overlay

**Files:**
- Create: everything under the root listed above except `src/brain`, `src/sim`, `src/render`, `src/create` contents; `src-tauri/src/overlay.rs`, `screen.rs`, `lib.rs`, `main.rs`
- Test: `tests/smoke.test.ts`, `src-tauri/src/overlay.rs` (unit tests)

**Interfaces:**
- Produces: Rust command `get_floor() -> Floor { x: f64, y: f64, width: f64, bottom: f64 }` in logical pixels relative to the overlay window (bottom is the usable area's bottom edge). Event `floor-changed` with the same payload. Front end `ipc.getFloor(): Promise<Floor>` and `ipc.onFloorChanged(cb)`.

- [ ] **Step 1: Install prerequisites.** Rust stable via `rustup` (`curl https://sh.rustup.rs -sSf | sh`, then restart the shell); on macOS, Xcode Command Line Tools; on Windows, Visual Studio Build Tools and WebView2 (preinstalled on Windows 11). Verify: `cargo --version` prints a version.
- [ ] **Step 2: Scaffold** a Tauri 2 + Vite + vanilla TypeScript app (`npm create tauri-app@latest`, template `vanilla-ts`, identifier `com.darthdodo.windowsill`), then pin the npm versions listed in Tech Stack and add Vitest with `npm test` running `vitest run`.
- [ ] **Step 3: Write failing Rust test** `floor_uses_work_area_bottom`: given a monitor rect `(0,0,1440,900)` and work area `(0,25,1440,800)` (logical), `floor_from(monitor, work_area)` returns `Floor { x: 0, y: 25, width: 1440, bottom: 825 }`.
- [ ] **Step 4: Run** `cd src-tauri && cargo test floor_uses_work_area_bottom`. Expected: FAIL, `floor_from` not found.
- [ ] **Step 5: Implement** `screen.rs::floor_from(monitor: Rect, work: Rect) -> Floor` and `get_floor` using the primary monitor's `work_area()`; emit `floor-changed` when the monitor's work area differs on a 2 s poll.
- [ ] **Step 6: Overlay window** in `overlay.rs`: label `overlay`, sized to the primary monitor, `transparent(true)`, `decorations(false)`, `always_on_top(true)`, `skip_taskbar(true)`, `focusable(false)`, `shadow(false)`, visible on all workspaces; macOS `ActivationPolicy::Accessory`. Enable `macOSPrivateApi` for transparency. Body and canvas backgrounds are transparent.
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

### Task 9: Pixel art, renderer and the living loop

**Files:**
- Create: `src/render/pixelArt.ts`, `palette.ts`, `renderer.ts`, `src/sim/controller.ts`, `src/overlay/main.ts`
- Test: `tests/render/palette.test.ts`, `tests/render/pixelArt.test.ts`, `tests/sim/controller.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 8.
- Produces: `frames(species: Species, anim: AnimName): PixelFrame[]` (only `cat` frames exist in Phase 1) where `AnimName` covers every `BehaviourName`, the five tricks, `walk`, `dangle`, `fall`, `land`, `purr`, `belly-up`, `yawn`; `PixelFrame = string[]` rows using palette keys (`o` outline, `f` fur, `s` second coat colour, `w` light, `p` pink, `e` eye); `paletteFor(colour: Colour): Record<string, string>`; `class CatController { constructor(pet: Pet, body: Body, rng: Rng); update(dt: number, ctx: ControllerContext): void; anim(): { name: AnimName; frame: number }; start(action: { kind: 'trick'; trick: Trick } | { kind: 'purr' } | ...): void }`; `drawCat(ctx2d, cat, body, anim, scale)`.

- [ ] **Step 1: Write failing tests:**
  - `every animation has frames of equal size`: all frames of all `AnimName`s are 24 by 24.
  - `palettes cover every key for every coat`: `paletteFor(c)` defines `o f s w p e` for all 7 colours; tuxedo's `s` is white, calico's `s` is orange.
  - `controller plays a behaviour then picks the next`: with a seeded rng, a cat finishes `groom` and starts a new behaviour; there is always a transition animation between `nap` and `wander` (`stretch` after waking).
  - `huge resume delta is safe` (Review Focus 4): `update(7200)` on the loop path (through `clampFrameDelta`) moves a walking cat at most one clamped step.
  - `never in the way`: with the cursor still over a cat for more than 2 s, the controller starts a short `wander` aside.
- [ ] **Step 2: Run** `npm test -- palette pixelArt controller`. Expected: FAIL.
- [ ] **Step 3: Implement.** Art is code-generated 24 by 24 pixel frames (builder's call per spec), drawn at a whole-number scale (3x default) with `imageSmoothingEnabled = false`. `overlay/main.ts` runs `requestAnimationFrame`, clamps the delta, steps world and controllers, ticks mood with `activeSeconds`, pushes hit boxes to Rust when they move, and renders. Mood shows through behaviour choice plus **Content sit** and **Grumpy sit** only.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: one hard-coded test cat wanders, grooms, naps with a floating "z" and stretches awake.
- [ ] **Step 5: Commit** `feat: pixel cats that live on the floor`.

### Task 10: Petting, picking up and dropping

**Files:**
- Create: `src/overlay/input.ts`
- Modify: `src/overlay/main.ts`, `src/sim/controller.ts`
- Test: `tests/overlay/input.test.ts`

**Interfaces:**
- Consumes: `StrokeDetector`, `World.pickUp/dragTo/drop`, `CatController.start`.
- Produces: `class InputRouter { pointerMove(x, y, t): void; pointerDown(x, y, button: 0 | 2): void; pointerUp(x, y): void }` dispatching to **Purr**, **Belly up**, **Pick up**, **Drop**, and (Task 12) the cue ring.

- [ ] **Step 1: Write failing tests:** moving back and forth over a cat 3 times in 1.5 s starts `purr` and raises affection by `3 * affectionPerStroke`; continued stroking for 3 more strokes starts `belly-up` for a cat with affection at least 70; press and move on a cat calls `pickUp` then `dragTo` and plays `dangle`; release calls `drop`, plays `fall` then `land`, and leaves mood unchanged.
- [ ] **Step 2: Run** `npm test -- input`. Expected: FAIL.
- [ ] **Step 3: Implement** and draw rising hearts during purr.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: pet, pick up and drop on macOS.
- [ ] **Step 5: Commit** `feat: petting, purring and pick up and drop`.

### Task 11: Creating, editing and remembering pets

**Files:**
- Create: `src/brain/names.ts`, `create.html`, `src/create/main.ts`
- Modify: `src-tauri/src/lib.rs` (open the `create` window, `cats-changed` event), `src/overlay/main.ts`
- Test: `tests/brain/names.test.ts`, `tests/create/form.test.ts`

**Interfaces:**
- Produces: `validateName(raw: string): { ok: true; name: string } | { ok: false; reason: 'empty' | 'too-long' }`; Rust command `open_create_window(cat_id: Option<String>)`; event `cats-changed` carrying the full `SaveFile`.

- [ ] **Step 1: Write failing tests** (Review Focus 5): `'   '` is `empty`; `'  Mochi '` becomes `'Mochi'`; 20 emoji pass and 21 graphemes fail (`Intl.Segmenter`); two cats may share a name. Form: the seventh cat cannot be created (`maxCats` 6, the button is disabled with "6 cats is the limit"); personality is read-only when editing.
- [ ] **Step 2: Run** `npm test -- names form`. Expected: FAIL.
- [ ] **Step 3: Implement** **New pet** (species with only Cat enabled and Dog shown as "coming in Phase 2", name, style with only Pixel enabled and the others shown as "coming soon", colour, personality, live preview using the renderer), **Edit pet**, **Rehome pet** (confirm dialog). A new cat drops in from the top of the screen. With no saved cats, **New pet** opens on launch (**First run**). New cats start at affection 60, energy 80, `newPairings()`.
- [ ] **Step 4: Run** tests. Expected: PASS. Manual: create two cats, quit, relaunch, both return with their moods.
- [ ] **Step 5: Commit** `feat: create, edit, rehome and remember pets`.

### Task 12: The cue ring and tricks

**Files:**
- Create: `src/overlay/cueRing.ts`
- Modify: `src/overlay/input.ts`, `src/sim/controller.ts`, `src/render/renderer.ts`
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

### Task 13: Tray menu, Nap time, idle time and launch at login

**Files:**
- Create: `src-tauri/src/tray.rs`, `src-tauri/src/idle.rs`
- Modify: `src-tauri/src/lib.rs`, `src/overlay/main.ts`
- Test: unit test in `idle.rs`; `tests/overlay/napTime.test.ts`

**Interfaces:**
- Produces: Rust command `user_idle_seconds() -> u64` (via `user-idle`, 0 on error); events `nap-time` `{ on: bool }`, `call-over` `{ id }`; tray built from the current cats on `cats-changed`.

- [ ] **Step 1: Write failing tests:** `idle_never_panics` (returns a number on the CI host); `nap time hides and stops the clock`: with `napTime` on, cats play curl-up then fade out, `activeSeconds` returns 0, and toggling off fades them back with moods unchanged; `call over walks to the centre`.
- [ ] **Step 2: Run** `cargo test idle` and `npm test -- napTime`. Expected: FAIL.
- [ ] **Step 3: Implement** the tray: icon is a small cat head; items **New pet…**, one submenu per cat (**Edit…**, **Call over**, **Rehome…**), **Nap time** (check item, persisted in settings), **Launch at login** (check item via `tauri-plugin-autostart`, off by default), **Quit Windowsill** (saves first). The Gemma status entry is Phase 2 and is not added. The overlay polls `user_idle_seconds` every 5 s and feeds `activeSeconds` and **Cuddle nap**.
- [ ] **Step 4: Run** tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: tray menu, nap time, idle-aware clock and launch at login`.

### Task 14: Windows build and release checks

**Files:**
- Create: `README.md`, `docs/release-checklist.md`, `.github/workflows/ci.yml`
- Modify: `src-tauri/tauri.conf.json` (bundle targets `dmg`, `nsis`)

- [ ] **Step 1: CI** runs `npm ci`, `npm test`, `npx tsc --noEmit`, `cargo test`, `cargo clippy -- -D warnings` on `macos-latest` and `windows-latest`.
- [ ] **Step 2: Windows run** on a Windows 10 or 11 machine: transparency, click-through, taskbar floor (bottom, left, right and top taskbar positions), no taskbar button, no Alt-Tab entry, tray menu.
- [ ] **Step 3: Release checklist** in `docs/release-checklist.md`, covering both OSes: zero clicks lost outside a cat (10 clicks across Finder or Explorer and a browser), three cats for 10 minutes average under 2 % CPU and 150 MB memory (Activity Monitor, Task Manager), state survives quit and reboot, a friend gets the pet-and-trick moment within 10 seconds.
- [ ] **Step 4: Build** `npm run tauri build` on both OSes; unsigned builds are fine for Phase 1. README covers install (including the macOS "unidentified developer" right-click Open) and the tray.
- [ ] **Step 5: Commit** `chore: CI, Windows bundle and release checklist`.
