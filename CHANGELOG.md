# Changelog

All notable changes to Windowsill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tauri 2 app with a transparent, always-on-top overlay window that sits on the usable screen area above the Dock, on every Space, with no Dock icon ([#3](https://github.com/darth-dodo/windowsill/pull/3)).
- CI with a single CI Success gate (typecheck, tests with an 85 % coverage floor on the pet brain, Rust fmt, clippy and tests, app bundle build), a tag-triggered release workflow that builds a universal `.dmg` into a draft GitHub Release, and Dependabot ([#3](https://github.com/darth-dodo/windowsill/pull/3)).
- Pet brain foundations: pet types, every tunable number in `tuning.ts`, a seeded random generator, and mood meters (affection and energy) that move only on active time ([#4](https://github.com/darth-dodo/windowsill/pull/4)).
- Behaviour choice: each pet picks what to do from its personality and mood; ignored pets lean mischievous, tired ones nap, and loved ones cuddle up near the cursor when you step away ([#5](https://github.com/darth-dodo/windowsill/pull/5)).
- Trick learning: cues make a pet guess a trick, petting rewards it, and a willing cat learns a trick in 5 to 8 rewarded rounds; learned tricks are kept until practice lapses for about a working week, and tired, unloved or mischievous pets may yawn, walk off or do the wrong trick on purpose ([#6](https://github.com/darth-dodo/windowsill/pull/6)).
- Petting detection and the active-time clock: strokes count per sweep so mouse jitter never purrs a pet, and mood only changes while you are at the computer and Nap time is off ([#7](https://github.com/darth-dodo/windowsill/pull/7)).
- Versioned save file with validation, atomic writes and quarantine of a bad file as `windowsill.json.bad` ([#8](https://github.com/darth-dodo/windowsill/pull/8)).
- World physics: gravity, dragging and dropping, walkers turning at screen edges, re-flooring when the Dock moves, and clamping pets dropped off screen ([#9](https://github.com/darth-dodo/windowsill/pull/9)).
- Click-through: clicks pass to your apps everywhere except on a pet, measured from the overlay's real position so pets sit correctly even when macOS nudges the window below the menu bar, and correct on Retina ([#11](https://github.com/darth-dodo/windowsill/pull/11)).
- Art pipeline: `npm run art` turns GenAI pixel art (12 cut-out parts and 8 key poses on a magenta background) into PixiJS sprite sheets, recolours orange tabby into black, white and grey, and ships readable placeholder cats until real art lands; CI checks the committed sheets are current by comparing pixels ([#13](https://github.com/darth-dodo/windowsill/pull/13)).
- Claude Code project skills for syncing stacked PRs, cutting a release and adding pet art, plus a repo `CLAUDE.md`; `npm run check` now runs every CI gate locally.
- Pet art generator (`npm run art:generate`, OpenRouter image model) and the first orange tabby set: reference cat, 12 puppet parts and 8 key poses in `art/source/cat/orange-tabby/`.

[Unreleased]: https://github.com/darth-dodo/windowsill/commits/main
