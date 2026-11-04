# Báo cáo cài đặt — 04/11/2026

Cài trên nhánh `docs/session-templates` (HEAD `8a94d4b`), chưa commit. Sao lưu cấu hình trước khi sửa: tar của `.claude/`, `AGENTS.md`, `docs/README.md`, `docs/shared/claude-skills.md` (ngoài repo, scratchpad của phiên).

## Kiểm tra đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Frontmatter 13 agent (name khớp file, description, model hợp lệ, tools hợp lệ) | 0 lỗi |
| Frontmatter 15 skill (name, description, model) | 0 lỗi |
| Model | opus: game-designer, creative-director · sonnet: economy, ux, gameplay, tech-art, perf, producer · haiku: qa-tester · inherit: 4 agent phụ |
| Skill được Claude Code nhận | Có — game-studio, design-review, qa-plan, team-qa, sprint-status hiện trong danh sách skill ngay trong phiên; dev-story, story-done ẩn với model (`disable-model-invocation`), gọi tay bằng `/` |
| `settings.json`, `settings.local.json` là JSON hợp lệ | Có |
| Lệnh hook compact chạy tay | In được PROGRESS.md + git status |
| Phiên chính gọi agent | Có — gọi `qa-tester` (chỉ đọc) liệt kê test/import; agent tự báo chạy Haiku 5.5, không sửa file, không chạy test |
| Code game không đổi | Checksum `src/ tests/ index.html package.json` trước = sau |

## Chưa kiểm / không hỗ trợ

- Hook `compact` chưa thấy chạy thật (chỉ chạy lệnh tay); deny list chưa thử chặn.
- `model: sonnet` cho phiên chính áp dụng từ phiên sau (đang mở là phiên cũ).
- Subagent không gọi lồng được subagent; `producer` chỉ lập kế hoạch.
- Chưa có Playwright; QA trình duyệt dùng công cụ preview của app (pane có lúc không có WebGL).
- Skill upstream giữ nguyên vẫn tìm `production/`, `design/gdd/`, `project.yaml`; phải chỉ đường dẫn Godbean.
- Test game (`node --test tests/`) không chạy trong lần cài này.
