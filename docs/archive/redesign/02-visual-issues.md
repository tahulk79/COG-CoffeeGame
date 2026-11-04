# 02 — Visual Audit & Issues (Phase 1.2–1.3)

> **Lưu trữ.** Tài liệu lịch sử, có thể đã lệch code. Không dùng làm đặc tả; xem [docs/README.md](../../README.md) để tìm tài liệu hiện hành.

## Bảng điểm (1–10)

Cột: 1 Identity · 2 Hierarchy · 3 Readability · 4 Consistency · 5 Art · 6 Composition · 7 Mobile · 8 Feedback · 9 Animation · 10 Perf

| Màn | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | TB |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Chọn nhân vật | 6 | 6 | 7 | 6 | 6 | 5 | 6 | 6 | 6 | 9 | **6.3** |
| Intro + phụ đề | 5 | 6 | 7 | 5 | 4 | 4 | 6 | 5 | 5 | 8 | **5.5** |
| Thiên đàng | 4 | 4 | 5 | 5 | 4 | 3 | 4 | 5 | 5 | 6 | **4.5** |
| Nông trại (HUD) | 5 | 4 | 5 | 4 | 6 | 5 | 4 | 6 | 6 | 8 | **5.3** |
| Túi đồ | 6 | 6 | 7 | 5 | 5 | – | 7 | 5 | 4 | 9 | **6.0** |
| Cửa hàng | 4 | 5 | 6 | 4 | 4 | – | 5 | 5 | 4 | 9 | **5.1** |
| Cài đặt | 4 | 6 | 8 | 5 | 4 | – | 7 | 6 | 4 | 9 | **5.9** |
| Quán (HUD) | 4 | 3 | 4 | 4 | 5 | 4 | 2 | 5 | 5 | 8 | **4.4** |
| Nâng cấp quán | 4 | 5 | 7 | 3 | 4 | – | 6 | 5 | 4 | 9 | **5.2** |
| Loading | 5 | 7 | 7 | 6 | 4 | – | 7 | 5 | 5 | 9 | **6.1** |
| HUD farm giữa game | 4 | 3 | 5 | 4 | 6 | 5 | 3 | 6 | 6 | 8 | **5.0** |
| Chợ / Nhân viên / Đơn / Trang trí | 4 | 5 | 6 | 4 | 4 | – | 6 | 5 | 4 | 9 | **5.2** |
| Hồ sơ ứng viên | 4 | 5 | 6 | 4 | 4 | – | 6 | 5 | 4 | 9 | **5.2** |
| Sổ công thức | 4 | 5 | 7 | 4 | 4 | – | 5 | 5 | 4 | 9 | **5.2** |
| Quầy pha chế | 6 | 5 | 7 | 5 | 5 | – | 5 | 6 | 5 | 9 | **5.9** |
| Prompt bài học | 5 | 6 | 7 | 6 | 4 | – | 6 | 5 | 4 | 9 | **5.8** |
| Hội thoại có lựa chọn | 5 | 6 | 8 | 6 | 4 | – | 7 | 6 | 5 | 9 | **6.2** |
| Ending thiên đàng | 6 | 7 | 7 | 6 | 5 | – | 7 | 5 | 4 | 9 | **6.2** |
| Màn lỗi | 3 | 4 | 6 | 5 | 3 | – | 5 | 2 | – | – | **4.0** |

Nhận định chung: nền tảng (token gỗ/giấy, font, khung modal) đã có cảm giác game cozy; điểm thấp đến từ **HUD dày đặc như dashboard**, **emoji làm icon**, **ánh sáng phẳng/bạc màu**, và **landscape chưa được thiết kế**.

---

## P0 — chặn trải nghiệm / che gameplay

### P0-1 · HUD quán che 40–60% màn hình
- File: `features/cafe/ui.js`, `ui/styles/cafe.css`, `features/farm/ui.js` (profile/XP farm vẫn hiện trong quán).
- Gốc: 3 panel trái xếp chồng (profile, bước hướng dẫn, bảng ca 4 dòng) + cột phải 3 nút + thanh dưới 5 nút = 8 nút chính cùng lúc; landscape dùng nguyên bố cục portrait. Ở 844×390 bảng ca đè lên joystick.
- Redesign: HUD 3 vùng — góc trên trái 1 dải trạng thái ca gọn (thời gian · ly · khách · uy tín bằng icon + số), góc trên phải tiền + menu; hành động phụ gom vào 1 nút "Quản lý" mở radial/drawer; bước hướng dẫn chuyển thành marker 3D + coach 1 dòng. Landscape: dải trạng thái nằm ngang trên cùng, nút hành động bên phải.
- AC: ≤ 20% diện tích viewport bị HUD che ở cả 390×844 và 844×390; joystick không bị đè; mọi chức năng cũ vẫn truy cập trong ≤ 2 chạm.

### P0-2 · Toast hướng dẫn đè joystick (farm portrait)
- File: `ui/styles/ui-kit.css` (`.ui-toast`/`.ui-coach`), `farm.css`.
- Gốc: toast cố định đáy giữa, chiều rộng gần full, cùng vùng với joystick (trái dưới) và nút Kho (phải dưới).
- Redesign: coach/toast neo phía trên vùng ngón cái (bottom ≥ joystick + 16px) hoặc dưới quest tracker; tự ẩn sau 4 s.
- AC: không phần tử HUD nào chồng bounding box joystick ở mọi viewport hỗ trợ.

### P0-3 · Nhãn 3D khổng lồ / bị cắt ở thiên đàng
- File: `shared/world/scene.js` (label `CanvasTexture`), `features/heaven/scene.js`.
- Gốc: nhãn "CỔNG TRÙNG SINH" có kích thước world cố định, ở portrait chiếm ~1/8 màn hình và che cổng; nhãn NPC sát mép bị cắt ("ông", "Thần Tiếp"), nhãn Thần Chết lệch ra ngoài.
- Redesign: nhãn chuyển sang nameplate DOM/sprite kích thước màn hình cố định (12–14px), chỉ hiện khi gần hoặc khi là mục tiêu quest; clamp vào safe area với mũi tên chỉ hướng khi ngoài khung.
- AC: không nhãn nào > 40% chiều rộng màn hình; nhãn ngoài khung hiển thị dạng chỉ hướng ở mép, không bị cắt chữ.

### P0-4 · Nhãn 3D trong quán không đọc được ở landscape/desktop
- File: `features/cafe/game.js`, `shared/world/scene.js`.
- Gốc: chữ vẽ vào texture rồi scale theo zoom ortho.
- Redesign: như P0-3 — nameplate kích thước màn hình, icon trạng thái (bong bóng order) thay câu dài.
- AC: chữ nhãn ≥ 11px CSS ở mọi viewport.

### P0-5 · HUD farm giữa game: 9 nút cố định + 4 panel trái
- File: `features/farm/ui.js` (quickNav, management, journal/blockers panel), `farm.css`.
- Gốc: mỗi tính năng mở khóa thêm 1 nút vào thanh dưới (6 nút) + cột phải (3 nút); bên trái chồng profile, quest, "Cần xử lý", "Hoạt động". Ở 390×844 HUD chiếm ~35% diện tích, nhãn 3D bị đè ("phân", "Đang chế biế…").
- Redesign: như P0-1 — dùng chung một khung HUD cho farm và quán: tối đa 4 nút cố định, phần còn lại vào menu "Quản lý"; "Cần xử lý"/"Hoạt động" thành badge số trên một nút.
- AC: giống P0-1, áp ở save cấp 9.

## P1 — giảm mạnh cảm giác "game thực thụ"

### P1-1 · Emoji làm icon production (toàn game)
- File: `index.html`, `features/farm/ui.js`, `features/farm/game.js`, `features/cafe/ui.js`, `ui/settings.js`… (~400 chỗ).
- Gốc: dùng ký tự emoji thay asset; hiển thị khác nhau giữa iOS/Android/Windows, lẫn lộn với icon SVG (₫, xúc xắc).
- Redesign: 1 icon family SVG (stroke + fill 2 tông theo token gỗ/lá) qua sprite `<symbol>`; map tên → icon một chỗ (mở rộng `ui/currency.js` thành `ui/icons.js`).
- AC: 0 emoji trong DOM ở mọi màn (kiểm bằng regex Unicode emoji trên `document.body.innerText`).

### P1-2 · Quest tracker cắt chữ + dài 4 dòng
- File: `farm.css` (.quest-tracker), `features/farm/ui.js`.
- Gốc: tiêu đề + mô tả + CTA trong panel 170px, line-clamp cắt giữa câu.
- Redesign: tracker 1 dòng (icon + tiêu đề + tiến độ), chạm để mở rộng; CTA "Chạm để được dẫn đường" thành nút mũi tên nhỏ.
- AC: trạng thái thu gọn cao ≤ 48px, không ellipsis giữa từ.

### P1-3 · Ánh sáng phẳng, cảnh bạc màu
- File: `shared/world/scene.js:19-22`, `features/intro/scene.js:55-57`, `features/selection/scene.js:24-27`.
- Gốc: hemisphere 2.5–2.8 ≥ directional 2.4 → ambient lấn key light; không fog/màu khí quyển ở farm; ACES làm nhạt thêm.
- Redesign: key:fill ≈ 3:1, màu nắng ấm + bóng lạnh, fog nhẹ theo cảnh, nền trời có gradient; thiên đàng thêm màu nhấn (vàng/xanh ngọc) để tách sàn và đối tượng.
- AC: so ảnh cùng góc trước/sau; histogram độ sáng có dải tối rõ hơn; không giảm FPS ở preset medium.

### P1-4 · Răng cưa và texture vỡ trên mobile
- File: `app/game.js` (antialias tắt khi DPR ≥ 2), `shared/vfx/index.js` (pixelRatio medium 1.25).
- Gốc: không MSAA + pixelRatio thấp hơn DPR thật.
- Redesign: cần đo — thử MSAA 4x ở medium hoặc pixelRatio 1.5; quyết định theo số đo trên thiết bị thật.
- AC: chỉ đổi khi có cặp số FPS trước/sau trên máy mục tiêu.

### P1-5 · Shop như trang thương mại điện tử
- File: `features/farm/ui.js` (render shop), `farm.css`.
- Gốc: card cao ~300px, 2 item/màn, cùng 1 icon mầm cho cả 3 giống, mô tả dài, stepper +/− kiểu form.
- Redesign: lưới slot compact 3–4 cột (icon riêng từng giống, badge giá, khóa cấp), panel chi tiết dưới cùng cho item đang chọn với nút mua số lượng.
- AC: ≥ 6 item thấy cùng lúc ở 390×844; mỗi giống có icon phân biệt.

### P1-6 · Modal farm và quán lệch hệ thống
- File: `features/cafe/ui.js` (`#cafe-dialog`), `cafe.css`, `features/farm/ui.js`.
- Gốc: tab farm kiểu thẻ trên, tab quán kiểu pill vàng; item farm dạng slot, item quán dạng list card với nút "Nâng cấp" không hiện giá; `<dialog>` quán không dùng `.ui-modal`.
- Redesign: một component modal + tab + item-row/slot dùng chung (`ui-kit.css`).
- AC: cùng token, cùng kiểu tab, cùng vị trí giá/nút ở mọi modal.

### P1-7 · Quá nhiều nút cấp 1 + chức năng trùng
- Gốc: "Cài đặt" chiếm 1 ô HUD lớn cạnh "Hướng dẫn"; ở farm vừa có toast gợi ý trên vừa có toast dưới (desktop `05-farm-1440x900`); xu vừa là bộ đếm vừa là nút mở shop (không có affordance).
- Redesign: cài đặt về icon nhỏ góc; 1 kênh coach duy nhất; xu có dấu "+" nếu là nút mở shop.
- AC: tối đa 4 nút hành động cố định trên HUD mỗi cảnh.

### P1-8 · Bố cục landscape chưa thiết kế
- Redesign: quyết định (cần bạn chốt) hỗ trợ landscape đầy đủ hay khóa portrait trên phone. Nếu hỗ trợ: layout riêng cho `orientation: landscape and (max-height: 500px)`.
- AC: theo quyết định; nếu hỗ trợ, HUD ≤ 20% diện tích và nhân vật nằm trong 1/3 giữa khung.

### P1-9 · Tỷ lệ & bố cục cảnh farm/quán
- File: `features/farm/content.js`, `environment.js`, `features/cafe/game.js`; asset ở `docs/assets/registry/ASSET_REGISTRY.md`.
- Redesign: Phase 4 — dày đặc props viền (bụi, bao cà phê, chậu), đường đi có điểm nhấn, chỉnh scale sân phơi; quán thêm bố cục khu (quầy · bàn · cửa) và ánh sáng ấm trong nhà.
- AC: không đổi tọa độ va chạm/luật mua ruộng.

### P1-10 · Quầy pha chế: nút chọn bị đẩy xuống dưới màn hình
- File: `features/cafe/bench.js`, `cafe.css`.
- Gốc: khung hướng dẫn 3 dòng + 4 chip thông số + vùng minh họa cao ~220px nằm trên phần lựa chọn; ở 390×844 nút chọn hạt đầu tiên nằm ở y≈730 (chỉ hở một phần), nút "Gợi ý" ở y≈921 nằm ngoài khung.
- Redesign: vùng minh họa và lựa chọn chung một màn hình không cuộn; hướng dẫn chung thu thành icon "?"; thông số gọn một dòng.
- AC: ở 390×844, lựa chọn của bước hiện tại và nút gợi ý nằm trọn trong viewport, không cần cuộn.

### P1-11 · Icon sai nghĩa và trạng thái trống xử lý kém
- File: `features/cafe/recipes.js`, `features/farm/ui.js`.
- Redesign: icon riêng cho từng món/giống (theo P1-1); trạng thái trống có hình minh họa + 1 câu + nút dẫn tới nơi tạo nội dung; modal co theo nội dung.
- AC: mỗi món/giống/vật tư có icon đúng nghĩa; không modal nào còn > 60% diện tích trống.

### P1-12 · Màn lỗi lộ chuỗi kỹ thuật, không có nút thử lại
- File: `app/game.js` (`fail`), `index.html` (`#error`).
- Gốc: in nguyên `error.message` ("THREE.WebGLRenderer: Error creating WebGL context."), panel lớn, nhiều khoảng trống, không có nút; nút cài đặt vẫn hiện.
- Redesign: panel game có minh họa, câu thân thiện, nút "Tải lại" và "Thử chất lượng thấp"; chi tiết kỹ thuật thu gọn.
- AC: có ít nhất 1 nút hành động; không hiện chuỗi lỗi thô ở trạng thái mặc định.

### P1-13 · Modal mỗi nơi một độ rộng
- Gốc: `#farm-modal[data-kind=…]` tự đặt chiều rộng theo loại.
- Redesign: 3 cỡ chuẩn sm/md/lg (đã có trong `ui-kit.css`) và chỉ dùng 3 cỡ đó.
- AC: mọi modal thuộc 1 trong 3 cỡ.

## P2 — đánh bóng

| # | Vấn đề | Ảnh | File | Hướng sửa |
|---|---|---|---|---|
| P2-1 | Avatar hội thoại là chữ cái "A"/emoji | `02-intro-dialogue-390x844`, `04-heaven-dialogue-1440x900` | `ui/dialogue.js` | Portrait render sẵn từ model (asset-3d) hoặc khung nameplate có màu theo nhân vật |
| P2-2 | Nhân vật Nam trông như trẻ con khi không được chọn | `01-selection-*` | `features/selection/scene.js` | Giữ cùng chiều cao, chỉ đổi ánh sáng/độ mờ để thể hiện focus |
| P2-3 | Nút cài đặt chồng lên/sát meter fps và nút Bỏ qua | `02-intro-*`, `03-heaven-390x844` | `ui/settings.js`, `game.css` | Đưa vào cụm HUD góc phải theo safe area |
| P2-4 | Desktop: chữ HUD 11px, panel tí hon giữa màn 1440 | `05-farm-1440x900`, `03-heaven-1440x900` | CSS token | Thang `clamp()` theo viewport cho HUD |
| P2-5 | Nút đóng modal có vòng focus đôi luôn hiện | `06-*`, `07-*`, `11-*` | `ui-kit.css` | Chỉ hiện `:focus-visible` |
| P2-6 | Ô trống trong túi đồ chiếm nửa modal; nâng cấp kho trộn trong túi | `06-farm-bag-390x844` | `features/farm/ui.js` | Lưới cố định + nâng cấp kho tách tab/nút riêng |
| P2-7 | Settings giống form web; chỉ 3/5 slider âm thanh | `08-settings-390x844` | `ui/settings.js` | Hàng gọn có icon; xác nhận có cố ý ẩn nhạc/môi trường |
| P2-8 | Thiên đàng 29 fps @ desktop high lúc đầu (115 draw) | `03-heaven-1440x900` | — | Đo lại bằng skill perf; có thể do warm-up |
| P2-9 | Loading không có logo/tên game, nền trống | `00-loading-390x844` | `index.html` | Logo COG + minh họa nhẹ, mẹo chơi luân phiên |
| P2-10 | Quest tracker vẫn hiện mục tiêu cũ khi đang nói chuyện | `24-heaven-choices-390x844` | `features/heaven/ui.js` | Ẩn hoặc làm mờ tracker khi hội thoại mở |
| P2-11 | Lựa chọn hội thoại dạng danh sách đánh số kiểu form | `24-*`, `23-*` | `ui/dialogue.js`, `lesson-prompt.js` | Nút lựa chọn dạng thẻ game, có trạng thái nhấn/chọn |
| P2-12 | Hồ sơ ứng viên: tiêu đề thẻ lặp lại nhãn nút ("Thuê nhân viên" + nút giá; "Từ chối" ×2); thanh chỉ số kiểu web | `18-*` | `features/farm/ui.js` | Một nút chính có giá, một nút phụ; thanh chỉ số theo token |
| P2-13 | Quán: khối tạm (khối xanh trên tường, ô trắng trên sàn), sàn trống lớn | `10-cafe-open-1440x900` | `features/cafe/game.js`, asset | Phase 4 — ưu tiên thay khối dễ thấy |
| P2-14 | Bong bóng lời thoại của thợ ở farm có chữ ~5px | `23-farm-lesson-prompt-1440x900` | `features/farm/crew.js` | Dùng nameplate kích thước màn hình như P0-3 |

## Hiệu năng — mốc sơ bộ (Mac, chưa throttle)

| Cảnh | Viewport | FPS | Draw calls | Quality |
|---|---|---|---|---|
| Chọn NV | 390×844 | 60 | 9 | medium |
| Intro | 390×844 / 844×390 | 60 | 89 / 60 | medium |
| Thiên đàng | 390×844 / 1440×900 | 52–60 / 29→60 | 98 / 106–115 | medium / high |
| Farm | 390×844 / 844×390 / 1440×900 | 60 | 119–123 / 157 / 152 | medium / high |
| Quán | 390×844 / 844×390 | 60 | 80–87 / 115 | medium |

Asset: 42 GLB = ~31 MB, không nén hình học, không KTX2 (chi tiết `01-project-audit.md` §5). Budget chính thức sẽ đặt sau khi đo trên thiết bị thật.
