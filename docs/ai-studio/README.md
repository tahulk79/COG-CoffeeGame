# AI Studio cho Godbean

Bộ cấu hình Claude Code biến repo thành "studio": phiên chính đóng vai Producer, giao việc cho 8 agent chuyên môn, dùng skill theo quy trình của [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT, commit `05ad7c8`), đã chỉnh cho game web Three.js.

| File | Nội dung |
|---|---|
| [USAGE.md](USAGE.md) | Lệnh dùng hằng ngày — **đọc cái này trước** |
| [AGENTS.md](AGENTS.md) | 8 agent chính + 5 agent phụ: model, quyền, phạm vi |
| [SKILLS.md](SKILLS.md) | Skill đã cài, skill tự viết, skill bỏ |
| [WORKFLOWS.md](WORKFLOWS.md) | Luồng điều phối, 3 chế độ review/dev/auto, khôi phục phiên |
| [MANIFEST.md](MANIFEST.md) | Đã nhập / đã sửa / đã bỏ gì so với upstream |
| [SETUP-REPORT.md](SETUP-REPORT.md) | Kết quả cài đặt và kiểm tra |
| [PROGRESS.md](PROGRESS.md) | Việc đang làm (ngắn) — dùng để khôi phục sau compact |

`AGENTS.md` ở gốc repo luôn thắng mọi file trong `.claude/`.
