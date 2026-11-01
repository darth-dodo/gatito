# Windowsill

[![CI](https://github.com/darth-dodo/windowsill/actions/workflows/ci.yml/badge.svg)](https://github.com/darth-dodo/windowsill/actions/workflows/ci.yml)

> Little cats and dogs that live on your Mac's desktop. Pet them, teach them tricks, and let them nap on your windows while you work.

[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](#status)
[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude-cc785c?logo=anthropic&logoColor=white)](https://claude.ai)

![Windowsill: pixel cats and a dog on a Mac desktop, one cat perched on a code window, one napping above the Dock, one being petted, and a golden dog wagging](docs/assets/windowsill-hero.svg)

![Recorded demo: three pixel cats (orange tabby, black and grey) and three dogs (golden, white and brown retrievers) side by side on the floor above a pretend Dock, sitting, walking past each other and napping, the cats curled up and the dogs lying with their chin on their paws, while the cursor drifts past them](docs/assets/demo.gif)

Full-quality video: [docs/assets/demo.mp4](docs/assets/demo.mp4). Run the demo locally: `npm run dev` then open `/demo.html`.

---

## A pet on your screen

Desktop pets used to be a small joy: a creature that shared your screen and made a long day feel less lonely. Windowsill brings that back with cats and dogs that feel alive.

Each **pet** has a name, a look, a personality and a mood. It naps above your Dock, wanders, grooms a paw (or scratches an ear) and gets into mild trouble when you forget about it. You stroke it with the cursor and a cat purrs while a dog wags. You teach it tricks, and it actually learns them, one reward at a time.

**A desktop pet should make work feel warmer without ever getting in the way of it.** Clicks pass straight through to your apps everywhere except on a pet.

## What it feels like

### 🐾 Make a pet
Choose **New pet…** from the menu bar and pick a **species** (cat or dog), a **name**, a **style** (pixel for now; soft and cute, ink doodle and silhouette later), a **coat** and a **personality**: Cosy, Curious, Mischievous or Social. A live preview shows your pet as you choose. It drops in from the top of the screen and lands on its feet. Up to 6 pets, cats and dogs together.

| Species | Coats you can pick today | Coming later |
|---------|--------------------------|--------------|
| Cat | orange tabby, black, white, grey | tuxedo, calico, Siamese |
| Dog | golden, black, white, brown | spotted, tricolour, husky grey |

### 💤 It lives alongside you
Mostly calm: napping, loafing, stretching awake, wandering a little. Curious pets explore, cosy ones curl up near your cursor when you step away. **Nap time** in the menu bar sends everyone to sleep until you wake them.

### 💕 Pet it
Stroke a pet back and forth with the cursor, no click needed, or tap it a few times. A cat purrs; a dog wags its whole back end. Little hearts rise, and a happy pet rolls onto its back. Pick one up by the scruff and drop it; it always lands on its feet.

### 🐕 Cats and dogs
A dog is the same pet with a different body: it learns, sulks and naps on the same rules as a cat. Where it differs, it differs the dog way:

| Cat | Dog |
|-----|-----|
| Purrs, eyes closed | **Wags**, tail high and back end wiggling |
| Loafs, paws tucked in | **Curl nap**, nose tucked into a tight ring |
| Grooms a paw | **Scratches** behind an ear with a hind leg |
| Flicks its tail in a sit, faster when cross | **Thumps** its tail on the floor, more often when happy |
| Ears fold back when cross | Floppy ears swing back when cross |

### 🎵 Teach it tricks
Right-click a pet for the cue ring: whistle, clap, toy wand or treat bag. The pet guesses a trick (spin, sit up, roll over, high five, chase tail). Pet it if it got it right. After a few rounds the whistle really means spin, and every pet learns its own pairings. Forget to practise and the trick slowly fades.

### 😼 Mood matters
Ignore your pets while you work and they get naughty: zoomies, staring at your cursor, cheeky wrong tricks. A few strokes bring them back. Only time you're actually at the computer counts, so they don't wake up grumpy every morning.

### ✨ Optional Gemma
If you run [Ollama](https://ollama.com) with a Gemma model, pets will get in-character thought bubbles ("sun spot. mine."), and later you'll be able to talk to them, get name ideas and read their daily diary. Without it, everything else works the same.

## Privacy

No accounts, no telemetry, no analytics. Nothing leaves your computer except, if you turn Gemma on, calls to Ollama on your own machine. Pets never look at your screen, your windows' contents or your typing.

## Install

Windowsill is macOS 13 or newer.

1. Download the `.dmg` from [GitHub Releases](https://github.com/darth-dodo/windowsill/releases) once a release is published (releases start as drafts), or build it yourself with `npm ci && npm run tauri build` (Rust and Node needed; the `.dmg` lands in `src-tauri/target/release/bundle/dmg/`).
2. Open the `.dmg` and drag Windowsill to Applications.
3. The app is **unsigned**, so the first launch needs a right-click on Windowsill, then **Open**, then **Open** again in the warning. After that it opens normally.

There is no Dock icon; Windowsill lives in the menu bar.

## Using it

- **Menu bar icon**: New pet, per-pet Edit, Call over and Rehome, **Nap time** (pets rest and moods stop changing, handy in meetings) and Launch at login.
- **Petting**: move the cursor back and forth over a pet, no click needed. A cat purrs, a dog wags, and hearts rise. Tapping also pets it.
- **Drag**: pick a pet up by the scruff and drop it anywhere; it lands on its feet.
- **Tricks**: right-click a pet for the cue ring, pick a cue, then pet it if it guessed right. A few rounds in, the cue means the trick.
- Clicks pass straight through to your apps everywhere except on a pet.

## Run from source

You need macOS, Node.js with npm, and Rust (the toolchain is pinned in `rust-toolchain.toml`).

```sh
npm install
npm run tauri dev     # the real app: pets on your desktop, New pet in the menu bar
npm run dev           # or just the browser demo, at /demo.html
npm run check         # every CI gate: typecheck, tests with coverage, cargo fmt, clippy and tests
```

Your pets are saved to one JSON file in the app's data folder, so they come back after a restart.

## Art

The pets are GenAI pixel art on a 96 by 96 grid. Each species has one full-body **reference** image; its cut-out parts (ears, eyes, tail, legs) are cut from that reference so they fit together seamlessly, and code animates them. A few whole-body key poses (sit, naps, belly up, stretch, groom, sit up, dangle) and a six-frame walk cycle cover shapes that parts cannot make.

| Step | Command |
|------|---------|
| Generate images (needs `OPENROUTER_API_KEY`) | `npm run art:generate -- --species dog --coat golden` |
| Cut the parts out of the reference | `npm run art:cut -- --species dog --coat golden` |
| Build the sprite sheets | `npm run art` |

One coat per species is generated in full (orange tabby, golden) and the plain coats are recoloured from it. The dog's reference was drawn with `--style` pointing at the cat's, so the two share a scale, outline and baseline. To add your own art, drop it into `art/source/<species>/<coat>/` (12 parts and 8 key poses, exact file names matter) and run `npm run art`. The [adding-pet-art skill](.claude/skills/adding-pet-art/SKILL.md) has the file list, sizes and troubleshooting. Before a release, work through the [macOS release checklist](docs/release-checklist.md).

## Status

**Phase 1 is complete, and dogs are in from Phase 2.** Pixel cats and dogs, click-through, petting, tricks, mood, saved pets, the menu bar menu and the macOS build are in. The rest of Phase 2 is next.

| Phase | Scope | Status |
|-------|-------|--------|
| **1 (MVP)** | Pixel pets on the floor of the screen, click-through, create and remember pets, mood, petting, pick up and drop, cue ring tricks, menu bar menu, macOS build | ✅ Done |
| **2** | Dogs, pets walk on top of your windows, cursor play, pets playing together, hide during fullscreen apps, Gemma thought bubbles | 🐕 Dogs done, the rest planned |
| **3** | Soft, ink and silhouette styles, talk to them, name help, daily diary, cursor-wave cues, multiple monitors | ⏳ Planned |

## Tech

[Tauri 2](https://v2.tauri.app) with Rust for the Mac parts (transparent always-on-top overlay, click-through, screen area, idle time, menu bar, save file) and TypeScript with [PixiJS 8](https://pixijs.com) for the pets. The pet brain (mood, behaviour, trick learning) is plain, unit-tested TypeScript.

The art is GenAI pixel art drawn as cut-out parts plus a few key poses (see [Art](#art)). Code animates the parts, and an art pipeline (`npm run art`) turns generated images into crisp, consistent sprite sheets.

## Releasing

Push a `vX.Y.Z` tag. The release workflow builds a universal `.dmg` (Apple Silicon and Intel) into a draft GitHub Release, so nothing is published until you review it. Builds are unsigned until the Apple signing secrets are added.

## Docs

- [Product specification](docs/product.md): what Windowsill does, precisely
- [macOS release checklist](docs/release-checklist.md): the manual checks before a release
- [Phase 1 implementation plan](docs/superpowers/plans/2026-10-31-windowsill-phase-1.md): the build, task by task
- [Changelog](CHANGELOG.md): what changed, pull request by pull request
