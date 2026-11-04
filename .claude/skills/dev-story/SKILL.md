---
name: dev-story
description: "Implement one Godbean feature slice (F-xx row or written spec) in code, following the screen docs. Use when the user says to build or implement a feature. Not for closing it (use /story-done)."
argument-hint: "[F-xx | path-to-spec]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, Agent, AskUserQuestion, Bash(git status*), Bash(git diff*)
model: sonnet
---

# /dev-story (Godbean adaptation of CCGS `dev-story`)

The "story" is a GDD feature row (F-xx, `docs/design/godbean-gdd.md` §0.3) or a spec file the user names.

1. **Gate**: the source must be approved: GDD row exists and the idea (if any) is `Đã chốt`. Otherwise stop.
2. **Read**: spec, screen `README.md` + `rules.md`/`gameplay.md`, `docs/shared/contracts.md` if save/data is touched, and the code files the README lists. Write down acceptance criteria (from the spec; ask if missing).
3. **Plan** to the user: files to change, new save fields + migration, doc updates. Ask before new dependencies or save-format breaks.
4. **Implement**: do it yourself for small changes; for larger work spawn `gameplay-programmer` with a self-contained brief (criteria, files allowed, Three.js checklist below). Art-heavy parts → `technical-artist`. Max 3 agents, no overlapping files.
5. **Three.js checklist**: reuse geometry/materials; dispose on scene exit (`src/shared/three` `disposeScene`); no allocations in per-frame loops; keep draw calls flat; touch input works; old saves load.
6. **Tests**: add/adjust a node test for new logic in `tests/`. Do not run it unless the user asked (AGENTS.md); say "not run".
7. **Docs**: same change updates the screen rules doc, contracts if needed, progress log line.
8. Report changed files, criteria met/unverified, and suggest `/story-done F-xx`.
