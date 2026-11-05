# Tài liệu game Godbean

**Godbean: Build your own Coffee Empire!**

Tài liệu tổ chức theo **màn chơi**. Bắt đầu từ [sơ đồ liên kết các màn](game-flow.md), sau đó vào thư mục của màn cần xem.

Đọc nhanh toàn bộ thiết kế trong một file: [GDD tổng hợp](design/godbean-gdd.md). Mục 0 của GDD là **bảng trạng thái**: thiết kế đã chốt tới đâu, code đã làm tới đâu, tài liệu còn cần sửa gì. Quy ước cập nhật: [design/README.md](design/README.md). Khi mâu thuẫn, tài liệu theo màn thắng.

## Theo màn

| Màn | Thư mục | Nội dung chính |
|---|---|---|
| 00 · Chọn nhân vật | [screens/00-selection](screens/00-selection/README.md) | Chọn giới tính, đặt tên |
| 01 · Intro (Màn 1) | [screens/01-intro](screens/01-intro/README.md) | Đoạn mở đầu 23,5 s |
| 02 · Thiên đàng | [screens/02-heaven](screens/02-heaven/README.md) | Hội đồng trùng sinh, câu hỏi, hành trang |
| 02b · Bản đồ thế giới | [screens/02b-world-map](screens/02b-world-map/README.md) | Chọn nơi trùng sinh: chỉ nông trại / chỉ quán / cả hai |
| 03 · Nông trại | [screens/03-farm](screens/03-farm/README.md) | Trồng, chăm, thu, sơ chế, nhân viên, đơn hàng |
| 04 · Quán cà phê | [screens/04-cafe](screens/04-cafe/README.md) | Pha chế, khách, nhân viên quán |

## Dùng chung nhiều màn

| File | Nội dung |
|---|---|
| [game-flow.md](game-flow.md) | Sơ đồ chuyển màn và dữ liệu đi theo |
| [shared/contracts.md](shared/contracts.md) | Hợp đồng dữ liệu: save, model farm/quán, trường cài đặt |
| [shared/onboarding-flow.md](shared/onboarding-flow.md) | 5 phút đầu, HUD mở dần, thiên đàng là bài học |
| [shared/mobile-first-proposal.md](shared/mobile-first-proposal.md) | **Đề xuất** (chưa chốt): 10 quyết định mobile-first — thiên đàng mini, Hội đồng so le, trục Cấp, ca tập quán, công trình thay nút |
| [shared/robot-staff.md](shared/robot-staff.md) | Robot và nhân viên (farm + quán) |
| [shared/crew-autoplay.md](shared/crew-autoplay.md) | 3 slot đội, sao robot/nhân viên/bạn, lười-mệt, chia việc không trùng, chế độ Auto |
| [shared/coffee-memory.md](shared/coffee-memory.md) | Coffee Memory + Quick Taste: ly game và ly ngoài đời, so sánh A/B, xuất/xóa (F-33, F-34; chưa code) |
| [shared/decode-awaken.md](shared/decode-awaken.md) | Câu hỏi mở, Fragment, Sixth Key, First Sixth Key (F-35; chưa code) |
| [shared/progression.md](shared/progression.md) | Ba trục Wealth / Mastery / Awakening, hai mục tiêu thắng (F-36; chưa code) |
| [shared/analytics.md](shared/analytics.md) | Analytics theo sự kiện, envelope, riêng tư (F-38; chưa code) |
| [shared/ui-audio-vfx.md](shared/ui-audio-vfx.md) | UI dùng chung, âm thanh, VFX, cài đặt |
| [shared/i18n.md](shared/i18n.md) | Đa ngôn ngữ Anh/Việt: khóa, file locale, cách thêm chuỗi |
| [ai-studio/](ai-studio/README.md) | Studio AI cho Claude Code: agent, skill, `/game-studio`, chế độ review/dev/auto |
| [shared/design-system.md](shared/design-system.md) | Token màu, chữ, component, bố cục HUD |
| [shared/art-direction.md](shared/art-direction.md) | Định hướng hình ảnh, ánh sáng, vật liệu |
| [shared/project-structure.md](shared/project-structure.md) | Cấu trúc thư mục mã nguồn |
| [shared/claude-skills.md](shared/claude-skills.md) | 8 skill Claude Code (review GDD, cân bằng, UX, hiệu năng, playtest...) và cách dùng |

## Asset 3D

| File | Nội dung |
|---|---|
| [assets/asset-pipeline.md](assets/asset-pipeline.md) | Quy trình Meshy → Blender → game, ngân sách |
| [assets/scene-assets.md](assets/scene-assets.md) | Bố cục cảnh, slot thay model |
| [assets/qa-checklist.md](assets/qa-checklist.md) | Checklist khi gắn asset |
| [assets/registry/](assets/registry/) | Sổ đăng ký asset, nhân vật, cảnh, animation, VFX |

## Lưu trữ (`archive/`)

Tài liệu lịch sử và nhật ký làm việc, **không dùng làm đặc tả hiện hành**: kế hoạch redesign 3D, audit, checklist triển khai, bản đề xuất vận hành farm ban đầu, lịch sử luật cũ.

## Quy ước

- Mỗi màn có `README.md` tóm tắt, ghi rõ vào từ đâu, ra đâu, dữ liệu và code liên quan; file chi tiết khác trong cùng thư mục.
- File có chữ `proposal` là đề xuất, chưa phải luật đã chốt. Luật hiện hành nằm ở `gameplay.md` hoặc `rules.md` của màn.
- Đổi trường dữ liệu dùng chung phải sửa [shared/contracts.md](shared/contracts.md) cùng lúc.
- Không commit ảnh chụp màn hình hay log test vào `docs/`.
