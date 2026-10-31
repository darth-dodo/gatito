---
name: syncing-stacked-prs
description: Use when a Windowsill PR was squash-merged and the next stacked PR still targets the old feature branch, when a stacked PR shows files from an already-merged PR, or before squash-merging the next PR in the stack
---

# Syncing Stacked PRs

## Overview

Windowsill ships one PR per feature, each stacked on the previous feature branch, and the owner squash-merges. A squash rewrites the merged commits into one new commit on `main`, so the next branch still carries the old originals. **Merge `origin/main` into the next branch. Never rebase or force-push:** the content is identical, so the merge is clean, and the PR's history and review comments survive.

## Steps (after PR N is squash-merged)

```bash
git fetch origin
gh pr edit <next-PR> --base main
T=$(mktemp -d)/sync && git worktree add "$T" origin/<next-branch> -B sync-tmp
cd "$T" && git merge --no-edit origin/main
```

**If it reports add/add conflicts** (the branch's merge base predates the files, so both sides "add" them): the stacked branch already contains everything on `main` plus its own work, so keep its side with `git checkout --ours -- . && git add -A`. Then **prove it**: `git diff --cached --stat origin/main` must list only this PR's own files. If any other file appears, stop and resolve it by hand. Then `git commit --no-edit`.

Then, in the same worktree:

1. Add the PR's lines to `CHANGELOG.md` under `## [Unreleased]` in the right Keep a Changelog group (Added, Changed, Fixed, Removed), ending with a link to the PR. Keep entries for already-merged PRs exactly as they are on `main`.
2. Commit with `docs(changelog): ...`, then `git push origin HEAD:<next-branch>` (a normal push, which fast-forwards).
3. Clean up: `cd - && git worktree remove "$T" && git branch -D sync-tmp`.
4. Verify: `gh pr view <next-PR> --json baseRefName,files,mergeable` shows base `main`, only that PR's own files, and `MERGEABLE`.
5. Wait for `gh pr checks <next-PR>` to show **CI Success** passing (a cancelled run reports as failed; look at the newest run).
6. Squash-merge only when the PR's review is approved and CI is green: `gh pr merge <next-PR> --squash --delete-branch=false`. Keep the branch, because the PR above it targets it until it is retargeted.

Repeat up the stack, one PR at a time.

## Common Mistakes

| Mistake | Instead |
|---|---|
| `git rebase --onto` plus `push --force-with-lease` | Merge `origin/main`; no history rewrite is needed |
| Retargeting a PR without syncing its branch | It shows the merged PR's files again; merge main first |
| Syncing in a worktree another agent is using | Always use a fresh temp worktree |
| Merging on a red or cancelled check | Wait for a fresh green CI Success |
| Deleting the merged branch straight away | The next PR may still target it; retarget first |
| Writing the changelog entry before syncing | Sync first, or the `[Unreleased]` list conflicts |
