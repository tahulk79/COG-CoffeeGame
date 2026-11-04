---
name: game-studio
description: "One entry point for Godbean game-dev requests: reads the goal, picks skills and specialist agents, plans, delegates from the main session, implements, verifies, documents, reports. Modes: review | dev | auto."
argument-hint: "[review|dev|auto] <objective>"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, Agent, AskUserQuestion, Bash(git status*), Bash(git diff*), Bash(git log*), Bash(node --test*)
---

# /game-studio — Godbean studio orchestrator

You are the **main session acting as Producer**. Only you can spawn agents (subagents cannot nest). Never say an agent ran unless an Agent tool call returned its result.

## 0. Parse
- Mode = first word if `review`, `dev` or `auto`; else `review`.
  - `review`: analyze only, no edits to `src/`. Output findings.
  - `dev`: implement the objective. Invoking `dev` counts as the user's explicit request to run `node --test tests/` for this task only (AGENTS.md otherwise forbids self-testing).
  - `auto`: work through a backlog the user approved in this conversation (list it back first). Same as `dev` per task. Stop on: destructive ops, security-sensitive actions, ambiguous requirements, 2 failed retries. Never push, merge, deploy.
- Objective = the rest. If empty, ask for it.

## 1. Context (scoped, don't load the whole repo)
1. `AGENTS.md` (rules win over this skill), `docs/ai-studio/PROGRESS.md` (in-flight work), `git status --short`.
2. `docs/README.md` → only the screen folder(s) the objective touches (`docs/screens/<NN>/`, matching `src/features/<screen>/`).
3. GDD status row (`docs/design/godbean-gdd.md` §0.3) for the F-xx involved. Ideas not `Đã chốt` → stop, tell the user.

## 2. Route
| Need | Agent (model) | Skill first? |
|---|---|---|
| Loop, progression, quests, tutorial | game-designer (opus) | `/design-review`, `/review-all-gdds` |
| Prices, costs, rewards | economy-designer (sonnet) | `/balance-check` |
| HUD, flow, touch, a11y | ux-designer (sonnet) | `/ux-review` |
| Code, bugs, saves | gameplay-programmer (sonnet) | `/dev-story` |
| Assets, shaders, VFX | technical-artist (sonnet) | — |
| FPS, memory, loading | performance-analyst (sonnet) | `/perf-profile` |
| Tests, regressions | qa-tester (haiku; sonnet for hard failures) | `/qa-plan`, `/team-qa`, `/regression-suite` |
| Multi-step plan | producer (sonnet, read-only) | `/sprint-status` |

Pick the fewest agents that cover the need. Trivial tasks (a few tool calls): do them yourself, no agent.

## 3. Plan
Write the plan to the user: tasks → owner → files → depends-on → check. Then update `docs/ai-studio/PROGRESS.md` (Active section).
- Max 3 agents at once; parallel only if independent and no shared files/state.
- Sequential: design → code; code → QA; profile → optimize; repro → fix → regression.
- In `review` mode stop after findings.
- Ask before: new dependencies, save-format changes, paid asset generation, deleting files.

## 4. Delegate
Each Agent call gets a self-contained brief: goal, files to read, files it may touch, what NOT to do, expected deliverable. Read-only agents (producer, qa-tester, performance-analyst) return text; you apply edits.

## 5. Review & integrate
Read each deliverable critically; check diffs yourself (`git diff`). Reject work that breaks AGENTS.md rules (web-style UI, unapproved ideas, invented metrics).

## 6. Verify (dev/auto only)
- `node --test tests/` — paste the summary line.
- Visual change: use the browser preview tools only if the user asked to see it or mode is `auto`; mobile 375×812 + desktop; screenshot. No WebGL in pane → say so, don't fake it.
- Three.js checklist: dispose geometry/materials/textures on exit, reuse geometry, no per-frame allocation in hot loops, draw calls not increased without reason, old saves load.

## 7. Document
- Changed rule → that screen's `rules.md`/`gameplay.md`; shared field → `docs/shared/contracts.md`; GDD §0.3 row if status changed.
- One line per change in `docs/design/progress/YYYY-MM-DD-<người>.md`.
- Update `docs/ai-studio/PROGRESS.md` (move to Done / Blocked).

## 8. Report
Done / not done / not verified, agents actually called, test output, files changed, next decision for the user.
