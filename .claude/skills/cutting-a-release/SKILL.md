---
name: cutting-a-release
description: Use when asked to release, ship, tag or publish a Windowsill version, or to bump the app version
---

# Cutting a Release

## Overview

A release is a **changelog promotion plus a matching version in three files**, merged through a PR, then a `vX.Y.Z` tag. The tag triggers `.github/workflows/release.yml`, which builds a universal `.dmg` into a **draft** GitHub Release. Publishing the draft is always the owner's call.

## Steps

1. **Check readiness.** `main` is clean and its latest CI run is green (`gh run list --branch main --workflow CI -L 1`). List open PRs (`gh pr list`) and tell the owner what is and is not in this release before going further.
2. **Release branch** `release/vX.Y.Z` from `origin/main`.
3. **Version** set to `X.Y.Z` in all three places, which must match: `package.json` `"version"`, `src-tauri/tauri.conf.json` `"version"`, `src-tauri/Cargo.toml` `[package] version`. Then run `npm install --package-lock-only` and `cd src-tauri && cargo update -p windowsill --precise X.Y.Z` (or `cargo check`) so the lockfiles agree.
4. **Changelog** (Keep a Changelog):
   - Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, using today's date.
   - Add a new empty `## [Unreleased]` above it.
   - Update the link references at the bottom:
     ```
     [Unreleased]: https://github.com/darth-dodo/windowsill/compare/vX.Y.Z...HEAD
     [X.Y.Z]: https://github.com/darth-dodo/windowsill/compare/vPREV...vX.Y.Z
     ```
     For the first release, use `.../releases/tag/vX.Y.Z` instead of a compare link.
5. **PR** `chore(release): vX.Y.Z`, CI green, squash-merge.
6. **Tag the merge commit:** `git fetch && git tag -a vX.Y.Z origin/main -m "Windowsill vX.Y.Z" && git push origin vX.Y.Z`.
7. **Watch** the Release workflow (`gh run watch`), then `gh release view vX.Y.Z` to confirm it is a draft with a `.dmg` attached. Send the owner the draft URL and note that the build is unsigned (first launch needs right-click, Open).

## Common Mistakes

| Mistake | Instead |
|---|---|
| Tagging without promoting `[Unreleased]` | The changelog section and the tag ship together, via the release PR |
| Versions differ across the three files | The bundle reads `tauri.conf.json`; keep all three identical |
| Tagging a branch commit, not the squash commit on `main` | Tag `origin/main` after the release PR merges |
| Publishing the draft release | Leave it as a draft for the owner |
| Moving or deleting a pushed tag on failure | Report the failing step and ask first |
