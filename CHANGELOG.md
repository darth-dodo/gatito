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
- Pets on screen: PixiJS cut-out puppets that walk, sit, groom, stretch, loaf, nap with a floating "z" and blink, with ears and tail showing mood, smooth cross-fades between poses, and a sleeping cat that stretches before stepping out from under a still cursor ([#14](https://github.com/darth-dodo/windowsill/pull/14)).
- Claude Code project skills for syncing stacked PRs, cutting a release and adding pet art, plus a repo `CLAUDE.md`; `npm run check` now runs every CI gate locally.
- Pet art generator (`npm run art:generate`, OpenRouter image model) and the first orange tabby set: reference cat, 12 puppet parts and 8 key poses in `art/source/cat/orange-tabby/`.
- Browser demo page (`demo.html`) that runs the real pets on a pretend Mac desktop, with `?speed=` and `?seed=` options, and `npm run demo:record`, which films it into `docs/assets/demo.mp4` and `docs/assets/demo.gif` for the README.
- Petting and handling: stroke a pet with the cursor and it purrs with rising hearts, keep going on a happy pet and it rolls belly up, drag it at least 4 px to lift it by the scruff, release and it falls and lands on its feet; a lost mouse-up can never leave a pet stuck held ([#17](https://github.com/darth-dodo/windowsill/pull/17)).
- Tap a pet to pet it; three quick taps start a purr.
- Tricks: right-click a pet to open the cue ring (🎵 👏 🪶 🐟), pick a cue and the pet performs a trick; pet it within 3 seconds after the trick to reward it and it purrs. Rewarded pairings grow until the trick is learned, marked by a one-time sparkle. Tired pets yawn and unhappy ones may walk away. The ring closes on a click outside it, after 8 seconds, or when the cursor moves about 200 px away.
- Create, edit and rehome pets in a New pet window (name, coat, personality, with a live preview); pets, moods and learned tricks are saved and come back after a restart; a bad save file is moved aside and the first run opens New pet ([#19](https://github.com/darth-dodo/windowsill/pull/19)).
- Menu bar menu: New pet, per-pet Edit, Call over and Rehome, Nap time (remembered) and Launch at login; mood only changes while you are at the computer ([#22](https://github.com/darth-dodo/windowsill/pull/22)).
- macOS release checklist, .dmg bundle settings and install notes ([#25](https://github.com/darth-dodo/windowsill/pull/25)).
- App icon: an orange tabby peeking over the windowsill, masked to the macOS icon grid. `npm run art:icon` rebuilds every bundle size from `art/source/app-icon/source.png` ([#26](https://github.com/darth-dodo/windowsill/pull/26)).
- Dogs: pick Dog in New pet (only the chosen species' coats are offered, and the preview shows the dog). A second species that shares every cat system (mood, petting, pick up and drop, tricks, memory) with its own look and reactions. Dogs **Wag** instead of purring, take a **Curl nap** with the nose under the tail instead of loafing, **Scratch** an ear instead of grooming, thump their tail in a sit, and wag faster the happier they are. Seven dog coats (golden, black, white, brown, spotted, tricolour, husky grey). A generated golden retriever made like the tabby (reference drawn in the cat's style with `--style`, parts cut from it, 8 poses and a 6-frame walk cycle), recoloured to black, white and brown; floppy ears swing back when cross (`earTurn` in the rig); the save file accepts dogs in dog coats; the art pipeline recolours golden into black, white and brown; `npm run art:generate -- --species dog` prompts for dog poses; the browser demo and the README demo video and GIF show two dogs. The pet limit note now reads "6 pets is the limit".

### Changed

- The README covers cats and dogs (how a dog differs, which coats exist), how to run from source and how pet art is made. Its demo video and GIF show three cats and three dogs.
- Per-pose tail placement and the ears and eyes layered on the sit pose moved from `rig.ts` into `art/rig/<species>.json`, so each species tunes its own puppet; cats look exactly as before.
- Pet art uses a 96 by 96 grid shown at 1x instead of 48 by 48 at 2x, so generated art keeps its detail at the same size on screen; the `sit` pose is drawn without ears and eyes, which are layered on ([#14](https://github.com/darth-dodo/windowsill/pull/14)).
- CI runs the app build in parallel and as a fast debug compile on pull requests; the full release bundle runs on main.
- Walking cats use a generated six-frame walk cycle by default (coats without one fall back to the puppet walk), and the puppet parts are cut from the single reference cat with `npm run art:cut`, so parts line up with no seams ([#21](https://github.com/darth-dodo/windowsill/pull/21)).
- Smoother, lighter drawing: pets are drawn at a position interpolated between physics steps, the overlay canvas renders a quarter of the pixels on Retina while staying crisp, and the cursor poll no longer asks the main thread for the scale factor; `?debug=1` or `WINDOWSILL_DEBUG=1` shows a frame-time readout ([#21](https://github.com/darth-dodo/windowsill/pull/21)).

### Fixed

- Recoloured coats no longer get a pink fringe: edge pixels blended with the magenta background are keyed out instead of being mapped to the nose colour (black, white and grey cats too).

- Puppet seams and the light magenta halo around the cat outline; the sleeping "z" now starts above the head, and pose cross-fades no longer turn the cat see-through halfway ([#21](https://github.com/darth-dodo/windowsill/pull/21)).
- Petting works in the real app: strokes are read from the system cursor because macOS does not send mouse moves to the unfocused overlay.
- Safer boot and quiet pets during Nap time: quitting always saves even if a boot step fails, background errors are logged instead of unhandled, and pets that are curling up or fading cannot be tapped, stroked or dragged ([#24](https://github.com/darth-dodo/windowsill/pull/24)).
- Cats have noses again: the generated nose is only a few pixels at sprite size, so the 16 colour limit merged it into the fur. The art build now keeps it, in the one nose colour every coat shares ([#27](https://github.com/darth-dodo/windowsill/pull/27)).
- Install notes cover macOS 15 and newer, where unsigned apps open from **Open Anyway** in System Settings > Privacy & Security instead of right-click > Open; the bundle is now ad-hoc signed so a downloaded copy on Apple Silicon is not reported as damaged, with an `xattr` fallback in the README ([#29](https://github.com/darth-dodo/windowsill/pull/29)).

[Unreleased]: https://github.com/darth-dodo/windowsill/commits/main
