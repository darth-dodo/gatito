# CLAUDE.md

Windowsill: little cats (and, in Phase 2, dogs) that live on the macOS desktop. Tauri 2 (Rust) for the Mac parts, TypeScript with PixiJS for the pets. macOS only.

- Spec: `docs/product.md` (behaviour names in **bold** are contracts). Plan: `docs/superpowers/plans/`.
- Pure pet logic lives in `src/brain/` (no DOM, unit tested, 85 % line coverage floor). Every tunable number lives in `src/brain/tuning.ts`.

## Before pushing

`npm run check` runs every CI gate locally: typecheck, tests with coverage, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`. If you changed `src-tauri/`, `tauri.conf.json`, dependencies or CI, also run `npm run tauri build -- --bundles app`.

## Conventions

- One branch and one PR per feature. The owner squash-merges; stacked PRs are kept in sync (use the `syncing-stacked-prs` skill).
- Every PR adds its user-visible changes to `CHANGELOG.md` under `[Unreleased]` (Keep a Changelog: Added, Changed, Fixed, Removed).
- Conventional commits. Never use em or en dashes in code, comments, docs or commit messages.
- No new dependencies unless the task needs them. Pin exact versions.
- No network calls except to a local Ollama (Phase 2, optional). No telemetry.

## Skills

- `syncing-stacked-prs`: after a squash merge, before merging the next PR.
- `cutting-a-release`: when asked to release or tag a version.
- `adding-pet-art`: when adding or replacing GenAI pet images.
