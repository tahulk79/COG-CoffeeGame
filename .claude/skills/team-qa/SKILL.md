---
name: team-qa
description: "Run a QA cycle for a Godbean feature or screen from the main session: plan, run node tests via qa-tester, optional browser smoke, sign-off with evidence."
argument-hint: "[F-xx | screen-name]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Agent, AskUserQuestion, Bash(node --test*), Bash(git status*), Bash(git diff*)
model: sonnet
---

# /team-qa (Godbean adaptation of CCGS `team-qa`)

Invoking this skill is the user's explicit request to run tests for this target (AGENTS.md). The upstream `qa-lead` agent is not installed. The main session plays lead.

1. **Plan**: follow `/qa-plan` steps for the target (inline, don't re-invoke).
2. **Execute**: spawn `qa-tester` (haiku) with: target, test command `node --test tests/`, files of interest. It returns pass/fail with output. Complicated failure → spawn it again with `model: sonnet` and the failing output.
3. **Smoke (only if the user wants visual checks)**: start the dev server with the preview tools (`.claude/launch.json`), check portrait 375×812 and desktop, read console errors, screenshot. If WebGL is unavailable in the pane, record "not verified (no WebGL)".
4. **Sign-off** in chat:
   - verdict: PASS / PASS WITH ISSUES / FAIL
   - evidence: exact command + summary line, screenshots taken (not committed)
   - bugs: repro steps, expected vs actual, file:line suspect
   - untested areas.
5. Log one line in `docs/design/progress/YYYY-MM-DD-<người>.md`. If the result changes a feature's status, update GDD §0.3 ("Kiểm chứng" only with evidence).
