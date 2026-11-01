# Windowsill Product Specification

> Little cats, and soon dogs, that live on your real desktop. Pet them, teach them tricks, and let them nap on your windows while you work.

---

## Table of Contents

- [Vision](#vision)
- [Who It's For](#who-its-for)
- [What We're Building](#what-were-building)
- [A Day With Windowsill](#a-day-with-windowsill)
- [Creating a Pet](#creating-a-pet)
- [Living on the Desktop](#living-on-the-desktop)
- [Mood and Personality](#mood-and-personality)
- [Behaviours](#behaviours)
- [Petting and Handling](#petting-and-handling)
- [Tricks](#tricks)
- [Gemma (Optional)](#gemma-optional)
- [The Menu Bar Menu](#the-menu-bar-menu)
- [Privacy and Data](#privacy-and-data)
- [Decision Log (Locked)](#decision-log-locked)
- [UX Principles](#ux-principles)
- [Art](#art)
- [Technical Architecture](#technical-architecture)
- [Roadmap](#roadmap)
- [Success Metrics](#success-metrics)
- [What We're NOT Building](#what-were-not-building)
- [Builder's Calls](#builders-calls)

Behaviours carry **bold names**. Tests, tasks and design docs reference those names; implementers never invent behaviour that isn't written here. Numbers marked *(tunable)* are starting values to adjust by feel, not contracts.

---

## Vision

Desktop pets used to be a joy: a small creature that shared your screen and made a long day feel less lonely. Windowsill brings that back with cats, and soon dogs, that feel alive. Each pet has a name, a look, a personality and a mood. It naps, wanders, plays with the other cats and gets into mild trouble when ignored. You pet it, it purrs. You teach it tricks, and it actually learns them, one reward at a time.

**The problem, in three sentences.** Computer work is long and solitary, and most "fun" desktop apps are notifications in disguise. Existing desktop pets are either scripted toys that never change or abandoned projects that no longer run on modern macOS and Windows. Nothing gives you a pet that grows into *yours* through how you treat it.

**Core belief**: a desktop pet should make work feel warmer without ever getting in the way of it.

---

## Who It's For

**The owner (primary).** A developer who spends long days at a Mac and wants a bit of life on screen. Delighted by small details: a tail flick, a cat that remembers its tricks. Frustration: anything that steals focus, eats CPU or needs an account.

**Friends the owner shows it to.** The test audience for the magic moment: "I can pet it and it does a trick I taught it." They should get it within ten seconds of watching.

---

## What We're Building

| Feature | Phase | Description |
|---------|-------|-------------|
| **Desktop overlay** | 1 (MVP) | Cats drawn over the desktop on the primary display; clicks pass through everywhere except on a cat |
| **Create a pet** | 1 | Choose species, name, style, colour and personality; up to 6 pets |
| **Floor life** | 1 | Cats walk, sit, groom, stretch, nap and play along the bottom of the screen |
| **Mood** | 1 | Affection and energy shape what each cat does |
| **Petting** | 1 | Stroke a cat with the cursor and it purrs |
| **Pick up and drop** | 1 | Drag a cat; it dangles, falls and lands on its feet |
| **Tricks with the cue menu** | 1 | Right-click cue ring; cats learn cue to trick pairings from rewards |
| **Pixel style** | 1 | The first art style, with colour variants |
| **Memory** | 1 | Every pet and what it learned survives restarts |
| **Dogs** | 2 | A second species: same mood, petting, tricks and personalities as cats, with dog art and dog reactions |
| **Window perching** | 2 | Cats climb onto and walk along the top edges of your open windows |
| **Cursor play** | 2 | Cats watch the cursor and pounce on fast movement |
| **Social play** | 2 | Cats chase, play-fight, groom each other and pile up to nap |
| **Gemma thought bubbles** | 2 | Short, in-character thoughts written by a local Gemma model |
| **More styles** | 3 | Soft and cute, Ink doodle, Silhouette |
| **Talk to them** | 3 | Type "Mochi, spin!" and Gemma turns it into a cue |
| **Name and backstory help** | 3 | Gemma suggests names and a one-line backstory at creation |
| **Daily diary** | 3 | Each cat writes a two-line diary entry about its day |
| **Cursor-wave cues** | 3 | Trace a circle or zigzag near a cat to cue a trick without clicking |
| **Multi-monitor** | 3 | Cats can live on every display and walk between them |

---

## A Day With Windowsill

1. **Morning.** You start your computer. Windowsill launches at login (opt-in) and your cats appear along the bottom of the screen, stretching awake.
2. **Deep work.** Mochi (cosy) naps by the dock. Pixel (curious) wanders over, sits, grooms a paw, wanders back. Nothing asks for your attention; your clicks go straight through to your apps.
3. **A break.** You stroke Mochi with the cursor. She purrs, little hearts rise, and she rolls onto her back.
4. **Training.** You right-click Pixel and choose the whistle. Pixel guesses: a spin. That's what you wanted, so you pet him straight away. After a few rounds the whistle means spin.
5. **Busy afternoon.** You forget the cats for two hours. Pixel's affection drops and he gets the zoomies, then sits near your cursor and stares. A quick stroke and he's sweet again.
6. **Presenting.** You choose **Nap time** from the menu bar and all cats curl up and fade out until you bring them back.
7. **Tomorrow.** Everything is remembered: names, moods, every learned trick.

---

## Creating a Pet

**New pet** opens a small window from the menu bar with a live preview of the pet as you choose:

| Choice | Options |
|--------|---------|
| **Species** | Cat (Phase 1). Dog (Phase 2) |
| **Name** | Free text, up to 20 characters; required |
| **Style** | Pixel (Phase 1). Soft and cute, Ink doodle, Silhouette (Phase 3) |
| **Colour** | Cats: orange tabby, black, white, grey, tuxedo, calico, Siamese. Dogs: golden, black, white, brown, spotted, tricolour, husky grey |
| **Personality** | Cosy, Curious, Mischievous, Social |

The new pet drops in from the top of the screen and lands on the floor. **Edit pet** changes name, colour or style later; species and personality are fixed at birth. **Rehome pet** removes one after a confirmation.

**Pet limit.** At most 6 pets at once, cats and dogs together.

**First run.** With no pets saved, Windowsill opens **New pet** automatically.

---

## Dogs

Dogs arrive in Phase 2. A dog is the same pet with a different body: species is chosen at creation and everything else is shared (name, style, personality, mood and its clock, petting, pick up and drop, the cue ring, the five tricks, memory, Gemma). Phase 1 builds the engine species-aware so dogs are an art and reaction task, not an engine change.

Where a dog differs, it differs only in how it looks and reacts:

| Cat | Dog |
|-----|-----|
| **Purr** with rising hearts | **Wag**: the whole back end wiggles, hearts rise |
| **Loaf** | **Curl nap**: nose tucked under tail |
| **Groom** a paw | **Scratch** behind an ear |
| Tail flick in **Idle sit** | Tail thump in **Idle sit** |
| **Belly up** | **Belly up** (same) |

Dogs make no sounds, like cats in Phase 1.

---

## Living on the Desktop

**Overlay.** A transparent, borderless, always-on-top layer covers the primary display. It never takes keyboard focus and never appears in the Dock or the Cmd-Tab switcher, and it shows on every Space.

**Click-through.** Clicks pass through to the app underneath everywhere except on a cat. Hovering a cat makes it interactive; moving off makes everything pass through again with no visible delay.

**The floor.** Cats live on the bottom edge of the usable screen area: just above the Dock, whatever its size, and above it on the left or right when the Dock sits on a side. When the Dock auto-hides, the floor is the screen's bottom edge.

**Never in the way.** A cat never stays under a still cursor for more than 2 seconds *(tunable)*; it shifts aside. Cats never move, resize or focus your real windows.

**Fullscreen respect.** When a fullscreen app or presentation is in front, cats hide automatically and return when it ends (Phase 2; **Nap time** covers this in Phase 1).

---

## Mood and Personality

**Personality is who a cat is; mood is how it feels right now.**

Each cat has two mood meters, 0 to 100:

| Meter | Rises with | Falls with |
|-------|-----------|-----------|
| **Affection** | Petting, rewarded tricks | Active time without attention (about 10 per active hour *(tunable)*) |
| **Energy** | Napping | Walking, playing, tricks |

**Mood clock.** Mood and trick fading only move on **active time**: Windowsill running, the user active (input within the last 5 minutes *(tunable)*, using the OS idle time), and **Nap time** off. Time while the app is closed, the machine is asleep or locked, the user is away, or the cats are napping by request does not count. So neglect means *forgetting the cats while you work*, cats do not wake up grumpy every morning, and a holiday does not wipe their tricks. The save file therefore stores meter values, not timestamps. *(Claude's call.)*

**Showing mood.** Mood shows mainly through *which* behaviours a cat picks and how often (a happy cat purrs, loafs and seeks you out; a grumpy one stares and gets zoomies), and through the cut-out parts: ear angle and tail speed follow mood continuously, so **Content sit** (soft ears, slow tail) and **Grumpy sit** (flattened ears, flicking tail) are the same sit pose with different part settings, not separate drawings. There are no visible bars or numbers in Phase 1. *(Claude's call, to keep the art budget small.)*

**Personality weights.** Each personality shifts how likely each behaviour is:

| Personality | Leans toward |
|-------------|--------------|
| **Cosy** | Naps, stretching, sleeping near the cursor when you're idle |
| **Curious** | Wandering, exploring, watching the cursor; perching on windows in Phase 2 |
| **Mischievous** | Zoomies, staring at the cursor, cheeky wrong tricks |
| **Social** | Seeking other cats, grooming them, napping in piles (Phase 2) |

**Neglect turns naughty.** Low affection raises mischief for every personality, scaled by personality (Mischievous most, Cosy least). Petting restores it.

**Tired cats sleep.** Low energy makes napping likely and makes the cat ignore cues.

---

## Behaviours

Phase 1 behaviours, chosen by a weighted pick from personality and mood every few seconds:

| Behaviour | What it looks like |
|-----------|--------------------|
| **Idle sit** | Sitting, tail flicking, blinking |
| **Wander** | Walking left or right a short way, turning at screen edges |
| **Groom** | Licking a paw, washing its face |
| **Stretch** | Front-paw stretch, usually after waking |
| **Nap** | Curled up, slow breathing, a floating "z" |
| **Loaf** | Paws tucked in, eyes half closed |
| **Zoomies** | A sudden fast run across the floor and back |
| **Stare** | Walks toward the cursor, sits and stares |
| **Cuddle nap** | When you're idle 3 minutes *(tunable)*, a high-affection cat naps near the cursor |

Every behaviour has a short transition so a cat never snaps between poses.

---

## Petting and Handling

**Petting.** Moving the cursor back and forth across a cat, no click needed, counts as strokes. Three strokes within 2 seconds *(tunable)* start **Purr**: the cat leans in, eyes close, small hearts rise, and affection goes up. Keep stroking for **Belly up**, where a happy cat rolls onto its back.

**Tap to pet.** A click on a cat that does not lift it (it moved less than 4 px *(tunable)*) is a tap: it counts as one stroke and a few small hearts pop up. Three taps within 2 seconds *(tunable)* start **Purr**; taps and strokes add up toward the same purr.

**Pick up.** Press and hold on a cat to pick it up by the scruff; it dangles with its legs swaying. **Drop**: release and it falls under gravity, rights itself mid-air and lands on its feet. Dropping does not lower mood.

**Cue menu.** Right-click a cat to open the cue ring (see [Tricks](#tricks)).

---

## Tricks

**The cue ring.** Right-click a cat to open a small ring of four cues around it:

| Cue | Icon |
|-----|------|
| **Whistle** | 🎵 |
| **Clap** | 👏 |
| **Toy wand** | 🪶 |
| **Treat bag** | 🐟 |

**The trick list (Phase 1).** **Spin**, **Sit up**, **Roll over**, **High five**, **Chase tail**.

**Learning, precisely.** Each cat keeps a strength for every cue and trick pairing, starting equal.

1. **Cue.** You pick a cue. The cat performs a trick chosen at random, weighted by the strengths for that cue.
2. **Reward window.** For 3 seconds *(tunable)* after the trick ends, petting counts as a reward.
3. **Rewarded.** That pairing's strength rises noticeably; the cat purrs.
4. **Not rewarded.** That pairing's strength drops slightly.
5. **Learned.** Once one trick reaches 80 % of a cue's weight, the cat has **learned** it. A small sparkle marks the moment the first time.
6. **Fading.** Pairings not practised drift slowly back toward even over about 40 active hours *(tunable)*, roughly two working weeks.

**Willingness.** Mood decides whether the cat tries at all: low energy means it ignores the cue or yawns, and low affection means it may walk away. **Cheeky** (Mischievous only): even after learning, about 1 time in 7 it deliberately does a different trick.

**Target**: about 5 to 8 rewarded rounds to teach a trick to a willing cat.

---

## Gemma (Optional)

Windowsill works fully without any AI. If [Ollama](https://ollama.com) is running locally with a Gemma model pulled, Gemma features switch on; if not, they quietly stay off.

| Feature | Phase | Behaviour without Gemma |
|---------|-------|-------------------------|
| **Thought bubbles** | 2 | Built-in lines per personality and mood |
| **Talk to them** | 3 | Not available; use the cue ring |
| **Name and backstory help** | 3 | A built-in name list |
| **Daily diary** | 3 | Not available |

**Thought bubbles.** At most one bubble per cat every 10 minutes *(tunable)*, never during a fullscreen app. A thought is under 8 words, lowercase, in character for the cat's name, personality, mood and what it is doing. Each request sends only those facts. No screen content, window titles or typing ever go to the model.

**Setup.** The menu bar menu shows Gemma's status (on, off, not found) and which model is in use. The default model is the smallest Gemma available in Ollama; you can change it in settings.

---

## The Menu Bar Menu

A menu-bar icon: a small cat head.

- **New pet…**
- One entry per cat: **Edit…**, **Call over** (walks to the middle of the screen), **Rehome…**
- **Nap time** (toggle): all cats curl up and fade out; toggle again to wake them
- **Gemma**: status and model
- **Launch at login** (toggle, off by default)
- **Quit Windowsill**

---

## Privacy and Data

- **No accounts, no telemetry, no analytics.** Windowsill never phones home.
- **The only network traffic is to the local Ollama server**, and only if Gemma is on.
- **Saved state** is one JSON file in the OS app-data folder: cats, moods, learned pairings and settings. Deleting it resets Windowsill.
- **Window positions** (Phase 2, for perching) are read as rectangles only, never titles or contents.

---

## Decision Log (Locked)

| Decision | Value | Why |
|----------|-------|-----|
| Name | Windowsill (renamed from Gatito, 2026-10-31) | Owner's choice: pets that sit on your windows; covers cats and dogs |
| Form | Cats live on the real desktop, not in an app window | The whole point: company while you work |
| Platforms | macOS only (Windows dropped 2026-10-31) | Owner's choice; one platform done well |
| Creation choices | Species, name, style, colour, personality | Owner's choice; each pet is individual |
| Species | Cats in Phase 1; dogs in Phase 2, sharing every system except art and a few reactions | Owner's choice (2026-10-31): "nothing" should feel different about a dog beyond its body |
| Personalities | Cosy, Curious, Mischievous, Social | The four behaviour sets the owner liked |
| Styles | Pixel, Soft and cute, Ink doodle, Silhouette; chosen per cat | Owner wants all four; pixel first because it is cheapest to animate well |
| Trick cue (MVP) | Right-click cue ring | Owner's pick for the MVP; cursor-wave cues later |
| Tricks are learned | Reward-based learning per cat, not unlocked from a menu | "Teach tricks" is the magic moment |
| Mood | Affection and energy, shaped by personality; neglect raises mischief | Personality is who it is, mood is how it feels |
| Gemma | Optional, local via Ollama; all four Gemma features eventually | Owner's choice; private and free to run |
| Mischief limit | Visual and playful only; never moves, focuses or blocks real windows | Annoying would be a failure even if clever |
| Mood clock | Only active time counts: app running, user active, Nap time off | Neglect means forgetting them while you work, not being away (Claude's call) |
| Mood display | Through behaviour choice plus two mood poses, not mood variants of every animation | Keeps the art budget small (Claude's call) |
| Stack | Tauri 2 (Rust) with TypeScript and **PixiJS 8** for rendering and animation | Owner's choice of Tauri plus an animation library (2026-10-31); PixiJS is Claude's pick: sprites, meshes and particles without a game framework |
| Art | Owner-made GenAI pixel art as cut-out parts and key poses, animated in code | Image models cannot keep animation frames consistent; code-driven parts can (owner's choice of GenAI, Claude's call on cut-out) |

---

## UX Principles

1. **Never in the way**: clicks pass through except on a cat; cats never steal focus.
2. **Alive, not busy**: most of the time cats are calm; activity comes in short bursts.
3. **Everything eases**: no pose snaps; every change has a transition.
4. **Learning is real**: no fake progress bars; a trick is learned when the cat actually does it.
5. **Quiet by default**: no sounds in Phase 1. Purring sound is a later opt-in.
6. **Works offline, works without AI**: Gemma adds charm, never a requirement.

---

## Art

The owner makes the art with GenAI image tools, in **pixel art**. Pets are **cut-out puppets**: separate parts that the code moves (tail swish, blinks, ears, walking legs, breathing), plus a few whole-body **key poses** for shapes parts cannot make. Image models are good at single images and bad at consistent animation frames, so all motion comes from code.

**Grid and view.** Every image is pixel art on a **96 by 96 grid**, side view, **facing right** (the code mirrors it to face left), shown at 1x on screen *(tunable)*. Models rarely output true transparency, so images are generated on a flat **magenta `#FF00FF`** background that the art pipeline removes.

**Parts (the standing puppet), per species and coat:**

| Part | Notes |
|------|-------|
| `body` | Torso only: no head, legs or tail |
| `head` | Facing right, without ears or eyes |
| `ear-near`, `ear-far` | Rotate with mood |
| `eyes-open`, `eyes-closed` | Swapped for blinks and sleep |
| `tail` | Rotates and sways from its base |
| `leg-front-near`, `leg-front-far`, `leg-back-near`, `leg-back-far` | Swing for walking and zoomies |
| `paw-raised` | For **High five** |

**Key poses (whole body, without the tail, which is layered on):**

| Pose | Used for |
|------|----------|
| `sit` | **Idle sit**, **Content sit**, **Grumpy sit**, **Stare**, waiting for a cue; drawn without ears and eyes, which are layered on as parts |
| `loaf` | **Loaf** |
| `sleep-curl` | **Nap**, **Cuddle nap**; rotated for **Chase tail** |
| `belly-up` | **Belly up**, the middle of **Roll over** |
| `stretch` | **Stretch** |
| `groom` | **Groom** |
| `sit-up` | **Sit up** |
| `dangle` | **Pick up** |

**Spin** and **Roll over** are made in code by flipping and rotating the puppet and poses.

**Coats.** The owner generates the full set once in **orange tabby**. The pipeline recolours it to **black**, **white** and **grey** by palette mapping. **Tuxedo**, **calico** and **Siamese** have patterns, so each is generated as its own full set. A coat only appears in **New pet** once its set exists.

**Consistency tip.** Generate one full-body reference cat first, then pass it as the reference image for every part and pose, with the same prompt stem: *"pixel art, 96x96 grid, side view facing right, orange tabby cat, <part>, flat magenta #FF00FF background, no shadow, no text"*.

**Cut from one reference.** Generated parts each bring their own outline and drift from each other, so the standing puppet's parts are cut out of the single `reference.png` instead: `npm run art:cut` uses the generated parts (kept in `generated/`) and the hand-drawn cut polygons in `cut.json` as masks and fills them with the reference's pixels. The body keeps the head and haunches; the lower legs, tail, ears and eyes are separate. At rest the puppet is pixel-identical to the reference.

**Art pipeline.** `npm run art` reads `art/source/<species>/<coat>/<name>.png`, removes the magenta, snaps to the 96 by 96 grid with nearest-neighbour scaling, limits each image to 16 colours, trims, and packs a PixiJS sprite sheet per species and coat into `src/assets/atlas/`. Part pivots (for example, the tail's base) come from `art/rig/<species>.json`. It fails with a list of anything missing or the wrong size.

**Placeholders.** Until the owner's art exists, the pipeline produces simple code-drawn placeholder parts with the same names, so everything can be built and tested; dropping real images in needs no code change.

---

## Technical Architecture

- **Shell**: Tauri 2. One transparent, undecorated, always-on-top, non-focusable window sized to the primary display's full bounds; hidden from Dock, taskbar and Alt-Tab.
- **Click-through**: the window ignores cursor events by default. Rust polls the global cursor position about 60 times a second and compares it against cat hit boxes reported by the front end; when the cursor is over a cat, cursor events are enabled, and they're disabled again when it leaves. Tauri's click-through is all or nothing per window, which is why this polling is needed.
- **Floor**: the usable screen area (excluding the Dock and menu bar) comes from the OS through Rust and is sent to the front end on launch and whenever it changes.
- **Front end**: TypeScript with a PixiJS 8 stage (one container per pet: puppet parts, poses and particles for hearts, "z" and sparkles) and a fixed-step simulation loop. Pure modules for the cat brain (mood, behaviour choice, learning) with no DOM access, so they are unit-testable.
- **Art**: one PixiJS sprite sheet per species and coat, built by the art pipeline (see [Art](#art)). Pixel art scales by whole numbers with nearest-neighbour filtering so it stays crisp.
- **Windows for forms**: **New pet** and settings are ordinary small Tauri windows.
- **Persistence**: one versioned JSON file in the app-data folder, written on change (debounced) and on quit.
- **Gemma**: HTTP calls from Rust to `http://localhost:11434`, with short timeouts; any failure falls back silently.
- **Window perching (Phase 2)**: Rust reads visible top-level window rectangles (`CGWindowListCopyWindowInfo`) a few times a second.
- **Resource budget**: see [Success Metrics](#success-metrics).

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1 (MVP)** | Overlay, click-through, create cats, floor behaviours, mood, petting, pick up and drop, cue ring tricks, pixel style, memory, menu-bar menu, macOS build; species-aware engine | ⏳ Planned |
| **Phase 2** | Dogs, window perching, cursor play, social play, fullscreen respect, Gemma thought bubbles | ⏳ Planned |
| **Phase 3** | Three more styles, talk to them, name and backstory help, daily diary, cursor-wave cues, multi-monitor | ⏳ Planned |

Phase 1 ships in vertical slices, each ending with something you can see on the desktop: one cat walks on the floor; you can click through around it; petting; pick up and drop; create and save cats; mood; tricks; menu-bar menu; macOS release build.

### Future Ideas

- Voice cues ("Mochi, spin!" out loud)
- Opt-in purring and meow sounds
- Seasonal accessories (a scarf in winter)
- Sharing a cat's learned tricks as a file
- Rive for the smooth styles (Soft and cute, Silhouette): vector pets with mood-blended state machines

---

## Success Metrics

- **Ten-second delight**: a friend watching gets the pet-and-trick moment within 10 seconds.
- **Invisible when working**: zero clicks lost to the overlay outside a cat, verified by a manual checklist on macOS.
- **Light**: under 2 % average CPU and under 150 MB memory with 3 cats, without Gemma.
- **Teachable**: a willing cat learns a trick in 5 to 8 rewarded rounds.
- **Remembers**: names, moods and learned tricks survive a restart and an OS reboot.

---

## What We're NOT Building

- **Accounts, cloud sync, social features**: it's a personal pet.
- **Screen reading of any kind**: cats never look at what you're doing.
- **Real-window mischief**: no moving, closing or focusing your apps, ever.
- **Monetisation, ads, a shop**: no.
- **Notifications or nagging**: a neglected cat gets naughty on screen; it never sends a notification.
- **Windows, Linux or mobile**: macOS only.

---

## Builder's Calls

Left to whoever builds it, within this spec:

- The look of placeholder art, part pivots and the exact motion curves of code-driven animation.
- Animation timings, transition details and exact behaviour weights.
- Code-signing and notarisation for distribution (unsigned local builds are fine for Phase 1).
- Test tooling, within the rule that the cat brain is unit-tested.
