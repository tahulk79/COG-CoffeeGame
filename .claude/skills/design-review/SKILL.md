---
name: design-review
description: "Review one Godbean design doc (rules.md, gameplay.md, *-proposal.md, idea) for completeness, consistency with other docs and code, and implementability before handing to programmers."
argument-hint: "[path-to-design-doc]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Agent, AskUserQuestion
model: sonnet
---

# /design-review (Godbean adaptation of CCGS `design-review`)

Read-only. No files written unless the user asks.

1. No argument → list `docs/screens/*/*-proposal.md` and `docs/design/ideas/*.md`, ask which.
2. Read the doc, `docs/game-flow.md`, the screen `README.md`, and the GDD rows it names (`docs/design/godbean-gdd.md` §0.3).
3. Check:
   - **Complete**: goal, player-facing rules, numbers, states, edge cases, UI entry points, save fields, acceptance criteria.
   - **Consistent**: against `rules.md`/`gameplay.md` of the same screen, `docs/shared/contracts.md`, and the code it describes (grep `src/features/<screen>/`). Doc says X, code does Y → list both with file:line.
   - **Implementable**: every rule maps to a code location or a clear new module; numbers are concrete.
   - **Game feel**: fits AGENTS.md "Thiết kế game" (3D world, small HUD, center modals).
   - **Status**: ideas `Mới`/`Đang xem` are not implementable yet.
4. Optional: delegate a deep pass to `game-designer` (opus) or `economy-designer` if numbers dominate. Only if the doc is large or the user asks.
5. Verdict: **APPROVED / NEEDS REVISION / MAJOR REVISION**, then a numbered list of blocking issues and suggestions with locations.
