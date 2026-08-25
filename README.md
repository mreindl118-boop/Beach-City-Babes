# 🍑 Beach City Babes — clean rebuild

This repository has been **scrubbed to a clean slate** for a fresh, better-built
first pass. The previous implementation worked but had grown into two
2,000-line god-files; this restart rebuilds the same game with a clean, modular
architecture.

## Start here

**[`PROMPT.md`](./PROMPT.md)** is a complete, self-contained build brief. Open a
fresh Claude Code session on this repo and hand it that prompt — it builds the
game from scratch in tested milestones (M0 core loop → M8 ship).

## The old build is preserved

Nothing was lost. The full previous implementation (v0.15.0-alpha — procedural
characters, generative chat + art, phone, drama, relationship web, animated
portraits, PWA, APK CI) lives in git history on branch **`archive/build-1-reference`**.
Use it as prior art for tuning values and edge cases — read it, don't copy it.

```bash
git fetch origin archive/build-1-reference
git show archive/build-1-reference:README.md   # full feature tour of the old build
```
