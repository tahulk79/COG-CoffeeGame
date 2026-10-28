# Task list

> Cập nhật lần cuối: **2026-10-28**. Quy định cập nhật: xem [README.md](README.md).

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

| T-024 | Viết kế hoạch từng màn (Prototype → Vertical Slice → Production), kịch bản Màn 1 mới và danh sách asset cần thay | Review | Claude | [CHAPTER_PLAN](../production/CHAPTER_PLAN.md) | Chờ duyệt trước khi code |
| T-025 | Nối `framing.ts` vào camera: quán/nông trại zoom theo chế độ, zoom bằng con lăn | Review | Claude | `src/scenes/WorldScene.ts`, `src/components/render/PlaceholderRenderer.ts`, `src/systems/camera/framing.ts` | Chương 1-2 giữ khung cũ |
| T-026 | Màn 1 prototype bước 1: map phố 48×18, camera bám, chia 3 hồi | Review | Claude | [incident.json](../../src/data/maps/incident.json), `RunService.ts`, `StoryService.ts`, `incidentArt.ts`, `StoryHud.ts`, `WorldScene.ts` | Hồi 1 dạo phố có rào thi công ở cột 34; ghé 3 quán hoặc sau 180 giây thì sang giờ tan tầm. Hồi 3 tạm dùng luồng chết cũ, làm ở T-028/T-029 |
| T-027 | Màn 1 prototype bước 2: đám đông, 8 quán, thoại bong bóng có lựa chọn | Review | Claude | `src/gameplay/story/StreetService.ts`, `src/components/render/streetArt.ts`, [story.json](../../src/data/config/story.json), `StoryHud.ts` | Bỏ 7 điểm ghé cũ (trà sữa, wifi…). Lựa chọn trả lời là 2 nút ở HUD + phím 1/2. Người và quán vẫn là hình vẽ tạm |
| T-028 | Màn 1 prototype bước 3: dính 1 phát là ngất, gag có bẻ lái, cú chót khi né hết | Review | Claude | `RunService.ts`, `incidentArt.ts`, `RunAudio.ts`, [story.json](../../src/data/config/story.json), [CHAPTER_PLAN §1.2, §1.5](../production/CHAPTER_PLAN.md) | Bỏ luật 3 sao theo yêu cầu. 11 gag + gà (bẻ lái từ xe máy), 6 cú chót. Ngất xong vẫn chuyển màn bằng cổng cũ, xe cứu thương ở T-029 |
| T-029 | Màn 1 prototype bước 4: cảnh cứu hộ sau mọi kiểu ngất (đám đông, xe cứu thương, khiêng, "CỐP!"), xe lao vào vòng tròn ma thuật, Màn 2 mở bằng ánh sáng | Review | Claude | `StreetService.ts`, `streetArt.ts`, `TransitionScene.ts`, `RunService.ts`, [CHAPTER_PLAN §1.2](../production/CHAPTER_PLAN.md) | Đổi từ mí mắt sang vòng tròn ma thuật theo yêu cầu. Sửa luôn lỗi TransitionScene khi tải trang lúc màn hình chưa có kích thước |
| T-030 | Màn 1 Vertical Slice: asset 3D render sprite, UI kit, âm thanh theo danh sách §1.7 | Todo | | [CHAPTER_PLAN §1.7, §4](../production/CHAPTER_PLAN.md) | Sau khi chốt prototype |
| T-031 | Màn 1: chặn hai đầu phố bằng rào + bảo vệ; xe máy được mở cho qua, nài nỉ thì được qua rồi bị xe máy tông, xe cứu thương tới | Review | Claude | `StreetService.ts`, `streetArt.ts`, `RunService.ts`, [story.json](../../src/data/config/story.json) | Hồi 1 rút còn 90 giây; sửa chó/mèo đôi khi không xuất hiện; dời quán xe ôm sang x=8. Lỗi `getImageData` của TransitionScene khi tải trang lúc khung trình duyệt chưa có kích thước là lỗi cũ, chưa sửa |

| T-032 | Màn 1: sửa gameplay giả: xe máy xuyên hàng rào, tông không ngã, xe tông đứng im đè lên nhân vật, xe cứu thương đè lên nhân vật/đám đông | Review | Claude | `StreetService.ts`, `RunService.ts`, `GameSimulation.ts` | Xe nền quay đầu ở hàng rào; giờ tan tầm xe nền không dừng, chạm là bị tông; xe tông chạy tiếp ra khỏi màn; xe cứu thương đỗ cách 2,8 ô, đám đông đứng phía không có làn xe, xe khác xếp hàng sau xe cứu thương. Chưa xem lại được trong trình duyệt (khung trình duyệt bị ẩn) |
| T-033 | Màn 1: kiểm tra toàn bộ và sửa nhịp chơi + lỗi phát hiện khi test | Review | Claude | [chapter1-playtest.test.ts](../../tests/unit/chapter1-playtest.test.ts), `StreetService.ts`, `RunService.ts`, `StoryHud.ts`, `GameButton.ts`, `streetArt.ts`, `incidentArt.ts`, [story.json](../../src/data/config/story.json) | Hồi 1 còn 60s/2 quán; Hồi 2 45s, sự cố đầu ra ngay, dày gấp đôi; HUD ghi HỒI 1/3·2/3·3/3 + đếm giờ. Sửa: nhân vật không nằm khi ngất, xe máy xuyên thanh chắn, xe xuất hiện sau hàng rào, rào hở phía hồ, bảo vệ bật từ góc hồ và đè quán trà đá, nút trả lời tràn chữ trên điện thoại. Thêm: bấm vào người để nói chuyện, đi sát người qua đường thì họ nói, camera theo xe cứu thương, Màn 2 mở bằng cánh cổng. Unit 254/254; e2e `story-incident` vẫn lỗi thời |
| T-034 | Màn 1: thay hàng rào thi công giữa phố bằng trạm chắn có bảo vệ (xe máy được nâng thanh cho qua, người đi bộ bị chặn ở Hồi 1, dỡ trạm khi sang giờ tan tầm) | Review | Claude | `StreetService.ts`, `streetArt.ts`, `incidentArt.ts`, [story.json](../../src/data/config/story.json) | Bỏ việc xe máy quay đầu/đổi làn tức thì ở hàng rào (trông như biến mất) |
| T-035 | Màn 1: xe máy chạm nhân vật thì ngẫu nhiên phanh "Kíííít!" bốc khói hoặc tông, ở mọi hồi | Review | Claude | `StreetService.ts`, `streetArt.ts`, [story.json](../../src/data/config/story.json) | Tỉ lệ phanh kịp `skidChance` = 0,5 |
| T-036 | Màn 1: 3 quán có cửa vào cảnh bên trong (phở, bún đậu, cà phê ông Tám) | Review | Claude | `ShopService.ts`, `ShopScene.ts`, `StreetService.ts`, [story.json](../../src/data/config/story.json), [CHAPTER_PLAN §1.6b](../production/CHAPTER_PLAN.md) | Phòng vẽ chồng lên phố; đồng hồ Hồi 1 dừng trong quán; quầy phở/bún đậu chuyển vào nhà; dời quầy bánh mì sang x=26 |
| T-037 | Màn 1: vật cản thật (cây sấu, ghế nhựa, xe đỗ thành object chặn đường); nhân vật không đi xuyên người (phố và trong quán); đám đông/y tế chỉ đứng chỗ trống | Review | Claude | `RunService.ts`, `ShopService.ts`, `StreetService.ts`, [incident.json](../../src/data/maps/incident.json), `objectTypes.json` | Kiểu mới `sau_tree`, `stools`, `parked_bike` |
| T-038 | Màn 1: gộp thành một màn dạo phố có sự cố (bỏ Hồi 2/3, bỏ trạm chắn giữa phố); chỉ giữ cà phê ông Tám có cửa vào, phở và bún đậu về lại quầy vỉa hè | Review | Claude | [story.json](../../src/data/config/story.json), `RunService.ts`, `StreetService.ts`, [CHAPTER_PLAN §1.2](../production/CHAPTER_PLAN.md) | `strollSec: 0` là một màn; `firstGagMs` 8000; né hết `chaosSec` 120 giây thì tới cú chót. Đo 40 lượt: trung bình ngất ở giây 32, khoảng 10 sự cố một lượt |
| T-039 | Màn 1 cứu hộ: đám đông và nhân viên y tế đi xuyên vật cản (cây, quầy, ô tô) trên đường tới chỗ đứng | Todo | | `StreetService.tickRescue` (vòng "Onlookers and medics walk to their spots") | Hiện chỉ chọn điểm đứng trống (`freeNear`), còn đường đi thì đi thẳng. Cần đi từng bước có kiểm tra `hooks.walkable`, trượt dọc vật cản hoặc đi vòng |
| T-040 | Màn 1 cứu hộ: đông người thì y tế hét "Tránh ra, tránh ra!"; người quay TikTok bị chửi | Todo | | `StreetService.tickRescue`, `story.json` → `street.rescue` | Thêm câu thoại và mốc thời gian, đẩy đám đông lùi ra khi y tế tới |
| T-041 | Màn 1 cứu hộ: xe chạy vào vòng tròn rồi mà hình nhân vật vẫn đứng ở chỗ cũ | Todo | | `WorldScene` (đoạn `heroHidden` → `setAlpha`), `StoryService.view` (`street` chỉ có khi chương còn active) | Nghi: khi `finishDown` đổi chương sang S04 thì `street` thành null nên `heroHidden` về false, nhân vật hiện lại tới lúc chuyển map. Cần giữ ẩn nhân vật cho tới khi rời map |
| T-042 | Màn 1 → Màn 2: kiểm tra hiệu ứng chuyển màn (cánh cổng đóng mở) có chạy và đủ rõ không, sau khi xe vào vòng tròn | Todo | | `WorldScene` (`story:chapterChanged`), `TransitionScene` | Có thể thêm lóe sáng ở vòng tròn trước khi cổng đóng |
| T-043 | Commit toàn bộ thay đổi Màn 1 (chưa commit từ T-024) | Todo | | nhánh `feat/visual-reborn-camera-cafe` | Unit test 258/258 lúc dừng |
## Nhật ký cập nhật
| Ngày | Người | Thay đổi |
|---|---|---|
| 2026-10-27 | Claude (theo yêu cầu) | Tạo task list; ghi T-001…T-017 từ đợt rà UI, sửa chương thầy, nông trại và đẩy PR |
| 2026-10-27 | Claude (theo yêu cầu) | T-011 chuyển sang Done: PR #57 đã merge vào `main` |

| 2026-10-27 | Codex | T-018…T-021: đồng bộ hướng Product Owner, xác định khoảng cách và bước đặc tả kế tiếp; không xác nhận lại kiểm thử lịch sử |

| 2026-10-27 | Codex | T-022: cập nhật tên chính thức và URL repository trong tài liệu |

| 2026-10-27 | Codex | T-023: đồng bộ tên game trong tiêu đề web, debug HUD, npm manifests và mô tả logo; rà toàn bộ 203 tệp văn bản, không còn tên đầy đủ cũ hoặc biến thể viết cách/gạch nối |

| 2026-10-28 | Claude (theo yêu cầu) | T-024…T-030: thêm kế hoạch từng màn, camera framing, các bước làm lại Màn 1 |
| 2026-10-28 | Claude (theo yêu cầu) | T-026: làm Prototype bước 1 Màn 1, chờ duyệt. Ghi chú: e2e `story-incident.spec.ts` đã lỗi thời từ trước (còn tìm `kitten`) |
| 2026-10-28 | Claude (theo yêu cầu) | T-027: làm Prototype bước 2 Màn 1, chờ duyệt |
| 2026-10-28 | Claude (theo yêu cầu) | T-028: làm Prototype bước 3 Màn 1 (luật dính 1 phát), cập nhật CHAPTER_PLAN, chờ duyệt |
| 2026-10-28 | Claude (theo yêu cầu) | T-031: rào chắn hai đầu phố và cảnh bảo vệ, đã thử trong trình duyệt |
| 2026-10-28 | Claude (theo yêu cầu) | T-029: cảnh cứu hộ + vòng tròn ma thuật, cập nhật CHAPTER_PLAN |
| 2026-10-28 | Claude (theo yêu cầu) | T-032: sửa các lỗi gameplay Màn 1 theo ảnh chụp của người dùng |
| 2026-10-28 | Claude (theo yêu cầu) | T-033: kiểm tra toàn bộ Màn 1, thêm 11 bài chơi thử tự động |
| 2026-10-28 | Claude (theo yêu cầu) | T-034: trạm chắn giữa phố |
| 2026-10-28 | Claude (theo yêu cầu) | T-035 xe máy phanh/tông ngẫu nhiên; T-036 plan cửa vào quán chờ duyệt |
| 2026-10-28 | Claude (theo yêu cầu) | T-036 cửa vào quán, T-037 vật cản; unit test 260/260 |
| 2026-10-28 | Claude (theo yêu cầu) | T-038: một màn dạo phố, chỉ còn quán cà phê ông Tám |
| 2026-10-28 | Claude (theo yêu cầu) | T-039…T-043: ghi lỗi còn lại của cảnh cứu hộ để phiên sau làm tiếp |
