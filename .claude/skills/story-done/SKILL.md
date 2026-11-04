---
name: story-done
description: "Close a finished Godbean feature slice: check each acceptance criterion against code and evidence, check doc/code drift, update the GDD status row and progress log. Use when the user says a feature is done."
argument-hint: "[F-xx | path-to-spec]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write, Edit, AskUserQuestion, Bash(git status*), Bash(git diff*), Bash(git log*)
model: sonnet
---

# /story-done (Godbean adaptation of CCGS `story-done`)

1. Resolve the F-xx row (`docs/design/godbean-gdd.md` §0.3) and its spec/screen docs. List acceptance criteria.
2. For each criterion: point to the implementing code (file:line) and evidence: test name + recorded output from this conversation, or a screenshot/playtest the user did. No evidence → "unverified", never "passed".
3. Drift: compare rules docs and `docs/shared/contracts.md` with the code (`git diff` / changed files). List mismatches.
4. Verdict: **DONE / DONE WITH NOTES / NOT DONE** + gaps.
5. With the user's OK: update the GDD row per `docs/design/README.md` (status, "Kiểm chứng" only with evidence), fix doc drift, add a line to `docs/design/progress/YYYY-MM-DD-<người>.md`, move the item to Done in `docs/ai-studio/PROGRESS.md`.
6. Do not commit or push unless asked.
