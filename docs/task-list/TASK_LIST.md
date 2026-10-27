# Task list

> Cập nhật lần cuối: **2026-10-27**. Quy định cập nhật: xem [README.md](README.md).

## Danh sách việc

| ID | Việc | Trạng thái | Người | Docs/Code liên quan | Ghi chú |
|---|---|---|---|---|---|
| T-001 | Giảm kích thước ghế, ghế bành, chậu cây (trước đây bị phóng to theo ô) | Done 2026-10-27 | | `src/components/render/PlaceholderRenderer.ts` | |
| T-002 | Nhãn tên đồ vật chỉ hiện khi đứng gần (≤2 ô) hoặc rê chuột; trạng thái cần làm (tiến độ, chín, khát, xong) vẫn hiện sẵn | Done 2026-10-27 | | `src/components/render/PlaceholderRenderer.ts` | Sửa assertion `tests/e2e/story-incident.spec.ts` cho khớp |
| T-003 | Khung thoại dùng đúng chân dung người nói (thầy / nhân vật chính) | Done 2026-10-27 | | `src/ui/StoryHud.ts`, `src/gameplay/story/StoryService.ts` | |
| T-004 | Khách và nhân viên khác người chơi (tô màu, nhỏ hơn); bảng đơn hàng dùng icon "people" thay vì mặt nhân vật chính | Done 2026-10-27 | | `src/components/render/PlaceholderRenderer.ts`, `src/ui/theme/assetRegistry.ts` | Tạm thời, chờ asset khách riêng (T-014) |
| T-005 | Đồng bộ cỡ chữ tiêu đề panel (15px→16px, 11px→12px) theo token | Done 2026-10-27 | | `src/ui/*Hud.ts` | |
| T-006 | Thanh menu dưới: ẩn nút chưa dùng được (Đến nông trại khi đang cốt truyện, Nhân viên, Trang trí chưa mở khoá); hiện menu ở màn chương thầy | Done 2026-10-27 | | `src/ui/hud/BottomToolbar.ts`, `src/scenes/HudScene.ts` | Bản đồ, Sổ tay ẩn trong cốt truyện |
| T-007 | Chương thầy: dòng mục tiêu đổi theo từng bước (nhận order → xay → nén → chiết → mang ra) | Done 2026-10-27 | | `src/gameplay/guide/guide.ts`, `src/ui/StoryHud.ts` | |
| T-008 | Chương thầy: ông lão ở kệ biến mất khi bắt đầu, khách "thầy" xuất hiện tại chỗ ông đứng và đi ra quầy; tự gọi lại nếu thầy biến mất | Done 2026-10-27 | | `src/gameplay/story/StoryService.ts`, `src/gameplay/cafe/CafeService.ts`, `src/components/presenters/StoryPresenter.ts` | Có e2e `tests/e2e/story-master.spec.ts` (cả chế độ lv99) |
| T-009 | Thẻ "Hướng dẫn" sau cốt truyện: luôn chỉ việc tiếp theo ở nông trại/quán, theo 3 nhiệm vụ đầu | Done 2026-10-27 | | `src/gameplay/guide/guide.ts`, `src/ui/hud/GuideHud.ts`, `tests/unit/guide.test.ts` | Tắt khi nhận xong 3 nhiệm vụ đầu |
| T-010 | Nông trại: ô chưa mua mờ + ổ khoá + giá; ô đã mua có viền; căn tâm ảnh đất vào tâm ô; dời bản đồ khi bảng Nông trại mở | Done 2026-10-27 | | `src/components/render/PlaceholderRenderer.ts`, `src/components/render/h5Assets.ts`, `src/scenes/WorldScene.ts` | |
| T-011 | Đưa code Phaser + TypeScript lên GitHub thay bản JS cũ | Review | | PR [#57](https://github.com/tahulk79/TheCoffeeSixSense/pull/57) | Chờ merge vào `main`. PR xoá cả `.github/` |
| T-012 | Sửa 2 test e2e `m3-processing-market` đang đỏ (click máy rang rơi vào cây chồng lên) | Todo | | `tests/e2e/m3-processing-market.spec.ts` | Chưa rõ đỏ từ trước hay do thay đổi gần đây |
| T-013 | Test hiệu năng pathfinding (ngưỡng 2ms) chập chờn | Todo | | `tests/unit/pathfinding.test.ts` | Nới ngưỡng hoặc đo trung vị nhiều lần hơn |
| T-014 | Thay mock bằng asset thật có animation: khách, nhân viên, thầy (hiện dùng chung sprite hero) | Todo | | [../ASSET_REPLACEMENT_GUIDE.md](../ASSET_REPLACEMENT_GUIDE.md) | |
| T-015 | Thêm lại workflow CI / deploy GitHub Pages sau khi merge (`.github/` bản cũ bị xoá) | Todo | | | Quyết định có cần deploy không |
| T-016 | Chuỗi hướng dẫn học tiếp sau 3 nhiệm vụ đầu (rang, bán, nhân viên, trang trí…) | Todo | | `src/gameplay/guide/guide.ts` | |
| T-017 | Màn nhỏ (<760px): bảng Nông trại vẫn mở sẵn che đất, cân nhắc thu gọn mặc định | Todo | | `src/ui/FarmHud.ts`, `src/scenes/HudScene.ts` | |

## Nhật ký cập nhật
| Ngày | Người | Thay đổi |
|---|---|---|
| 2026-10-27 | Claude (theo yêu cầu) | Tạo task list; ghi T-001…T-017 từ đợt rà UI, sửa chương thầy, nông trại và đẩy PR |
