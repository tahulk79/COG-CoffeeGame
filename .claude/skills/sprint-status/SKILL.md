---
name: sprint-status
description: "Fast Godbean status snapshot: in-flight work, recent progress logs, GDD feature status, uncommitted changes, risks. 'How are we doing?'"
argument-hint: "[days, default 7]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash(git status*), Bash(git log*)
model: haiku
---

# /sprint-status (Godbean adaptation of CCGS `sprint-status`)

Read-only, ≤25 lines of output. Godbean has no sprint files; sources are:

1. `docs/ai-studio/PROGRESS.md`: Active / Blocked items.
2. Newest files in `docs/design/progress/` within the window (default 7 days): "Xong", "Đang làm", "Vướng".
3. `docs/design/godbean-gdd.md` §0.3: count features per status; list ones marked in progress.
4. `git status --short | wc -l` and `git log --oneline -10`: uncommitted volume, recent commits.

Output:
- **Done (window)**: bullets
- **In progress**: item, owner, what's left
- **Blocked / needs decision**
- **Risks**: large uncommitted diff, features coded but "Chưa kiểm chứng", docs flagged in GDD §0.4
- **Next**: 1–3 suggestions.
Never invent dates or percentages.
