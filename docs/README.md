# Tài liệu Godbean — Farm & Café V3

Code là nguồn sự thật; tài liệu mô tả code hiện tại. Mọi con số nằm trong `src/core/config/*.js`.

## Hiện hành

| File | Dùng để |
|---|---|
| [design/v3-gdd.md](design/v3-gdd.md) | GDD V3: luồng truyện, vòng chơi, nội dung, tiến trình, kinh tế, camera, UI, save, test |
| [design/v3-architecture.md](design/v3-architecture.md) | Kiến trúc và hợp đồng module: lớp, store/action/event/error, pha truyện, API realm và HUD, gói ngôn ngữ |
| [AUTONOMOUS_DECISIONS.md](AUTONOMOUS_DECISIONS.md) | Các quyết định đã tự đưa ra khi dựng lại V3 (an toàn dữ liệu, gameplay, UI) |

## Từng màn

| Màn | Tài liệu | Code |
|---|---|---|
| 00 · Chọn nhân vật | [screens/00-selection.md](screens/00-selection.md) | `src/features/selection/` |
| 01 · Intro | [screens/01-intro.md](screens/01-intro.md) | `src/features/intro/` |
| 02 · Gặp Thầy | [screens/02-teacher.md](screens/02-teacher.md) | `src/features/teacher/` |
| 03 · Bản đồ thế giới | [screens/03-atlas.md](screens/03-atlas.md) | `src/features/atlas/` |
| 04 · Vùng đất 3D | [screens/04-realm.md](screens/04-realm.md) | `src/features/realm/` |
| 05 · HUD | [screens/05-hud.md](screens/05-hud.md) | `src/features/hud/`, `src/ui/styles/v3.css` |

## Lưu trữ (lịch sử, không còn khớp gameplay)

| File | Ghi chú |
|---|---|
| [design/godbean-gdd.md](design/godbean-gdd.md) | GDD bản trước (thiên đàng, nông trại/quán cũ). Mục §5–§10 đã được V3 thay thế; phần tầm nhìn, âm thanh, analytics vẫn tham khảo được |
| [references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf](references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf) · [GODBEAN_MASTER_HANDOFF_FIXED.md](references/GODBEAN_MASTER_HANDOFF_FIXED.md) | Bản handoff gốc của founder |

## Quy ước

- Đổi luật hay số liệu: sửa `src/core/config/`, chạy `npm test` và `npm run sim`, cập nhật GDD V3 trong cùng thay đổi.
- Không commit ảnh chụp màn hình hay log test vào `docs/`.
