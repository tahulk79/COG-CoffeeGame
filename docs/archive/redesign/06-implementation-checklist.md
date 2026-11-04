# 06 — Implementation Checklist (Phase 5)

> **Lưu trữ.** Tài liệu lịch sử, có thể đã lệch code. Không dùng làm đặc tả; xem [docs/README.md](../../README.md) để tìm tài liệu hiện hành.

Mỗi bước gồm: sửa source → chơi thử luồng chính → ghi số liệu FPS/draw (`?fps`).

Ký hiệu: ☐ chưa làm · ◐ đang làm · ☑ xong và đã kiểm · ⚠ còn lỗi.

## Bước 1 — Token & nền UI ☑
- ☑ Thêm token màu mới, chữ, khoảng cách, bo góc, z-index, animation vào `src/ui/styles/game.css` (`04` §1.2, §2, §3, §7)
- ☑ Bỏ Fredoka khỏi `index.html` và `--game-font`
- ☑ AC: giao diện chưa đổi; không có lỗi console mới

## Bước 2 — Icon & component dùng chung ◐
- ☑ `src/ui/icons.js`: 85 icon SVG, sprite chèn lúc khởi động. Emoji trong DOM tự đổi sang icon bằng MutationObserver (cùng cách với `ui/currency.js`) nên **không phải sửa chuỗi gameplay**. `fillRich()` dùng cho canvas, biến CSS `--i-<tên>` dùng cho pseudo-element
- ☑ Emoji trong canvas 3D: nhãn, badge luống/trạm (`shared/world/scene.js`), bong bóng khách (`cafe/game.js`)
- ☑ Emoji trong pseudo-element: tiêu đề modal farm (`farm/ui.js`, bỏ `::before` trong `farm.css`), dải "Hôm nay" (`farm.css`)
- ☑ Nhãn 3D (C1):
  - Thiên đàng: nhãn nền tối, giữ cỡ cố định trên màn hình, co theo độ dài chữ
  - Farm/quán: bù theo số px mỗi đơn vị (×0,85–1,8)
  - Badge luống giữ cỡ cũ vì các luống đặt sát nhau
- ☐ Mũi tên chỉ hướng cho nhãn ngoài khung hình (C1 bước 4): dời sang Bước 3, làm cùng khung HUD
- ☐ Bong bóng khách quán (`cafe/game.js` makeNpc) chưa bù cỡ khi xoay ngang
- ☐ Component `ui-slot`, `ui-grid`, `ui-detail`, `ui-counter`, `ui-progress`, `ui-quest`, `ui-choice`: viết khi dùng tới ở Bước 3–4 để tránh CSS chết
- ◐ AC emoji: 0 emoji trên farm (HUD + 7 modal), quán (HUD + 5 modal), thiên đàng; 0 emoji trong pseudo-element. Chưa quét: intro, chọn nhân vật, hội thoại có lựa chọn, settings, quầy pha

## Bước 3 — HUD & điều hướng ◐
- ☑ Ngăn kéo "Quản lý" dùng chung (`src/ui/hud-drawer.js`) + `src/ui/styles/hud.css` (nạp cuối, đè luật vị trí cũ)
  - Farm: thanh dưới gồm Kho · Cửa hàng · Vào quán · Quản lý. Trong ngăn kéo: "Hôm nay", "Cần xử lý", "Hoạt động", Nâng cấp, Nhân viên, Đơn hàng, Xây dựng, Hướng dẫn, Cài đặt. Cột nút bên phải bỏ hẳn
  - Quán: thanh dưới gồm Mở/Đóng cửa · Kho · Nông trại · Quản lý. Trong ngăn kéo: Nâng cấp, Nhân viên, Đơn farm, Công thức, Cài đặt
  - Badge trên "Quản lý": số mục "Cần xử lý", hoặc "Mới" khi có nút vừa mở khóa chưa dùng
  - Ngăn kéo đóng khi chọn một nút, chạm ra ngoài hoặc bấm Esc
- ☑ Thẻ nhiệm vụ: mỗi dòng cắt bằng dấu "…", không xuống dòng. Dòng "Chạm để được dẫn đường" giữ nguyên (theo onboarding-flow §3.5)
- ☑ Quán: dải trạng thái ca 2 hàng chữ ngắn (chú thích đầy đủ trong tooltip); ẩn profile farm
- ☑ Landscape: thanh nút thành cột bên phải, ngăn kéo mở bên cạnh. Desktop ≥1200×760: HUD `zoom:1.15`
- ☑ Nhãn thiên đàng bị cắt ở mép thì ẩn (thay cho mũi tên chỉ hướng)
- ☐ Mũi tên chỉ hướng cho mục tiêu nhiệm vụ nằm ngoài khung hình: chưa làm
- ☐ Nút cài đặt + "Bỏ qua" ở intro/thiên đàng: không chồng nhau (chỗ chồng trước đây là meter `?fps` chỉ dùng khi debug), nên chưa sửa
- ◐ AC diện tích HUD (đo bằng bounding box, **có tính cả joystick**):

  | Màn | Trước | Sau |
  |---|---|---|
  | Farm 390×844, cấp 9 | ~35% | 17% (mở ngăn kéo 19%) |
  | Farm 844×390 | ~45% | 20% |
  | Quán 390×844 | ~40% | 22% (~18,5% nếu không tính joystick) |
  | Quán 844×390 | ~60% | 21% (~18% nếu không tính joystick) |

  Không phần nào chồng lên joystick. Mọi chức năng mở được trong ≤ 2 chạm. Đã chạy thử: vào quán → mở cửa → mở modal từ ngăn kéo → về nông trại. Mới kiểm save cấp 9, chưa kiểm save cấp 1

## Bước 4 — Kho, shop, modal ◐
CSS mới ở `src/ui/styles/menus.css` (nạp cuối).
- ☑ Túi đồ: lưới ô và panel chi tiết vốn đã có; dòng nâng cấp kho gọn lại (bỏ câu mô tả), ô trống thấp hơn
- ◐ Cửa hàng: **hàng gọn thay cho thẻ cao 300px** (icon 52 · tên + "Trong kho" · mô tả 1 dòng · bước số lượng + nút giá, cao 110px). Mỗi giống có icon cây riêng (`seed-robusta/arabica/liberica` trong `icons.js`). Không làm kiểu "lưới 4 cột + panel chi tiết" vì phải viết lại luồng mua; nếu cần sẽ làm sau
- ☑ Tab Chợ, Vật tư: cùng kiểu hàng
- ☑ Hồ sơ ứng viên: nút ghi rõ "Thuê · 150 xu" / "Từ chối", bỏ tiêu đề thẻ trùng lặp (đổi badge trong `farm/game.js`)
- ☑ Chỉ còn 3 cỡ modal: farm 360/560/740 theo loại; `#cafe-dialog` 740
- ☑ Tab của modal quán dùng chung kiểu tab với farm (bỏ kiểu viên vàng riêng trong `cafe.css`)
- ☑ Dọn CSS chết của `#cafe-quick-nav`; chấm đỏ "Mở cửa" chuyển sang thanh dưới
- ☐ Hàng trong modal quán (nâng cấp bàn…) vẫn là thẻ cao, nút "Nâng cấp" chưa hiện giá
- ☐ Nâng cấp / nhân viên / đơn hàng / trang trí của farm: chỉ đổi cỡ modal, chưa đổi bố cục bên trong
- ☐ Chưa chuyển `#cafe-dialog` sang cấu trúc `.ui-modal`, mới chỉnh cho giống về mặt nhìn
- ◐ AC: shop thấy ~4,7 hàng trong khung 390×844 (trước ~2; mục tiêu là 6). Mua thử 2 cây vối: xu 20.000 → 19.980, kho 6 → 8, đúng giá 10 xu/cây. Chưa thử bán; chưa chạy `tests/`

## Bước 5 — Chọn nhân vật & hội thoại
- ☑ Màn chọn nhân vật: nhân vật không được chọn giữ cỡ ×0,92 (trước ×0,68, trông như trẻ con) và tối đi bằng màu vật liệu (×0,55). Khi vào game trả lại màu gốc. Điện thoại xoay ngang: dời nhân vật sang trái nhường chỗ cho thẻ, không đẩy lên (`features/selection/scene.js`)
- ◐ Avatar hội thoại: dùng phương án dự phòng — icon trong vòng màu nhận diện của người nói (`setAvatar` trong `ui/dialogue.js`, dùng ở intro, thiên đàng, prompt ôn bài). Thêm icon `medic`. Chưa có portrait render từ model (asset A1)
- ☑ Lựa chọn hội thoại thành thẻ game: số trong vòng tròn, có độ nổi, nhấn lún xuống; lựa chọn mặc định viền vàng. Áp dụng chung cho thiên đàng và prompt "Ôn lại" (`dialogue.css`)
- ☑ Thẻ nhiệm vụ mờ đi khi có hội thoại, hiện lại khi hội thoại đóng
- ◐ AC: bấm một lựa chọn ở thiên đàng → hội thoại chạy tiếp và nhiệm vụ đổi đúng ("Ba dấu để trở về"); avatar intro đúng vai (người kể chuyện, người chơi, y tế). Chưa chạy `tests/heaven-gameplay.test.js`; chưa thử nhánh trả lời sai

## Bước 6 — Cảnh nông trại ◐
- ☑ Ánh sáng riêng cho farm: `createAdventureScene` có thêm tùy chọn `lighting` (mặc định giữ đèn cũ nên thiên đàng và quán không đổi). Farm dùng `FARM_LIGHT`: đèn môi trường 2,8 → 1,1, nắng 2,4 → 4,2 màu ấm `#ffe2b0`, trời xanh nhạt. Bóng người chơi, rào, cây giờ đã rõ. 60 fps · 123 draw, không đổi (Mac, chưa giả lập điện thoại)
- ☑ Sân phơi: giữ nguyên. Đo lại thì cao ~1,6 lần người chơi, trong giới hạn ≤ 2,2 lần; đổi tỉ lệ sẽ đổi luôn vùng cản
- ☑ Dòng gợi ý điều khiển ở farm/quán không còn đè joystick (nằm trên joystick; màn ngang thì lên giữa phía trên). Lỗi này còn sót từ Bước 3, phát hiện khi chạy save cấp 1
- ☐ Props viền khu lát trống: chưa làm. Cần asset A4 dựng bằng Blender, và cần xác định chỗ đặt để không chặn đường hay chỗ mở ruộng sau này
- ◐ AC: vùng cản không đổi vì không động tới model hay tọa độ; chỉ đổi đèn. Chưa đo trên điện thoại thật

## Bước 7 — Cảnh quán ◐
- ☑ Ánh sáng riêng cho quán: `CAFE_LIGHT` trong `cafe/game.js` (đèn môi trường 2,8 → 1,5 ánh vàng ấm, nắng 3,2, nền be). Bàn ghế và người có bóng đổ rõ. 60 fps · 104 draw, không tăng
- ☑ Quầy pha: trên điện thoại, các lựa chọn nằm ngay dưới hình minh họa; thẻ giải thích chuyển xuống dưới; hình minh họa 224 → 124px; thông số thành một hàng vuốt ngang. Ở 390×844 cả 3 lựa chọn và nút "Gợi ý" nằm trọn trong khung, kể cả khi có dòng hướng dẫn đầu (trước: lựa chọn đầu ở y≈730, nút gợi ý y≈921). Bấm thử: bước 1 → bước 2 đúng
- ☑ Sổ công thức và danh sách order: 2 cột trên điện thoại (trước 1 cột), thấy ~9 món cùng lúc
- ☐ Thay khối tạm (khối xanh trên đỉnh tường, ô trắng chỗ bàn chưa mở): chưa làm, cần asset A5 dựng trong Blender
- ☐ Mảng tường nhấn văn hóa: chưa làm (cần asset)
- ◐ AC: `?debug=grid` báo "không có lỗi · 147 đường · 136 điểm". Chưa chơi trọn một ca phục vụ

## Bước 8 — Thiên đàng, intro, loading, lỗi, settings ◐
- ◐ Thiên đàng: có ánh sáng riêng (`HEAVEN_LIGHT` trong `heaven/scene.js`), nắng vàng ấm, bớt đèn môi trường, nền kem; sương cùng màu nền (trước sương xám xanh cố định). Sàn bớt trắng, bóng rõ hơn một chút. **Chưa có màu nhấn ngọc trên lối đi/bệ thần**, vì phải sửa vật liệu của `heaven/plaza.glb` trong Blender
- ☐ Mây intro: chưa làm. Mây xám là khối trong `intro/street.glb#heaven_path`, cần asset
- ☑ Loading: logo chữ "Godbean" + "Chuyện một quán cà phê"; một mẹo chơi ngẫu nhiên mỗi lần tải cảnh (5 mẹo, lấy từ luật thật của game, trong `app/game.js`)
- ☑ Màn lỗi: tiêu đề + câu thân thiện, nút "Tải lại" và "Thử đồ họa thấp" (lưu `quality: low` rồi tải lại — đã thử, lưu đúng); lỗi kỹ thuật thu vào "Chi tiết kỹ thuật"; ẩn nút cài đặt khi đang lỗi
- ☑ Cài đặt: mỗi âm lượng một dòng (nhãn · thanh · %), cao 50px thay vì ~90px. Thanh Nhạc/Môi trường bị ẩn là **cố ý**: `settings.js` chỉ hiện khi đã có file nhạc/âm nền

## Bước 9 — Ánh sáng & vật liệu (rà toàn game) ◐
- ☑ Rà 42 GLB (đọc thẳng JSON trong file). Vấn đề thật duy nhất: 5 model Meshy (`male`, `girl`, `heaven/reaper`, `heaven/brewing`, `heaven/growing`) có map kim loại kèm `metallic = 1` trên vải và da. Cảnh không có env map nên phần đó thành kim loại tối, lấm tấm. Sửa một lần lúc tải: `matteBakedMetal()` trong `shared/three/models.js` (dùng cho `loadModel` và `characters/load-player.js`). Không sửa file GLB
- ☑ Giữ nguyên các vật liệu bóng có chủ ý: sơn mài .45, vàng/inox .40 (metal .15), gốm .30, kính .10, nước .15, máy espresso .50
- ◐ Kết quả: da và vải nhân vật sáng, sạch hơn trước; khác biệt nhẹ vì vẫn còn vệt bake trong texture
- ☐ Đồng bộ khối thủ tục với model có texture: chưa làm. Khối thủ tục đã nhám (roughness .85); thêm noise/màu đỉnh 2 tông là việc của asset

## Bước 10 — Feedback, VFX, âm thanh ◐
- ☑ Số xu nảy nhẹ khi đổi, chữ thoáng xanh khi tăng và đỏ khi giảm (`showCoins` trong `farm/ui.js`, dùng cho cả quán). Lần vẽ đầu không nảy; tắt khi bật giảm chuyển động. Đã thấy chạy khi thu hoạch (350 → 360, `data-trend="up"`)
- ☑ Chip bay về ô xu/kho khi thu hoạch: đã có sẵn trong `shared/vfx`, chỉ kiểm lại
- ☑ Âm thanh: `ui.buy` và `ui.deny` đã có và đã được dùng. Ba âm còn thiếu dùng lại âm sẵn có, không cần âm mới: trả lời đúng/sai ở thiên đàng và ôn bài → `bench.good`/`bench.bad`; toast mở khóa ở farm → `reward.quest`
- ☑ Đồng xu 🪙 trong nhãn vẽ trên canvas (ví dụ giá ruộng khóa) giờ cũng là icon
- ☐ Marker tương tác riêng theo loại đối tượng: chưa làm

## Bước 11 — Mobile polish ◐
Quét bằng script trên trình duyệt ở 390×844 và 844×390: farm (HUD, ngăn kéo, 6 modal), quán (HUD, ngăn kéo, 6 modal), thiên đàng, màn chọn nhân vật.
- ☑ Vùng chạm ≥ 44px. Đã sửa: ô xu (40 → 44), tiêu đề "Cần xử lý"/"Hoạt động" trong ngăn kéo (32 → 44), nút hành động trong "Cần xử lý" (28 → 44), nút nâng cấp kho (35 → 44), thẻ nhiệm vụ khi xoay ngang (42 → 44), nút xúc xắc đặt tên (giữ hình 38px, vùng chạm 46px qua `::before`). Quét lại: 0 lỗi. Công tắc 48×28 vốn đã có vùng chạm 44px qua `::before`
- ☑ Không tràn chữ: 0 phần tử tràn ở mọi màn đã quét
- ◐ Safe area: CSS mới đều dùng `env(safe-area-inset-*)`. Thêm lề trái/phải cho cụm HUD trái khi xoay ngang. **Chưa thử trên máy có tai thỏ thật** (DevTools không giả lập được safe area)

## Bước 12 — Hiệu năng ◐
- ☑ Đo 4 cảnh (CPU ×4, iPhone DPR 3) → 60 fps ở mọi cảnh, draw 9–119, 0 long task
- ☑ Rò bộ nhớ: 10 lần chuyển farm ↔ quán, số object Three.js không đổi, heap sau GC chỉ +0,38 MB
- ☐ Khử răng cưa (C3): chưa đổi. Cần GPU điện thoại thật để đo
- ☐ Nén GLB: **tải mỗi cảnh 6,5–11,5 MB, vượt ngân sách 5 MB**. Cần `ok` để thêm glTF Transform + `MeshoptDecoder`
- ☑ AC: draw call và FPS không xấu hơn trước redesign (so bằng bộ đếm `?fps`); heap ổn định

## Quality gate cuối (Phase 6–7)
- ☑ Không tràn chữ, không nút chồng nhau, không modal vượt viewport, không icon sai kiểu
- ☑ Không thay đổi logic gameplay (không sửa `model.js`, `rules.js`, `progress.js`, `content.js`, `journey.js`, `service.js`)
- ☑ 0 lỗi console mới; heap ổn định sau 10 lần chuyển cảnh

## Nhật ký

| Ngày | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-11-03 | Phase 1–2 | ☑ | Audit, art direction A, design system, landscape gọn |
| 2026-11-03 | Bước 1–2 | ◐ | Không có lỗi console mới; cảnh báo đã có từ trước: thiếu `public/models/cafe/robots.glb` |
