# Manifest cài đặt

- Upstream: https://github.com/Donchitos/Claude-Code-Game-Studios — commit `05ad7c8` (Release 1.2.0, 2026-10-19), MIT (`.claude/skills/LICENSE-ccgs`).
- Cài ở phạm vi dự án: `.claude/`. Nâng cấp: clone upstream mới, `diff -r` với bảng dưới; file "giữ nguyên" chép đè được, file "đã sửa" phải merge tay.

## Nhập, giữ nguyên

| Loại | Mục |
|---|---|
| Skill | balance-check, perf-profile, playtest-report, project-stage-detect, regression-suite, review-all-gdds, team-polish, ux-review |
| Agent | art-director, creative-director, engine-programmer, tools-programmer, sound-designer |
| Hỗ trợ | `.claude/hooks/yaml-helper.sh`, `.claude/scripts/artifact-check.sh`, `review-scope.sh`, `.claude/docs/` (workflow-catalog, director-gates, templates, coding-standards…) |

## Nhập, đã sửa

| Mục | Sửa gì |
|---|---|
| game-designer, ux-designer, gameplay-programmer, technical-artist | Thêm mục cuối "Godbean adaptation (local)" |
| economy-designer | model opus → sonnet; thêm mục Godbean (leo thang opus qua phiên chính) |
| performance-analyst | model opus → sonnet; bỏ Write/Edit (chỉ đọc); thêm mục Godbean |
| qa-tester | bỏ Write/Edit (chỉ đọc + chạy test); thêm mục Godbean (bỏ qua ví dụ GDScript) |
| producer | bỏ Write/Edit/WebSearch (chỉ lập kế hoạch); bỏ dòng skill `scope-check`, `estimate`; thêm mục Godbean |
| design-review, qa-plan, team-qa, dev-story, story-done, sprint-status | **Viết lại** theo cấu trúc Godbean (F-xx trong GDD, `docs/screens/`, `node --test`), giữ tên và mục đích upstream. Bản gốc cần `production/`, `design/registry/`, script story/ADR không có ở đây |

## Tự viết

- Skill `game-studio`.
- `.claude/settings.json`: danh sách `permissions.deny` (rút gọn từ upstream + `git push cog`), hook SessionStart `compact` in `docs/ai-studio/PROGRESS.md`.
- `.claude/settings.local.json` (không commit): `"model": "sonnet"`.
- `docs/ai-studio/*`.

## Không nhập

- **Hook upstream** (`session-start.sh`, `detect-gaps.sh`, `validate-commit/push/write/read/registry/assets.sh`, `log-agent*.sh`, `pre-compact.sh`, `notify.sh`, `update-check.sh`, statusline): ràng buộc vào `production/`, `design/registry/`, quy ước commit và phát hiện engine của CCGS; trên Godbean sẽ báo sai hoặc chặn nhầm. Thay bằng deny list + hook compact.
- **Skill (63)**: adopt, architecture-decision, architecture-review, art-bible, asset-audit, asset-spec, brainstorm, bug-report, bug-triage, changelog, code-review, consistency-check, content-audit, create-architecture, create-control-manifest, create-epics, create-stories, day-one-patch, design-system, estimate, gate-check, help, hotfix, launch-checklist, localize, map-systems, milestone-review, onboard, patch-notes, propagate-design-change, prototype, quick-design, release-checklist, retrospective, reverse-document, scope-check, security-audit, settings, setup-engine, skill-improve, skill-test, smoke-check, soak-test, sprint-plan, start, story-readiness, team-audio, team-combat, team-level, team-live-ops, team-narrative, team-release, team-ui, tech-debt, test-evidence-review, test-flakiness, test-helpers, test-setup, ux-design, vertical-slice.
- **Agent (36)**: toàn bộ agent Godot/Unity/Unreal; accessibility-specialist, ai-programmer, analytics-engineer, audio-director, community-manager, devops-engineer, lead-programmer, level-designer, live-ops-designer, localization-lead, narrative-director, network-programmer, prototyper, qa-lead, release-manager, security-engineer, systems-designer, technical-director, ui-programmer, world-builder, writer. Agent đã cài có nhắc tên các agent này: bỏ qua.
- Thư mục mẫu `production/`, `design/`, `project.yaml`, source mẫu.
