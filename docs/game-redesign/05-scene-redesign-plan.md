# 05 — Scene Redesign Plan (Phase 3–4)

Dựa trên `02` (lỗi), `03` (art direction "Phố Nắng Cà Phê"), `04` (design system). Landscape đã chốt: hỗ trợ bằng layout gọn.

**Ràng buộc chung**
- Không đổi luật chơi, kinh tế, save, camera, điều khiển.
- Không đổi tọa độ vùng cản/va chạm. Asset mới đi qua `dressSlot`.
- Meshy chỉ còn khoảng 60 credit (theo `docs/3d-redesign/PROGRESS.md`): ưu tiên sửa model có sẵn và dựng thủ tục trong Blender. Mỗi job Meshy cần spec ở mục 9 và được bạn duyệt.

## Phần chung cho mọi cảnh

### C1 · Nhãn 3D (P0-3, P0-4, P2-14)
- Hiện trạng: `label()` trong `shared/world/scene.js:42`, cùng các sprite tương tự ở `cafe/game.js:373`, `farm/activity.js`, `farm/decoration-builder.js`. Sprite `CanvasTexture` có kích thước theo world.
- Cách làm (ít code nhất):
  1. Vẽ lại canvas theo kiểu nameplate của `04` (nền tối `--ui-nameplate-bg`, chữ sáng, cao 48px @2x).
  2. Camera phối cảnh (thiên đàng): `SpriteMaterial.sizeAttenuation = false` để nhãn có kích thước màn hình cố định.
  3. Camera trực giao (farm/quán): trong `update`, nhân scale nhãn với `1/camera.zoom` (hoặc theo frustum) để nhãn giữ cỡ màn hình khi zoom.
  4. Chỉ hiện khi trong bán kính hoặc là mục tiêu quest. Mục tiêu nằm ngoài khung thì có một mũi tên DOM ở mép màn hình.
- AC: nhãn cao 11–14px CSS ở cả 3 viewport; không nhãn nào rộng quá 40% màn hình; không cắt chữ ở mép.

### C2 · Ánh sáng (P1-3)
- File: `shared/world/scene.js:19-22`, `features/selection/scene.js:24-27`, `features/intro/scene.js:55-57`, cùng `toneMappingExposure` trong `app/game.js`.
- Áp tham số bảng `03` §4 cho từng cảnh. Farm/quán phân biệt qua cờ `farming` sẵn có, hoặc thêm tham số `lighting` vào `createAdventureScene`.
- AC: chụp lại cùng góc với ảnh before; có vùng bóng rõ dưới cây/mái/quầy; FPS ở preset medium giảm ≤ 5%.

### C3 · Khử răng cưa (P1-4)
- Đo trước bằng skill `threejs-h5-performance-engineer`. Sau đó thử từng phương án: MSAA ở medium, hoặc pixelRatio medium 1.25 → 1.5.
- Chỉ chốt khi có cặp số đo trước/sau. Nếu GPU điện thoại không chịu nổi thì giữ nguyên và ghi lại.

### C4 · Khung HUD chung (P0-1, P0-2, P0-5, P1-7)
- Dựng theo `04` §6 dưới dạng một khối CSS grid cố định 4 góc, dùng chung cho farm và quán.
- Giữ nguyên id DOM mà gameplay đang tìm (`farm-coins`, `farm-objective`, `farm-bag-toggle`, các `data-shortcut`…): chỉ di chuyển phần tử và đổi class.
- Thêm nút "Quản lý" mở ngăn kéo. Các nút `management` và `quickNav` trong `features/farm/ui.js` và `cafe-main-nav` trong `features/cafe/ui.js` chuyển vào ngăn kéo. Logic mở khóa (`HUD_UNLOCKS`, badge "Mới") giữ nguyên.
- Landscape gọn: `@media (orientation:landscape) and (max-height:500px)`.

## 1. Loading & màn lỗi

| Hạng mục | Thay đổi | File |
|---|---|---|
| Loading (P2-9) | Thêm logo chữ COG (SVG inline) phía trên ly phin; một dòng mẹo chơi lấy từ mảng tĩnh; giữ thanh tiến độ | `index.html` |
| Lỗi (P1-12) | Panel `--md` có minh họa ly đổ; nút "Tải lại" (`location.reload`) và "Thử đồ họa thấp" (lưu quality `low` qua `saveSettings` rồi tải lại); thông báo lỗi kỹ thuật cho vào `<details>`; ẩn nút cài đặt | `app/game.js` `fail()`, `index.html` |

## 2. Chọn nhân vật

- **UI:** card dưới đã đạt; chỉ thay chuỗi "Vào game →" bằng icon và áp token chữ mới.
- **3D:** NV không được chọn làm tối và hạ saturation thay vì thu nhỏ (P2-2). Phần scale nằm trong `features/selection/scene.js` (`character.scale`, `focus`). Đây là trình bày, không phải gameplay; giữ nguyên swipe/tap.
- **Landscape:** chỉnh `camera` theo aspect để nhân vật nằm giữa 1/3 khung (hiện bị dồn lên mép trên). Đây là framing theo tỉ lệ khung, không đổi góc camera.
- **Ánh sáng:** theo C2.

## 3. Intro (Màn 1)

- **Hội thoại:** avatar thay chữ cái bằng portrait (P2-1). Portrait là PNG render từ model người chơi/NPC, giao `asset-3d`, mỗi ảnh 128px. Chưa có thì dùng khung màu kèm icon vai trò.
- **Landscape:** hội thoại cao ≤ 30%, chữ một cột rộng tối đa 680px.
- **Nút:** gom "Bỏ qua" và cài đặt vào cụm góc phải để không đè lên nhau (P2-3).
- **3D:** mây khối xám đoạn lên trời đổi sang sprite mây mềm có sẵn (`cloudTexture` trong `intro/scene.js:262`) và sky gradient. Áp C2.

## 4. Thiên đàng

- C1 là ưu tiên số 1: nhãn "CỔNG TRÙNG SINH" và nhãn NPC.
- Màu nhấn ngọc/vàng cho lối đi và bệ thần, qua vật liệu `heaven/plaza.glb` hoặc màu đỉnh. Sàn bớt trắng.
- Quest tracker thu gọn, ẩn khi đang hội thoại (P2-10).
- Hồ sơ dấu chứng nhận (`#heaven-passport`) chuyển thành `.ui-modal--sm`.
- Thẻ lựa chọn hội thoại dùng `.ui-choice` (P2-11).
- Ending modal: giữ bố cục, đổi icon ✓ thành SVG.

## 5. Nông trại

**UI**
- C4 (HUD chung). Quest tracker 1 dòng (P1-2).
- "Cần xử lý" và "Hoạt động" chuyển thành badge kèm panel trong ngăn kéo.
- Coach và toast không chồng lên joystick.

**Modal**
| Modal | Hướng làm | Lỗi |
|---|---|---|
| Túi đồ | `.ui-grid` + `.ui-slot` + `.ui-detail`; nâng cấp kho tách ra nút riêng ở đầu modal | P2-6 |
| Cửa hàng | Lưới 4 cột với icon riêng từng giống; panel chi tiết có stepper và nút giá | P1-5 |
| Chợ | Trạng thái trống đúng chuẩn; modal co theo nội dung | P1-11, P1-13 |
| Nâng cấp, nhân viên, đơn hàng, trang trí | Dùng `.ui-row`/`.ui-slot`; chỉ 3 cỡ modal | P1-13 |
| Hồ sơ ứng viên | 1 nút chính có giá + 1 nút phụ; thanh chỉ số theo token | P2-12 |
| Prompt "Ôn lại" | `.ui-choice` | P2-11 |

**3D**
- Áp C2.
- Sửa scale sân phơi (`farm/dryer-tier-1.glb`) theo quy tắc ≤ 2,2× chiều cao người. Chỉ đổi scale lúc gắn model; vùng cản giữ nguyên.
- Thêm props viền khu lát trống: bao cà phê, chậu, bụi thấp. Dựng thủ tục bằng `cog_proc.py`, không chặn đường đi.
- Ô đất được chọn: viền `--ui-marker` (đã có sáng viền theo AGENTS.md; chỉ đổi màu theo token).

## 6. Quán

**UI**
- C4. Bảng ca 4 dòng chuyển thành một dải icon và số.
- Profile/XP của farm ẩn khi đang trong quán, chỉ giữ cấp ở avatar.
- `#cafe-dialog` chuyển sang `.ui-modal` cùng kiểu tab của farm (P1-6).
- Quầy pha (P1-10): vùng minh họa và lựa chọn nằm trọn một màn hình không phải cuộn; hướng dẫn chung thu vào nút "?".
- Sổ công thức: lưới thẻ nhỏ 2 cột, icon đúng món (P1-11).

**3D**
- Áp C2: nắng qua cửa sổ, đèn treo emissive.
- Thay khối tạm dễ thấy (P2-13): khối xanh trên tường thành chậu cây treo/khung tranh; ô trắng trên sàn (chỗ bàn chưa mở) thành đế gỗ có dấu "+".
- Điểm nhấn văn hóa: một mảng tường vôi vàng hoặc gạch bông.

## 7. Settings

- Hàng gọn kèm icon thay emoji.
- Kiểm `ui/settings.js` vì sao chỉ hiện 3/5 slider (bus nhạc, môi trường). Nếu là cố ý thì giữ; nếu thiếu thì hỏi bạn trước khi thêm.

## 8. Feedback, VFX, animation (Phase 5 mục 10)

- Dùng `shared/vfx` có sẵn: chip bay khi thu hoạch hoặc nhận xu (`vfx-chip`), counter nảy (`.ui-counter`), viền sáng đối tượng khi tới gần (outline đã có ở preset high; medium dùng marker).
- Bổ sung chụp các trạng thái còn thiếu: toast sự cố nhân viên, sự cố trong quán, hiệu ứng thu hoạch.
- Hook âm thanh: theo `04` §8.

## 9. Asset cần làm (đề xuất, chờ duyệt từng mục)

| # | Asset | Lý do | Cách | Ngân sách |
|---|---|---|---|---|
| A1 | Portrait 2 NV chính + 5 NPC (PNG 128) | P2-1 | Render từ GLB có sẵn trong Blender | 0 credit |
| A2 | Icon item (giống, hạt, món, vật tư) ~25 ảnh, atlas WebP | P1-1, P1-11 | Render model hoặc dựng thủ tục | 0 credit |
| A3 | Bộ icon hệ thống SVG ~45 | P1-1 | Vẽ tay SVG theo spec `04` §4 | 0 credit |
| A4 | Props viền farm (bao cà phê, chậu, bụi) | P1-9 | `cog_proc.py` | 0 credit |
| A5 | Chậu cây treo / khung tranh / đế bàn khóa của quán | P2-13 | Thủ tục | 0 credit |
| A6 | (Tùy chọn) Sân phơi tier-1 mới nếu chỉnh scale vẫn xấu | P1-9 | Meshy text-to-3D | 30 credit, cần duyệt |

Mỗi asset: spec → tạo → kiểm hình học/poly → xuất GLB/WebP → tích hợp → ảnh trước/sau.

## 10. Thứ tự và rủi ro

Thứ tự triển khai nằm trong `06-implementation-checklist.md`.

**Rủi ro lớn nhất:** C4 (HUD chung) đụng vào `features/farm/ui.js` (672 dòng) và `features/cafe/ui.js`. Code gameplay tìm phần tử theo id/`data-shortcut`, nên di chuyển DOM có thể làm hỏng tham chiếu.

**Giảm rủi ro:**
- Giữ nguyên id.
- Sau mỗi bước chạy `tests/*.test.js` (khi bạn cho phép) và chơi thử luồng chính: hái → phơi → rang → giao → mở quán → pha → phục vụ.
