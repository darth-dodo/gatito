# Changelog

All notable changes to Windowsill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tauri 2 app with a transparent, always-on-top overlay window that sits on the usable screen area above the Dock, on every Space, with no Dock icon ([#3](https://github.com/darth-dodo/windowsill/pull/3)).
- CI with a single CI Success gate (typecheck, tests with an 85 % coverage floor on the pet brain, Rust fmt, clippy and tests, app bundle build), a tag-triggered release workflow that builds a universal `.dmg` into a draft GitHub Release, and Dependabot ([#3](https://github.com/darth-dodo/windowsill/pull/3)).
- Pet brain foundations: pet types, every tunable number in `tuning.ts`, a seeded random generator, and mood meters (affection and energy) that move only on active time ([#4](https://github.com/darth-dodo/windowsill/pull/4)).
- Claude Code project skills for syncing stacked PRs, cutting a release and adding pet art, plus a repo `CLAUDE.md`; `npm run check` now runs every CI gate locally.

[Unreleased]: https://github.com/darth-dodo/windowsill/commits/main
