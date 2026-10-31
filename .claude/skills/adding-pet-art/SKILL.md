---
name: adding-pet-art
description: Use when the owner provides GenAI pixel art for Windowsill pets, when adding a coat, species or replacing placeholder art, or when npm run art fails on missing or wrong-size images
---

# Adding Pet Art

## Overview

Pets are **cut-out puppets**: parts that code animates, plus a few whole-body key poses. The owner generates the images; `npm run art` turns them into PixiJS sprite sheets. The spec's Art section in `docs/product.md` is the contract. Exact file names matter, because code looks frames up by name.

## The files (per species and coat)

Folder: `art/source/<species>/<coat>/`. Species is `cat` (and `dog` from Phase 2). The coat folder uses the `Colour` value spelling from `src/brain/types.ts`, for example `orange-tabby`.

| Kind | Names (each a `.png`) |
|---|---|
| Parts (12) | `body` `head` `ear-near` `ear-far` `eyes-open` `eyes-closed` `tail` `leg-front-near` `leg-front-far` `leg-back-near` `leg-back-far` `paw-raised` |
| Poses (8) | `sit` `loaf` `sleep-curl` `belly-up` `stretch` `groom` `sit-up` `dangle` |

Requirements: pixel art, side view **facing right**, on a flat magenta `#FF00FF` background. Any size works if it is a clean multiple of the 48 by 48 grid; the pipeline snaps it down.

## Steps

1. Branch from `main` (`feat/art-<species>-<coat>`).
2. Copy and rename the owner's files into the folder above. Check `ls | wc -l` gives 20 and that no names are misspelled.
3. Run `npm run art` (no `--placeholders`). If it exits 1, it lists missing or wrong-size files. Report those to the owner by name; never hand-edit their pixels.
4. Coats: orange tabby is generated once, and **black, white and grey are recoloured from it automatically**. **Tuxedo, calico and Siamese** have patterns, so each needs its own 20 files. A coat appears in **New pet** only once its sprite sheet exists.
5. Commit the sources (`art/source/...`) **and** the generated sheets (`src/assets/atlas/<species>-<coat>.png` and `.json`), because CI does not run the art step with real art. If a part pivots wrongly (for example the tail swings from its middle), adjust `art/rig/<species>.json`, not the image.
6. Run `npm run check`, then `npm run tauri dev`, and look at the pet: facing direction, blinking, tail swish and layering. Add a changelog line under `[Unreleased] > Added`, then open the PR.

## Prompt tip for the owner

Generate one full-body reference first, then reuse it as the reference image for every part, with the same stem: *"pixel art, 48x48 grid, side view facing right, orange tabby cat, `<part>`, flat magenta #FF00FF background, no shadow, no text"*.

## Common Mistakes

| Mistake | Instead |
|---|---|
| `orange_tabby` or `Orange Tabby` folder names | Match the `Colour` value: `orange-tabby` |
| Facing left | The code mirrors right-facing art; regenerate facing right |
| Transparent or white background | Flat `#FF00FF` only; it is the key colour |
| Committing sources but not the atlas | Commit both |
| Generating all 7 coats separately | Only orange tabby plus the three patterned coats |
