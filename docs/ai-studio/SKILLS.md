# Skill

File: `.claude/skills/<tên>/SKILL.md`. Gõ `/<tên> [tham số]` trong Claude Code tại thư mục repo.

## Từ upstream, giữ nguyên (8)

| Lệnh | Dùng để | Tham số gợi ý |
|---|---|---|
| `/project-stage-detect` | Đánh giá giai đoạn dự án, lỗ hổng | `programmer` / `designer` |
| `/balance-check` | Cân bằng kinh tế | `src/features/farm/content.js`, `src/features/cafe/recipes.js` |
| `/ux-review` | Duyệt spec UX/HUD | `docs/shared/design-system.md` |
| `/perf-profile` | Phân tích hiệu năng | `farm`, `cafe`, `full` |
| `/regression-suite` | Đối chiếu test với luật | `audit` |
| `/playtest-report` | Báo cáo chơi thử | `new` / `analyze <file>` |
| `/review-all-gdds` | Review chéo toàn bộ tài liệu | `full` |
| `/team-polish` | Nhóm polish (perf + art + sound + QA) | `farm` |

Các skill này viết cho bố cục CCGS (`design/gdd/`, `production/`, `project.yaml`). Godbean không có, nên luôn chỉ rõ đường dẫn: GDD `docs/design/godbean-gdd.md`, luật `docs/screens/*/rules.md`.

## Viết lại cho Godbean, giữ tên upstream (6)

Bản gốc phụ thuộc `production/epics`, `sprint-status.yaml` và script story không có ở đây. "Story" của Godbean = dòng **F-xx** trong GDD §0.3.

| Lệnh | Dùng để | Model |
|---|---|---|
| `/design-review <file>` | Duyệt 1 tài liệu thiết kế trước khi code | sonnet |
| `/qa-plan <F-xx\|màn>` | Kế hoạch test: logic/tích hợp/hình/UI + smoke | sonnet |
| `/team-qa <F-xx\|màn>` | Chạy vòng QA (gọi là cho phép chạy test) | sonnet |
| `/dev-story <F-xx>` | Làm 1 tính năng đã chốt | sonnet, chỉ gọi tay |
| `/story-done <F-xx>` | Đóng tính năng, cập nhật GDD + tiến độ | sonnet, chỉ gọi tay |
| `/sprint-status [ngày]` | Tóm tắt tiến độ nhanh | haiku |

## Tự viết (1)

| Lệnh | Dùng để |
|---|---|
| `/game-studio [review\|dev\|auto] <mục tiêu>` | Cửa vào duy nhất: đọc mục tiêu → chọn skill/agent → kế hoạch → giao việc → làm → kiểm → ghi tài liệu → báo cáo |

## Không cài

63 skill upstream còn lại (setup-engine, gate-check, sprint-plan, create-stories, release-checklist, team-combat…): phụ thuộc engine Godot/Unity/Unreal hoặc quy trình sprint/epic Godbean không dùng. Danh sách đầy đủ: [MANIFEST.md](MANIFEST.md).
