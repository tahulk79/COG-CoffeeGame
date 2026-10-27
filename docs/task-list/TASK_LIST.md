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
| T-011 | Đưa code Phaser + TypeScript lên GitHub thay bản JS cũ | Done 2026-10-27 | | PR [#57](https://github.com/tahulk79/COG-CoffeeGame/pull/57) | Đã merge vào `main`. PR xoá cả `.github/` (xem T-015) |
| T-012 | Sửa 2 test e2e `m3-processing-market` đang đỏ (click máy rang rơi vào cây chồng lên) | Todo | | `tests/e2e/m3-processing-market.spec.ts` | Chưa rõ đỏ từ trước hay do thay đổi gần đây |
| T-013 | Test hiệu năng pathfinding (ngưỡng 2ms) chập chờn | Todo | | `tests/unit/pathfinding.test.ts` | Nới ngưỡng hoặc đo trung vị nhiều lần hơn |
| T-014 | Thay mock bằng asset thật có animation: khách, nhân viên, thầy (hiện dùng chung sprite hero) | Todo | | [../ASSET_REPLACEMENT_GUIDE.md](../ASSET_REPLACEMENT_GUIDE.md) | |
| T-015 | Thêm lại workflow CI / deploy GitHub Pages sau khi merge (`.github/` bản cũ bị xoá) | Todo | | | Quyết định có cần deploy không |
| T-016 | Chuỗi hướng dẫn học tiếp sau 3 nhiệm vụ đầu (rang, bán, nhân viên, trang trí…) | Todo | | `src/gameplay/guide/guide.ts` | |
| T-017 | Màn nhỏ (<760px): bảng Nông trại vẫn mở sẵn che đất, cân nhắc thu gọn mặc định | Todo | | `src/ui/FarmHud.ts`, `src/scenes/HudScene.ts` | |

| T-018 | Đồng bộ định hướng hai lõi, nông trại trước và hai tuyến du lịch vào GDD | Review | Codex | [GDD](../design/GAME_DESIGN.md), [flow](../design/GAMEPLAY_FLOW.md), [roadmap](../GAMEPLAY_ROADMAP.md) | Docs-only; phân biệt APPROVED / PROPOSED / GAP; chưa đổi gameplay |
| T-019 | Đặc tả phiên đầu và vòng nông trại → bán/giữ hạt → quán → tái cung ứng | Todo | | [GDD §0](../design/GAME_DESIGN.md) | Chốt vai nhân viên/chủ, vị trí cốt truyện, ngưỡng quay lại và chống kẹt vốn/hạt/giống |
| T-020 | Thiết kế riêng du lịch vùng trồng và mở quán tại thành phố nổi tiếng | Todo | | [GDD §0](../design/GAME_DESIGN.md) | Tận dụng RegionService; district hiện tại chưa là nội dung quốc tế |
| T-021 | Rà ranh giới khoa học và khả năng giữ lịch sử khám phá sau rewrite | Todo | | [GDD §0](../design/GAME_DESIGN.md) | Cây lâu năm, Culi/peaberry, đơn vị nguyên liệu, điểm timing; kiểm tra batch/session trước đổi schema |

| T-022 | Đồng bộ tên game và repository thành COG-CoffeeGame | Review | Codex | README và bộ tài liệu docs | Repo đổi tên đã xác minh; không đổi save keys hoặc gameplay |

| T-023 | Thay toàn bộ tên game cũ còn sót bằng COG-CoffeeGame | Done 2026-10-27 | Codex | `index.html`, `DebugOverlay.ts`, package manifests, asset/screen specs | Tên npm dùng `cog-coffeegame` theo quy tắc chữ thường; giữ tương thích save keys và test bridge |

## Nhật ký cập nhật
| Ngày | Người | Thay đổi |
|---|---|---|
| 2026-10-27 | Claude (theo yêu cầu) | Tạo task list; ghi T-001…T-017 từ đợt rà UI, sửa chương thầy, nông trại và đẩy PR |
| 2026-10-27 | Claude (theo yêu cầu) | T-011 chuyển sang Done: PR #57 đã merge vào `main` |

| 2026-10-27 | Codex | T-018…T-021: đồng bộ hướng Product Owner, xác định khoảng cách và bước đặc tả kế tiếp; không xác nhận lại kiểm thử lịch sử |

| 2026-10-27 | Codex | T-022: cập nhật tên chính thức và URL repository trong tài liệu |

| 2026-10-27 | Codex | T-023: đồng bộ tên game trong tiêu đề web, debug HUD, npm manifests và mô tả logo; rà toàn bộ 203 tệp văn bản, không còn tên đầy đủ cũ hoặc biến thể viết cách/gạch nối |
