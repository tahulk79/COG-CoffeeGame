# Cách dùng

Chạy Claude Code tại thư mục repo. Phiên chính mặc định model **sonnet** (đặt trong `.claude/settings.local.json`, chỉ máy này; đổi bằng `/model`).

## Hay dùng nhất

```
/game-studio review đánh giá vòng chơi nông trại 10 phút đầu
/game-studio dev F-29 nhân viên mệt thì làm chậm
/game-studio auto   (dán backlog đã duyệt ngay sau)
```

## Theo việc

| Muốn | Gõ |
|---|---|
| Tình hình dự án | `/sprint-status` hoặc `/project-stage-detect` |
| Duyệt 1 tài liệu | `/design-review docs/screens/02b-world-map/market-proposal.md` |
| Cân bằng giá | `/balance-check src/features/farm/content.js` |
| Duyệt HUD | `/ux-review docs/shared/design-system.md` |
| Hiệu năng | `/perf-profile farm` |
| Kế hoạch test | `/qa-plan F-28` |
| Chạy QA | `/team-qa farm` |
| Làm / đóng tính năng | `/dev-story F-xx` → `/story-done F-xx` |
| Review toàn bộ GDD | `/review-all-gdds full` |

## Gọi thẳng 1 agent

Nói trong chat: "dùng economy-designer xem giá hạt Arabica" hoặc "dùng qa-tester với sonnet debug test farm". Phiên chính sẽ gọi agent đó; kết quả là báo cáo của agent, phiên chính quyết định áp dụng.

## Lưu ý

- Ý tưởng `Mới`/`Đang xem` không được code (skill sẽ dừng).
- Báo cáo/screenshot/kết quả test không commit.
- Mỗi thay đổi ghi 1 dòng vào `docs/design/progress/YYYY-MM-DD-<người>.md`.
