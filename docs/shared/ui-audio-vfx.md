# Lượt 1: nền tảng cảm giác chơi

Phạm vi: bộ UI dùng chung, engine âm thanh, thư viện VFX, cài đặt người chơi, gắn phản hồi vào các thao tác chính đang có. **Không đổi luật chơi, giá, thời gian hay kinh tế.** Mọi phản hồi chỉ đọc kết quả `farm.act(...)` hoặc sự kiện có sẵn, không gọi thêm `act`.

Trụ cột phục vụ: (1) Cuốn ngay: thao tác nào cũng có hình và tiếng ngay lúc trạng thái đổi, tiền và hàng bay về HUD. (4) Học thật ở quầy pha: tiếng rót/hơi/đánh bọt đổi theo số đo, có tiếng báo vào vạch chuẩn. Pha theo trí nhớ thì tắt mọi gợi ý bằng tiếng.

Hợp đồng dữ liệu: [contracts](contracts.md).

---

## 1. Bộ UI dùng chung

### 1.1 Biến (thêm vào `:root` trong `src/ui/styles/game.css`)

Giữ các biến `--ui-*` hiện có. Thêm biến cho những màu đang viết thẳng nhiều lần:

| Biến | Giá trị gợi ý | Thay cho |
|---|---|---|
| `--ui-line` | `#dfd0ad` | đường kẻ dòng trong modal (`#e0d2b3`, `#dcc49a`, `#dfd0ad`…) |
| `--ui-muted` | `#927c55` | chữ phụ `small` (`#97815e`, `#8b7758`, `#927c55`) |
| `--ui-good` / `--ui-good-bg` | `#5f8a3c` / `#eef5dc` | trạng thái đạt, công tắc bật (`#a5c57a`, `#9cb975`) |
| `--ui-bad` / `--ui-bad-bg` | `#b5523a` / `#fbe6dc` | lỗi, thiếu, nút xoá |
| `--ui-warn` / `--ui-warn-bg` | `#a8742a` / `#fff1d0` | cảnh báo kho, hạn |
| `--ui-off` | `#d6cbb1` | công tắc tắt, nút bị khoá |
| `--ui-toast-bg` | `#fff7dfd9` | `#farm-notice`, `#heaven-toast` |

### 1.2 Danh mục class (file mới `src/ui/styles/ui-kit.css`, `@import` đầu tiên trong game.css)

| Nhóm | Class | Ghi chú |
|---|---|---|
| Nút | `.ui-btn` + `--go` (xanh, thao tác chính), `--gold` (mua, xu, giữ để rót), `--plain` (kem, phụ/hủy), `--link` (chữ), `--icon` (tròn chỉ có icon) · cỡ `--sm`, `--lg` | `:disabled` và `[aria-disabled=true]`: màu `--ui-off`, `cursor:not-allowed`, không có `:active`. Đổi `button:disabled{cursor:wait}` chung thành `not-allowed`; chỉ `[aria-busy=true]` mới dùng `wait`. |
| Đóng | `.ui-close` | Nút tròn đặt ngoài góc trên phải, màu `--ui-close` |
| Nút HUD | `.ui-hud-btn` | Ô gỗ, icon trên, nhãn `small` dưới (menu farm/quán) |
| Modal | `.ui-modal` (nền mờ, khung) · `.ui-modal__window` · `__head` (biển tiêu đề xanh ở giữa mép trên) · `__title` · `__subtitle` · `__body` (cuộn bên trong) · `__foot` · cỡ `--sm` (360), `--md` (560), `--lg` (740) | Dùng cho cả `<section role=dialog>` và `<dialog>` gốc |
| Tab | `.ui-tabs` (role=tablist) · `.ui-tab` | Tab đang chọn dùng `[aria-selected=true]` hoặc `[aria-pressed=true]`. Thêm `.ui-tabs--segmented` cho nút chọn 2–3 lựa chọn |
| Báo trong khung | `.ui-alert` + `--info`, `--good`, `--warn`, `--bad` | Đặt trong modal/panel, không tự mất |
| Toast | `.ui-toast` | Ở giữa phía trên, tự mất sau 3 s (luật guide §8). Tông xấu là `[data-success=false]`, thuộc tính farm đang dùng nên không phải sửa JS |
| Panel | `.ui-panel` (giấy HUD), `.ui-panel--card` (thẻ lớn) | |
| Box | `.ui-box` (ô kem trong modal) · `.ui-box--empty` · `.ui-row` (icon, chữ, nút bên phải) | |
| Badge | `.ui-badge` (số đếm) · `--dot` (chấm báo) · `--level` · `.ui-chip` (nhãn nhỏ) | |
| Điều khiển | `.ui-switch` (role=switch) · `.ui-slider` (`input[type=range]`) | `.ui-slider` là class mới, dùng cho âm lượng |

**Cách chuyển trong lượt này:** ở mỗi rule trong `ui-kit.css`, liệt kê kèm selector cũ làm bí danh, ví dụ `.ui-btn--go, .primary, .farm-item-action, .cafe-primary {…}`. Nhờ vậy **không phải đổi class trong JS farm/quán**. Sau đó xoá các khai báo màu, viền, bóng trùng lặp ở farm.css/cafe.css và thay màu viết thẳng bằng biến. Code mới viết thì dùng thẳng `ui-*`.

### 1.3 Bảng chuyển class cũ sang class mới

| Cũ (file) | Mới |
|---|---|
| `.primary` (#enter-game, index.html) | `.ui-btn ui-btn--go ui-btn--lg` |
| `#random-name` | `.ui-btn ui-btn--gold ui-btn--icon` |
| `.gender-switch` + `button[aria-pressed]` | `.ui-tabs ui-tabs--segmented` + `.ui-tab` |
| `.intro-actions button`, `#skip` | `.ui-btn ui-btn--plain ui-btn--sm` |
| `#dialogue-next` | `.ui-btn ui-btn--icon` |
| `#dialogue-choices button` (heaven/ui.js tạo ra) | `.ui-btn ui-btn--plain` (giữ `.choice-key`) |
| `#heaven-replay` | `.ui-btn ui-btn--go` |
| `#heaven-interact` | `.ui-btn ui-btn--gold` |
| `#heaven-passport-toggle` + `#heaven-seal-count` | `.ui-btn ui-btn--plain` + `.ui-badge` |
| `.farm-item-action`, `.farm-batch-receive` | `.ui-btn ui-btn--go ui-btn--sm` |
| `.farm-purchase-buy` | `.ui-btn ui-btn--gold` |
| `.farm-dialog-actions button` (xác nhận / hủy) | `.ui-btn--go` / `.ui-btn--plain` |
| `#farm-modal-close`, `.farm-trade-close`, `.seed-strip-close`, `.cafe-close`, `.farm-staff-dismiss` | `.ui-close` |
| `#farm-main-nav button`, `#farm-quick-nav button`, `#cafe-quick-nav button`, `#cafe-main-nav button` | `.ui-hud-btn` |
| `.cafe-primary` | `.ui-btn ui-btn--go` |
| `.cafe-link` | `.ui-btn ui-btn--link` |
| `.cafe-hold` | `.ui-btn ui-btn--gold ui-btn--lg` |
| `.cafe-option` (`[data-wrong]`, `[data-hint]`) | `.ui-btn ui-btn--plain` (giữ data-state) |
| `#farm-modal` / `.farm-modal-window` / `header` / `#farm-modal-title` / `#farm-modal-subtitle` / `#farm-modal-items` / `#farm-modal-footer` | `.ui-modal` / `__window` / `__head` / `__title` / `__subtitle` / `__body` / `__foot` |
| `#cafe-dialog` / `header` / `.cafe-subtitle` / `.cafe-dialog-body` | `dialog.ui-modal.ui-modal__window` / `__head` / `__subtitle` / `__body` |
| `.farm-dismiss-dialog`, `.farm-trade-dialog` | `dialog.ui-modal ui-modal--sm` |
| `#heaven-ending` / `.ending-card` | `.ui-modal` / `.ui-modal__window ui-modal--md` |
| tab của farm modal (`#farm-bag-tabs`), `.cafe-tabs` | `.ui-tabs` / `.ui-tab` |
| `.cafe-warning` · `.cafe-note` · `.cafe-unlock` · `.farm-station-feedback` · `.farm-staff-swap-message` · `.cafe-learn[data-tone]` | `.ui-alert--warn` · `--info` · `--good` · `.ui-alert` · `--good` · `.ui-alert` (giữ data-tone) |
| `#farm-notice`, `#heaven-toast` | `.ui-toast` |
| `.quest-tracker`, `#farm-journal`, `#farm-blockers`, `#error` | `.ui-panel` |
| `.creation-card` | `.ui-panel ui-panel--card` |
| `.farm-menu-item`, `.cafe-row` | `.ui-row` |
| `.cafe-card`, `.cafe-ticket` | `.ui-box` |
| `.farm-station-empty`, `.farm-jobs-empty`, `.farm-bag-empty` | `.ui-box ui-box--empty` |
| `.farm-level-badge` | `.ui-badge ui-badge--level` |
| `.bag-count`, `.seed-count`, `.farm-hud-count` | `.ui-badge` |
| `.cafe-chip`, `.farm-item-level`, `.farm-task-reward`, `.cafe-staff-level` | `.ui-chip` |
| công tắc trong Cài đặt farm (`[role=switch] .farm-item-action`) | `.ui-switch` |

Giữ nguyên: mọi `id` (JS tra theo id), `.farm-gold-coin`/`.game-currency` (đồng xu chung đã có), `.dialogue` (khung lời thoại có kiểu riêng, chỉ đổi màu sang biến).

**Mục tiêu đo được:** số màu hex/rgb viết thẳng giảm từ khoảng 440 xuống ≤ 120 ở farm.css (phần còn lại là màu vẽ hình như cây, đất, gói hạt), từ khoảng 100 xuống ≤ 30 ở cafe.css. heaven.css và dialogue.css chỉ còn màu vẽ hình.

### 1.4 Nút cài đặt (HUD, nhỏ gọn)

- **Farm:** giữ ⚙️ đang đứng đầu `#farm-quick-nav` (guide §8: Cài đặt đầu tiên). Modal Cài đặt farm thêm một dòng đầu tab Hiển thị: “🔊 Âm thanh & đồ họa”, `action: 'game-settings'`. Bấm vào thì đóng modal farm rồi mở hộp cài đặt chung. Không lồng hai modal.
- **Quán:** `#farm-quick-nav` bị ẩn khi `.cafe-active`, nên thêm ô ⚙️ “Cài đặt” **đầu tiên** trong `#cafe-quick-nav`, trước 🚪 Mở cửa.
- **Chọn nhân vật / mở đầu / thiên đàng:** một nút `#game-settings-toggle` (`.ui-btn ui-btn--icon`, 40×40, ⚙️) cố định ở góc trên phải, có tính vùng an toàn. Vị trí chỉnh bằng CSS, không viết JS:
  - mặc định (chọn nhân vật): `top/right: max(12px, safe-area)`;
  - `body:has(#intro-controls:not([hidden]))`: dịch sang trái nút Bỏ qua;
  - `body:has(#heaven-hud:not([hidden]))`: xuống dưới `.seal-hud` (top ≈ 64 px);
  - `body.farm-active`: ẩn, vì farm và quán đã có nút riêng.
- **Hộp cài đặt chung** `<dialog id="game-settings" class="ui-modal ui-modal--sm">` (tạo trong `src/ui/settings.js`):
  - Âm thanh: công tắc Tắt tiếng; thanh trượt Tổng, Hiệu ứng, Giao diện (0–100 %). Thanh Nhạc/Môi trường **chỉ hiện khi** `hasContent('music'|'ambience')` là true (lượt này chưa có file nên ẩn).
  - Đồ họa: `.ui-tabs--segmented` Thấp / Vừa / Cao, kèm một dòng mô tả.
  - Kéo thanh trượt thì áp dụng ngay. Thả thanh Hiệu ứng thì phát thử `coin.gain`, thả thanh Giao diện thì phát `ui.click`. Ghi save khi thả.
  - Khoá di chuyển: `showModal()` làm canvas không bấm được. Hộp chặn `keydown/keyup` lan ra (`stopPropagation`, Esc vẫn đóng như mặc định). Lúc mở gọi `onOpen` → app/game.js gọi `activeScene.clearInput()`.
  - Xuất ra: `mountSettings({ onOpen })`, `openSettings()`, `isSettingsOpen()`.

---

## 2. Engine âm thanh `src/shared/audio/`

### 2.1 API (`index.js`)

```
sfx(id, { at, volume = 1, rate = 1 } = {})        // phát một lần; at = {x,y,z} → âm 3D
loop(id, { at, volume, rate }) → { set({ volume, rate, param }), stop(fadeMs = 120) }
setListener(position, camera)                       // gọi mỗi khung hình ở farm và quán
setVolume(bus, value)   // bus: master | music | ambience | sfx | ui ; 0–1
setMuted(bool)
playMusic(id | null), playAmbience(id | null)       // chuyển dần 1,5 s; lượt này chưa có file nên không phát
hasContent(bus) → bool
```

- **Sơ đồ bus:** `music`, `ambience`, `sfx`, `ui` → `master` → đầu ra. Tắt tiếng thì kéo gain master về 0 trong 50 ms, giữ nguyên giá trị từng bus.
- **Mở khoá:** chỉ tạo `AudioContext` ở lần chạm đầu tiên (`pointerdown`/`keydown`/`touchend` trên window, capture, một lần). Trước đó `sfx` không phát và **không xếp hàng**. Nhạc/môi trường thì nhớ id rồi phát khi đã mở khoá. Trình duyệt không có Web Audio thì mọi hàm thành no-op.
- **Ẩn tab:** `visibilitychange` ẩn thì `ctx.suspend()`, hiện lại thì `resume()` (chỉ khi đã mở khoá).
- **Tiếng UI tự gắn:** một listener `click` uỷ quyền trên `document`. `button` phát `ui.click`, trừ khi có `data-sfx="<id>"` (phát id đó) hoặc `data-sfx="none"`. `.ui-close` mặc định phát `ui.close`. Nhờ vậy intro, chọn nhân vật và thiên đàng có tiếng UI mà không phải sửa logic.
- **Âm 3D:** `PannerNode` với `panningModel: 'equalpower'`, `distanceModel: 'linear'`, `refDistance: 6`, `maxDistance: 30`. Vị trí nghe đặt ở nhân vật người chơi, hướng theo góc quay ngang của camera. Thao tác của chính người chơi phát **không 3D** cho rõ. Âm 3D dùng cho nhân viên, cửa quán, khách, trạm xong mẻ.
- **Sổ âm** (`sounds.js`): `id → { bus, synth, file?, volume, maxInstances = 4, cooldownMs = 40, spatial? }`. Có `file` thì tải lười (`fetch` + `decodeAudioData`), trong lúc tải hoặc khi tải lỗi thì phát `synth`. Thay âm thật về sau chỉ cần thêm `file`, không sửa chỗ gọi.
- **Giới hạn:** tối đa 24 tiếng cùng lúc. Vượt `maxInstances` của một id thì cắt tiếng cũ nhất của id đó. Gọi trong khoảng `cooldownMs` thì bỏ qua. Mỗi tiếng tổng hợp ≤ 6 node, tự `disconnect` khi xong.

### 2.2 Danh mục id (lượt này tổng hợp bằng Web Audio)

| id | bus | Công thức tổng hợp (gợi ý) |
|---|---|---|
| `ui.click` | ui | tam giác 900→600 Hz, 40 ms, −18 dB |
| `ui.open` / `ui.close` | ui | noise lọc dải 2 kHz 80 ms + sin 520→780 Hz (đóng thì quét ngược) |
| `ui.tab` | ui | tick 1,2 kHz 25 ms |
| `ui.deny` | ui | vuông 220→180 Hz 120 ms, lọc thấp |
| `ui.buy` | ui | hai chuông sin 1320 + 1760 Hz, tắt dần 250 ms |
| `coin.gain` | sfx | 3 chuông nhanh, `rate` 1–1,2 theo số xu (log) |
| `coin.spend` | sfx | 1 chuông trầm |
| `reward.quest` | sfx | hợp âm rải C–E–G–C + lấp lánh |
| `reward.levelup` | sfx | hợp âm rải dài hơn, 2 nhịp |
| `farm.plant` | sfx | noise lọc thấp 400 Hz 120 ms + sin 140 Hz |
| `farm.water` | sfx | noise lọc dải quét 1,5 kHz xuống, 300 ms |
| `farm.fertilize` | sfx | 6 tick noise nhỏ trong 200 ms |
| `farm.weed` | sfx | noise lọc cao 3 kHz, rung biên độ, 250 ms |
| `farm.prune` | sfx | 2 click 3 kHz cách nhau 70 ms |
| `farm.clear` | sfx | tiếng thịch sin 90 Hz + noise lọc thấp |
| `farm.harvest` | sfx | tiếng pop + 3 nốt ngũ cung đi lên (C5–E5–G5), mỗi nốt 60 ms |
| `farm.refill` | sfx | noise lọc dải quét lên, 500 ms |
| `farm.process` | sfx | răng cưa 80→120 Hz lọc thấp, 400 ms |
| `farm.turn` | sfx | noise quét, 300 ms |
| `farm.ready` | sfx · 3D | ding-ding hai chuông |
| `farm.collect` | sfx | tiếng thịch bao tải + 2 nốt đi lên |
| `farm.build` | sfx | 3 tiếng búa + chuông (mở ruộng, nâng cấp, xây xong trang trí) |
| `farm.ship` | sfx | tiếng xe lăn: noise thấp 400 ms |
| `farm.arrive` | sfx | chuông xe giao tới quán |
| `cafe.door` | sfx · 3D | chuông cửa hai nốt E6–C6, tắt dần 600 ms |
| `cafe.order` | sfx · 3D | tiếng in phiếu: 3 xung vuông 2 kHz |
| `cafe.cup` | sfx | tiếng sứ chạm: sin 2,4 + 3,1 kHz, 150 ms |
| `cafe.serve` | sfx | `cafe.cup` + tiếng đặt ly |
| `cafe.angry` | sfx · 3D | răng cưa 150→110 Hz lọc thấp, 250 ms |
| `cafe.clean` | sfx · 3D | 2 tiếng rít lau bàn: sin 1,8→2,4 kHz |
| `cafe.call` | sfx | ding-dong gọi số |
| `cafe.shift-good` / `cafe.shift-bad` | sfx | rải hợp âm đi lên / hai nốt đi xuống |
| `bench.grind` | sfx | răng cưa 180 Hz rung biên độ, 600 ms |
| `bench.pour` (loop) | sfx | noise lọc dải. `param` = tỉ lệ đầy 0–1 → tần số lọc 600→1800 Hz (ly đầy thì tiếng cao dần, như rót thật) |
| `bench.steam` (loop) | sfx | noise lọc cao. `param` = nhiệt độ → âm lượng và độ sáng tăng (sữa ~60–65 °C thì tiếng “xì” rõ) |
| `bench.whisk` (loop) | sfx | noise rung biên độ 8 Hz |
| `bench.extract` (loop) | sfx | tiếng ù bơm 50 Hz + nước chảy nhỏ |
| `bench.scoop` | sfx | tiếng hạt lạo xạo (dùng khi xúc bột) |
| `bench.band` | sfx | tick mềm 1,6 kHz khi số đo **vào** vạch chuẩn |
| `bench.over` | sfx | tiếng “thụp” trầm khi vượt khỏi vạch trên |
| `bench.good` / `bench.bad` | sfx | 2 nốt đi lên / tiếng ù đục |
| `bench.wait` (loop) | sfx | giọt nước: sin 900–1300 Hz ngẫu nhiên mỗi 300 ms |
| `bench.star` | sfx | một chuông cho mỗi ★, mỗi ★ cao hơn 2 bán cung |

Nhạc và môi trường: lượt này không có. Bus và API đã sẵn sàng.

### 2.3 Hàng đợi âm thật (sound-designer chép vào bảng Âm thanh ở `docs/assets/asset-pipeline.md`, trạng thái `brief`)

| id | Mô tả / độ dài | Lặp |
|---|---|---|
| `music.farm` | acoustic guitar + marimba ấm, 70–80 BPM, 90–120 s | có |
| `music.cafe` | lo-fi jazz nhẹ, piano + upright bass, 90–120 s | có |
| `amb.farm` | gió nhẹ, chim rừng cao nguyên, côn trùng xa, 60 s | có |
| `amb.rain` | mưa vừa trên lá và mái tôn, 30 s (farm có mưa ngày 4–5 mỗi tuần) | có |
| `amb.cafe` | tiếng quán vừa đông, ly tách xa, không có lời rõ, 60 s | có |
| `farm.harvest`, `farm.water`, `farm.plant`, `farm.clear` | thu âm thật: hái quả vào giỏ, tưới bình, đất xới, cuốc, 0,3–0,8 s | không |
| `farm.process` (sân phơi/lò rang) | lò rang trống quay + tiếng nổ lách tách “first crack”, 2 s | không |
| `bench.pour`, `bench.steam`, `bench.extract`, `bench.grind` | rót nước từ ấm cổ ngỗng, vòi đánh sữa, máy espresso chiết, máy xay côn, 3–5 s | pour/steam/extract có |
| `cafe.door`, `cafe.cup`, `coin.gain` | chuông cửa gió, ly sứ, đồng xu, 0,3–1 s | không |

---

## 3. Thư viện VFX `src/shared/vfx/`

### 3.1 API (`index.js`)

```
createVfx({ scene, camera }) → {
  burst(kind, pos, { count, color } = {}),            // pos = {x,y,z}
  emitter(kind, pos, { rate, duration }) → { move(pos), stop() },
  pulse(object3D, { scale = 1.08, ms = 400 }),
  outline(object3D, { color }) → { remove() },
  update(dt), dispose()
}
flyTo(from {x,y}, targetEl, { icon, text })          // DOM; chuyển nguyên phần thân flyReward hiện có ra đây
popNumber(text, at {x,y}, tone = 'good'|'bad'|'neutral') // DOM; chuyển transient() hiện có ra đây
shake(strength = 1, target = '#game canvas')         // CSS transform ≤ 6 px, ≤ 300 ms, không đụng camera
setQuality(level), getQuality(), onQuality(fn), applyRendererQuality(renderer)
```

- Loại hạt: `soil`, `water`, `leaf`, `granule`, `cherry`, `dust`, `steam`, `sparkle`, `coin`, `puff` (đỏ), `heart`. Texture vẽ bằng canvas lúc chạy (chưa cần file). Sau này asset-3d làm flipbook trong `public/vfx/` thì thay vào mà không đổi id.
- Mỗi loại là một `THREE.Points` có sẵn một vùng đệm cố định (pool): mỗi loại một draw call, không cấp phát bộ nhớ trong từng khung hình.
- Mỗi màn 3D tự tạo instance riêng: farm tạo khi vào, quán tạo trong `createCafeGame`. Gọi `update(dt)` cuối hàm update của màn, `dispose()` khi rời màn. Lúc vào quán, vfx của farm dừng vì update của farm thoát sớm.
- `shake` rung canvas bằng CSS nên không làm lệch camera đi theo nhân vật.
- `outline` không dùng hậu kỳ (OutlinePass tốn thêm một lượt render). Thay vào đó dùng một lớp vỏ quay mặt sau phóng 1,04 lần, tối đa 2 vật cùng lúc. Vòng ring chọn ô hiện có vẫn giữ.

### 3.2 Mức chất lượng

| | Thấp | Vừa | Cao (mặc định, giống hiện tại) |
|---|---|---|---|
| Pixel ratio tối đa | 1 | 1,25 | 1,5 |
| Bóng (`shadowMap`) | tắt | bật | bật (như cũ) |
| Hạt sống tối đa | 120 | 400 | 800 |
| Hệ số số hạt mỗi burst | 0,4 | 0,7 | 1 |
| Emitter | tắt | bật, tốc độ ×0,5 | bật |
| `shake` | tắt | bật | bật |
| `outline` / `pulse` | chỉ ring sẵn có | pulse | pulse + outline |
| Chip DOM bay cùng lúc | 4 | 6 | 8 |

- Đổi mức thì áp dụng ngay. Bật/tắt bóng cần đặt `material.needsUpdate = true` trên mọi vật liệu trong scene, chấp nhận khựng một lần.
- `antialias` chỉ đặt được lúc tạo renderer nên lượt này không đổi.
- `prefers-reduced-motion`: tắt `shake`, số hạt ×0,5, `flyTo` rút còn 500 ms (vẫn giữ vì nó cho biết tiền và hàng đi đâu).
- Chip vượt giới hạn thì không bỏ: cộng dồn vào chip cùng loại đang bay (ví dụ “🪙 +12” thành “🪙 +20”).

### 3.3 Giới hạn hiệu năng (nghiệm thu)

- Ở mức Cao, VFX thêm tối đa 11 draw call (mỗi loại hạt một Points) và ≤ 1,5 ms mỗi khung hình trên laptop tầm trung. Âm thanh ≤ 1 ms mỗi khung hình.
- Desktop giữ 60 FPS. Điện thoại tầm trung ở mức Thấp giữ ≥ 30 FPS khi thu hoạch 12 ô liên tiếp hoặc lúc quán đông 6 khách xếp hàng.
- Không tạo `Material`/`Geometry` mới trong lúc chơi. Không gọi `farm.progress` thêm lần nào chỉ để phục vụ phản hồi: dùng `before/after` mà `applyAction` đã có sẵn.

---

## 4. Thao tác → hình → âm → nơi gọi

Quy ước:
- Mỗi màn có một file cầu nối: `src/features/farm/feedback.js` và `src/features/cafe/feedback.js`. File này xuất `feedback(event, data)` và chứa đúng bảng dưới đây, nên chỉnh độ mạnh hay đổi âm chỉ sửa ở một chỗ.
- Chỗ gọi chỉ thêm một dòng `feedback(...)`.
- **Thất bại** (`result.ok === false`): luôn phát `ui.deny`, không có hạt, giữ nguyên câu báo hiện có.

### 4.1 Farm (người chơi)

Điểm chặn chung: `applyAction(id, action, choice)` trong `src/features/farm/game.js`. Mọi thao tác của người chơi đều đi qua đây và đã có sẵn `before`, `after`, `origin` (toạ độ màn hình). Vị trí 3D lấy từ `world.getInteraction(id).position` → `{x, y: 0.6, z}`.

| Thao tác (action) | Hình | Âm | Ghi chú nơi gọi |
|---|---|---|---|
| Trồng (`plant`) | `burst soil` 8 + `pulse` ô | `farm.plant` | applyAction, sau khi xong việc ở `update` (`work.elapsed ≥ duration`) |
| Tưới (`water`) | `burst water` 12 (rơi xuống) | `farm.water` | như trên |
| Bón (`fertilize`) | `burst granule` 10 | `farm.fertilize` | như trên |
| Làm cỏ (`weed`) | `burst leaf` 8 (bay lên) | `farm.weed` | như trên |
| Tỉa (`prune`) | `burst leaf` 6 | `farm.prune` | như trên |
| Cuốc bỏ (`clear`) | `burst soil` 14 + `shake(0.5)` | `farm.clear` | như trên |
| Thu hoạch (`harvest`) | `burst cherry` 10 + `flyTo` Kho “🧺 +N g” (đã có) + Kho nảy | `farm.harvest` | applyAction. `flyReward('stock')` chuyển sang gọi `flyTo` |
| Lấy nước (`well/refill`) | `burst water` 8 ở giếng | `farm.refill` | applyAction |
| Bắt đầu sơ chế/rang (`start`) | `emitter dust` (sân phơi) / `steam` (lò rang) 1,5 s | `farm.process` | `process()` trong game.js → applyAction |
| Đảo mẻ phơi (`turn`) | `burst dust` 10 | `farm.turn` | applyAction |
| Mẻ vừa xong (`readyAt ≤ now`) | `burst sparkle` 12 ở trạm (huy hiệu vẫn nảy như cũ) | `farm.ready` (3D) | `refresh(now)` trong game.js: so tập id mẻ đã xong với lần trước. **Lúc tải màn chỉ ghi nhận, không phát** |
| Nhận mẻ (`collect`) | `pulse` trạm + `flyTo` Kho (đã có) | `farm.collect` | applyAction |
| Mua giống/phân (`buySeed`, `fertilizer`) | `popNumber "−X xu"` đỏ cạnh ô xu | `ui.buy` + `coin.spend` | applyAction (`after.coins < before.coins`) |
| Bán chợ (`market/sell`), giao đơn chợ (`market/order`) | `flyTo` xu (đã có) + `burst coin` 8 ở chợ | `coin.gain` | applyAction (`after.coins > before.coins`) |
| Nhận đơn chợ (`acceptOrder`) | `pulse` chợ | `ui.tab` | applyAction |
| Giao đơn quán (`orders/shipOrder`), chuyển hạt (`cafe/ship`) | `emitter dust` 1 s ở chỗ xe + `popNumber "−2 xu"` | `farm.ship` + `coin.spend` | applyAction. Giao hàng loạt (`ship-all`) bị cooldown gộp tiếng |
| Hàng tới quán | toast có sẵn trong nhật ký | `farm.arrive` | `refresh`: id chuyến đã biến khỏi `cafe.shipments`. Lúc tải màn không phát |
| Mở ruộng (`expand`), nâng cấp (`upgrade`) | `burst dust` 16 + `burst sparkle` 10 + `pulse` + `shake(0.6)` | `farm.build` + `coin.spend` | applyAction |
| Thuê, gia hạn, đào tạo nhân viên | `popNumber "−X xu"` | `ui.buy` | applyAction |
| Thả, cho ăn, thu cá | `burst water` 10 ở ao. Thu cá thì `flyTo` xu | `farm.water` (thu cá: `coin.gain`) | applyAction |
| Sửa rào (`repair`) | `burst sparkle` 6 | `farm.build` | applyAction |
| Nhận thưởng nhiệm vụ ngày (`daily/claim`) | `flyTo` xu | `coin.gain` + `reward.quest` | applyAction |
| Hoàn thành nhiệm vụ 🎯 (`result.quests`) | `burst sparkle` 20 quanh nhân vật | `reward.quest` | applyAction (đoạn đang ghép 🎯 vào câu báo) |
| Lên cấp ⭐ (`farm.level > levelBefore`) | `burst sparkle` 30 + `pulse` huy hiệu cấp (DOM) | `reward.levelup` (bỏ `reward.quest` nếu trùng lúc) | applyAction |
| Đặt / xây xong / phá trang trí | `burst dust` / `sparkle` 12 / `soil` 10 | `farm.plant` / `farm.build` / `farm.clear` | `src/features/farm/decoration-builder.js`, sau mỗi `farm.act` thành công |
| Mở / đóng modal farm | không có | `ui.open` / `ui.close` | `farm/ui.js`: `modal()` khi chuyển từ đóng sang mở, và `closeModal` |

**Nhân viên farm:** callback `onReward(before, after, task)` ở `createFarmCrew` trong game.js. Chỉ có `harvest`, `collect`, `ship`/`shipOrder` mới có tiếng, phát `farm.harvest`/`farm.collect`/`farm.ship` dạng 3D tại `task.id`, `volume 0.5`, kèm `burst` ×0,5. Việc chăm cây của nhân viên không có tiếng để tránh ồn liên tục.

**Vị trí nghe:** cuối `update` của farm gọi `setListener(character.position, world.camera)` rồi `vfx.update(dt)`.

### 4.2 Quán

`createCafeService` nhận thêm `fx(event, data)` (contracts §3). `src/features/cafe/game.js` truyền vào một hàm gọi `cafe/feedback.js`, dùng `screenAt(pos)` khi cần toạ độ màn hình. Toạ độ 3D lấy từ `DOOR`, `REGISTERS`, `PASS`, `TABLES` và `c.pos` (export từ service.js), `y = 1.2`.

| Thao tác | Hình | Âm | Nơi gọi `fx` |
|---|---|---|---|
| Mở / đóng cửa | `pulse` cửa | `cafe.door` (đóng thì `rate 0.8`) | `service.toggleOpen` khi `result.ok` |
| Khách vào | không có (khách 3D đã đi vào) | `cafe.door` (3D tại `DOOR`) | `spawn()`, khi khách được tạo |
| Hàng dài, khách quay đi | `burst puff` 6 tại `DOOR` | `ui.deny` (3D) | `spawn()`, nhánh `act('lost','busy')` |
| Nhận order (quầy, kiosk, thu ngân tự làm) | `pulse` quầy thu ngân | `cafe.order` (3D tại quầy) | `placeOrder()` |
| Ly xong lên kệ (barista, máy tự động) | `burst steam` 6 tại `PASS` | `cafe.cup` (3D) | `addToShelf()` |
| Người chơi cầm ly | không có (ly hiện trên tay) | `cafe.cup` | `arriveBar()` khi trả `true` |
| Giao ly + thanh toán | `burst sparkle` 8 (3★ thì thêm `heart` 6) tại khách + `flyTo` xu (đã có qua `reward`) | `cafe.serve` + `coin.gain` | `serve()` sau khi `result.ok`: `{ pos, stars, paid }` |
| Khách bỏ về vì chờ lâu | `burst puff` 8 + `popNumber "−2 uy tín"` đỏ | `cafe.angry` (3D) | `leave(c, mood, true)` |
| Dọn bàn | `burst sparkle` 6 tại bàn | `cafe.clean` (3D) | `clean()` khi dọn được > 0 chỗ |
| Màn hình gọi số | `pulse` quầy nhận đồ | `cafe.call` | các nhánh `notice('📺 …')` |
| Hết ca | đạt thì `burst sparkle` 30 quanh nhân vật | `cafe.shift-good` / `cafe.shift-bad` | `endShift()` theo `result.met` |
| Nhập hàng, thiết bị, thuê, bàn, đặt farm | `popNumber "−X xu"` | `ui.buy` (lỗi thì `ui.deny`) | `act()` trong `src/features/cafe/ui.js` |
| Mở / đóng hộp quán | không có | `ui.open` / `ui.close` | `open()` khi `!dialog.open`, và sự kiện `close` của dialog |

**Vị trí nghe:** cuối `update` của quán gọi `setListener(player.position, world.camera)` rồi `vfx.update(dt)`.

### 4.3 Quầy pha (`src/features/cafe/bench.js`, DOM)

`mountBench` nhận thêm `fx` (truyền từ `openBench` trong cafe/ui.js). Đổi giao diện bằng **thuộc tính data**, ui-stylist viết CSS:

| Bước | Hình | Âm | Chỗ trong bench.js |
|---|---|---|---|
| Chọn hạt / kỹ thuật đúng (`score ≥ .99`) | icon pop ✓ (đã có) | `bench.good` | `next()` |
| Chọn đúng một phần (△) | icon pop | `ui.tab` | `next()` |
| Chọn sai (`option.ok === 0`) | `stage[data-anim=shake]` (đã có) | `bench.bad` | handler của option |
| Chọn độ xay | mẫu hạt đã có | `bench.grind` | handler option khi `tool === 'grinder'` |
| Giữ để rót / đánh / chiết | dòng chảy và hơi nước (đã có) | `loop`: `bench.pour` (g, ml), `bench.steam` (°C), `bench.whisk` (phút), `bench.extract` (espresso), `bench.scoop` một lần mỗi 0,3 s (xúc bột). `set({ param: ratio })` mỗi tick | `pointerdown`/Space mở loop, `pointerup`/`lostpointercapture`/Space nhả thì `stop()` |
| Số đo **vào** vạch chuẩn | `.cafe-gauge[data-band=in]` sáng xanh | `bench.band` | `tick()`: chuyển từ dưới vạch sang trong vạch |
| Số đo **vượt** vạch trên | `[data-band=over]` đỏ + `stage[data-anim=shake]` | `bench.over` | `tick()`: chuyển từ trong vạch sang vượt |
| Bấm Xong, trong vạch | ✓ | `bench.good` | handler `done` |
| Bấm Xong, ngoài vạch | ✗ (lý do thật giữ nguyên) | `bench.bad` | handler `done` |
| Tua nhanh thời gian chờ thật | thanh tua (đã có) | `loop bench.wait`, dừng khi `advance` | `afterPop()` |
| Kết quả ★ | mỗi ★ là một `span` có `--i`, hiện lần lượt cách nhau 250 ms | `bench.star` ×★ (0★ thì `bench.bad`) | `finish()` |
| Mở barista tự pha (≥ 70) / pha theo trí nhớ (≥ 90) | `.cafe-unlock` nảy | `reward.quest` | `finish()` |

**Pha theo trí nhớ (`state.memory`):** không đặt `data-band`, không phát `bench.band` hay `bench.over`. Chỉ giữ tiếng rót/hơi để người chơi tự ước lượng. Nếu không tắt, tiếng sẽ lộ vạch chuẩn và phá luật luyện tới ★.

**Xem mẫu (`gauge.demo`):** vẫn phát loop và `bench.band` để người chơi nghe được mẫu.

---

## 5. Trường hợp biên

| Tình huống | Hành vi |
|---|---|
| Chưa chạm lần nào | Không có tiếng. Không xếp hàng âm cũ để phát dồn sau khi mở khoá |
| Trình duyệt không hỗ trợ Web Audio | Âm thanh là no-op. Hộp cài đặt vẫn mở, thanh trượt vẫn lưu |
| Giao hàng loạt / nhiều nhân viên cùng hái | Cooldown 40 ms và tối đa 4 bản mỗi id. Chip DOM cộng dồn |
| Tải lại khi có mẻ đã xong hoặc chuyến đã tới | Không ding hàng loạt: tập “đã thấy” được khởi tạo ở lần `refresh` đầu tiên |
| Offline lâu (≤ 8 giờ) | Không phát lại sự kiện đã qua. Màn hình chào mừng nhận đồ để lượt sau |
| Kho đầy khi thu hoạch hoặc nhận mẻ | `ui.deny`, không hạt, không chip bay. Câu báo giữ như cũ |
| Thiếu xu | `ui.deny`. Không `popNumber` âm |
| Chuyển farm ↔ quán | Mỗi màn có vfx riêng. Dừng loop quầy pha khi đóng hộp (cleanup của `mountBench` gọi `stop()`) |
| Ẩn tab giữa lúc đang giữ rót | Loop dừng theo `suspend`. Khi hiện lại, `lostpointercapture` đã nhả nên loop đã `stop()` |
| Tắt tiếng rồi đổi thanh trượt | Giá trị bus vẫn lưu, tiếng vẫn tắt cho tới khi bỏ tắt tiếng |
| localStorage hỏng | Cài đặt dùng trong lượt chơi. Dòng cảnh báo trong hộp cài đặt (contracts §4) |

---

## 6. Nhật ký quyết định

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-11-03 | Lưu **cài đặt âm thanh và chất lượng hình** qua các lần mở game (trường `settings`). Guide §9 ghi “chưa chốt lưu tùy chọn hiển thị”, nên các bật/tắt HUD farm vẫn chỉ trong lượt chơi | Người chơi tắt tiếng hoặc chọn mức Thấp trên điện thoại thì lần sau phải giữ, nếu không mỗi lần mở game đều khó chịu (trụ cột 1) |
| 2026-11-03 | Mặc định chất lượng `high` = renderer hiện tại, chưa tự dò thiết bị | Không đổi hình của save cũ. Tự dò để lượt sau, khi đã có số FPS thật |
| 2026-11-03 | Thao tác chăm cây của nhân viên không có tiếng. Chỉ hái, nhận mẻ, giao mới có tiếng 3D | Hai thợ làm liên tục sẽ thành tiếng ồn nền, che phản hồi của chính người chơi |
| 2026-11-03 | Không có tiếng báo vạch khi pha theo trí nhớ | Giữ đúng luật luyện tới ★: mở chế độ là để tự nhớ số liệu |
| 2026-11-03 | Rung màn bằng CSS trên canvas, không đụng camera | Camera farm tự đi theo nhân vật mỗi khung hình. Cộng lệch vào camera dễ bị trôi tích luỹ |

---

## 7. Chia việc theo vùng file

| Agent | Sở hữu (chỉ sửa trong đây) | Việc |
|---|---|---|
| **economy-integrator** | `src/state/progress.js`, `src/ui/settings.js` (mới), `docs/shared/contracts.md`; **ngoại lệ** 3 dòng trong `src/app/game.js` | `readSettings`/`saveSettings` theo contracts §4. Hộp `#game-settings` (markup dùng class `ui-*`, logic áp dụng, lưu, khoá phím, `isSettingsOpen`). Gắn `mountSettings({ onOpen: () => activeScene?.clearInput?.() })` trong app/game.js, **làm sau vfx-artist** |
| **sound-designer** | `src/shared/audio/*` (mới), bảng Âm thanh trong `docs/assets/asset-pipeline.md` | API §2.1, sổ âm và công thức tổng hợp §2.2, mở khoá, ẩn tab, tiếng UI tự gắn, âm 3D, giới hạn tiếng. Chép hàng đợi §2.3 |
| **vfx-artist** | `src/shared/vfx/*` (mới), phần renderer trong `src/app/game.js` (`initialize`, `resize`) | API §3.1, pool hạt, texture canvas, `flyTo`/`popNumber` (chuyển code từ `flyReward`/`transient` của farm/ui.js sang, giữ nguyên hình bay hiện tại), `shake`, mức chất lượng §3.2, `applyRendererQuality` thay cho pixel ratio cố định 1,5 |
| **ui-stylist** | `src/ui/styles/*` (game.css, `ui-kit.css` mới, farm.css, cafe.css, heaven.css, dialogue.css), `index.html` (class + nút `#game-settings-toggle`); được đổi **chỉ class** trong `src/features/heaven/*.js`, `intro/*.js`, `selection/*.js` | Biến §1.1, kit §1.2 kèm bí danh, bảng chuyển §1.3, thay màu viết thẳng đạt mục tiêu, vị trí nút cài đặt §1.4, CSS cho `#game-settings`, `.cafe-gauge[data-band]`, `.cafe-result-stars span{--i}` |
| **farm-dev** | `src/features/farm/*` (game.js, ui.js, decoration-builder.js, `feedback.js` mới) | Bảng §4.1: một dòng `feedback` trong `applyAction`, phát hiện mẻ xong và chuyến tới trong `refresh` (khởi tạo không phát), callback nhân viên, vfx theo vòng đời màn, `setListener`. `flyReward` gọi `flyTo`. `ui.open`/`ui.close` trong modal. Dòng “🔊 Âm thanh & đồ họa” trong `showSettings` + nhánh `shortcut('game-settings')` gọi `openSettings()` |
| **cafe-dev** | `src/features/cafe/*` (service.js, game.js, ui.js, bench.js, `feedback.js` mới) | Callback `fx` trong service, bảng §4.2 + §4.3, vfx của quán, `setListener`, ô ⚙️ đầu `#cafe-quick-nav`, tắt gợi ý bằng tiếng khi pha theo trí nhớ, `data-band`, ★ từng span, dừng loop trong cleanup |

**Thứ tự phụ thuộc**

1. **Đợt A (song song):** sound-designer, vfx-artist, ui-stylist, integrator (`progress.js` + `settings.js`). API đã chốt trong spec này nên không phải chờ nhau.
2. **Đợt B (sau khi audio và vfx đã có hàm thật):** farm-dev và cafe-dev song song, vì vùng file tách rời. Hai bên chỉ gặp nhau ở `farm/ui.js` → `flyReward` (do farm-dev sở hữu, quán chỉ gọi).
3. **Đợt C:** integrator gắn `mountSettings` vào `src/app/game.js` **sau khi** vfx-artist xong phần renderer trong cùng file.
4. Playtester chạy checklist §8.

Không ai sở hữu `src/shared/world/scene.js` trong lượt này. Toạ độ lấy qua `getInteraction`/`screenPoint` có sẵn, không cần sửa.

---

## 8. Checklist nghiệm thu (playtester)

Quy ước: “KT” = kinh tế không đổi, tức xu, kho, XP sau thao tác phải bằng đúng con số trước khi có lượt 1. Mở DevTools → Application → localStorage `cog-coffee-progress` để xem save.

| # | Kịch bản | Bước | Mong đợi trước → sau |
|---|---|---|---|
| 1 | Mở khoá âm | Xoá localStorage, tải trang, chờ màn chọn nhân vật 5 s, rồi bấm “Nữ” | Trước khi bấm: im lặng. Sau khi bấm: nghe `ui.click`. ⚙️ ở góc trên phải, không che thẻ chọn |
| 2 | Cài đặt lưu được | ⚙️ → Hiệu ứng 30 %, Tắt tiếng bật, Thấp → đóng → tải lại | `settings` = `{version:1, master:0.8, music:0.6, ambience:0.7, sfx:0.3, ui:0.6, muted:true, quality:'low'}`. Mở lại hộp cài đặt thấy đúng các giá trị đó |
| 3 | Save cũ | Dùng save farm có sẵn nhưng chưa có `settings`, tải trang | Không có trường `settings` cho tới khi đổi một mục. Xu, kho, ruộng y nguyên. Hình giống trước (bóng còn) |
| 4 | Khoá di chuyển | Ở thiên đàng, mở ⚙️, giữ W/mũi tên 2 s, rồi Esc | Nhân vật đứng yên. Esc đóng hộp. ⚙️ nằm dưới hồ sơ dấu, không chồng lên |
| 5 | Thu hoạch | Ô chín có `readyYield` = N g (xem Kho trước). Bấm cây | Nghe `farm.harvest`, quả đỏ bung, chip “🧺 +N g” bay về Kho, Kho nảy. Kho quả chín +N g, XP +6 (KT) |
| 6 | Kho đầy | Đầy kho rồi hái | `ui.deny`, không hạt, không chip. Câu báo “Kho còn … g” như cũ, kho không đổi |
| 7 | Tưới khi bình rỗng | Bình 0, kéo Tưới vào cây cần nước | `ui.deny`, không giọt nước. Báo “Bình hết nước; tới giếng.” |
| 8 | Mua giống | 200 xu → mua 1 cây Vối | 190 xu. “−10 xu” đỏ cạnh ô xu, `ui.buy` + `coin.spend`. Giống Vối +1 |
| 9 | Sơ chế | Có 600 g quả chín → sân phơi, 1 phần | Bụi bốc 1,5 s, `farm.process`. Quả chín −600 g. Sau 30 s ÷ hiệu suất: ding một lần + lấp lánh, huy hiệu nảy |
| 10 | Tải lại khi mẻ đã xong | Để mẻ xong rồi F5 | Lúc vào farm **không** có ding. Nhận mẻ: `farm.collect`, “+100 g” bay về Kho |
| 11 | Giao đơn quán | Đủ 252 g hạt rang, bấm Giao | `farm.ship` + “−2 xu”. Xu −2, kho rang −252 g. Khoảng 10 s ÷ hiệu suất: `farm.arrive` một lần |
| 12 | Giao hàng loạt | 2 đơn đủ hàng → Chuyển tất cả | Tối đa 2 tiếng `farm.ship` gần như cùng lúc, không vỡ tiếng. Xu −4 |
| 13 | Lên cấp / nhiệm vụ | Làm tới khi XP qua mốc (30 XP cho cấp 2) | `reward.levelup`, lấp lánh quanh nhân vật, huy hiệu cấp nảy. Câu báo “⭐ Lên cấp 2!” đứng đầu như cũ |
| 14 | Âm 3D | Có thợ đang hái ở ruộng xa. Đi lại gần rồi đi ra xa > 30 m | Tiếng hái của thợ to dần khi lại gần, lệch trái/phải theo camera, tắt hẳn khi ngoài 30 m. Thợ tưới cây thì không có tiếng |
| 15 | Vào quán, mở cửa | ☕ Vào quán → ⚙️ là ô đầu cột phải → 🚪 Mở cửa | Chuông cửa. Mỗi khách vào có `cafe.door`; đứng xa cửa thì nhỏ hơn đứng sát cửa |
| 16 | Nhận order | Ra quầy thu ngân khi có khách | `cafe.order`, quầy nảy. Câu báo “Bàn X gọi …” như cũ |
| 17 | Rót đúng vạch | Phin đen, bước rót nước (chuẩn ghi trên vạch), giữ tới khi vào vạch rồi thả, bấm Xong | Tiếng rót cao dần khi giữ. Vào vạch: tick + vạch sáng xanh. Xong: `bench.good`, ✓ |
| 18 | Rót quá vạch | Như trên nhưng giữ quá vạch trên | Vượt vạch: “thụp” + vạch đỏ + rung. Xong: `bench.bad`, câu lý do thật giữ nguyên (“…, chuẩn a–b ml. …”) |
| 19 | Pha theo trí nhớ | Món có best ≥ 90, bật “Pha theo trí nhớ”, rót | Có tiếng rót, **không** có tick vào vạch, **không** có “thụp” |
| 20 | Kết quả ★ | Pha đạt 3★ lần đầu (score ≥ 90) | Ba ★ hiện lần lượt, mỗi ★ một chuông cao dần. Dòng “🧠 Mở chế độ…” nảy + `reward.quest`. Mastery best cập nhật như cũ (KT) |
| 21 | Giao ly, thanh toán | Mang ly tới đúng bàn | `cafe.serve` + `coin.gain`, lấp lánh ở khách, chip xu bay lên. Xu tăng đúng `price + tip` trong câu báo |
| 22 | Khách bỏ về | Để khách hết kiên nhẫn | `cafe.angry`, khói đỏ, “−2 uy tín”. Uy tín quán −2 (KT) |
| 23 | Hết ca | Chờ hết ca 4 phút | Đạt: `cafe.shift-good` + lấp lánh. Không đạt: `cafe.shift-bad`. Thưởng ≤ 150 xu như cũ |
| 24 | Tắt tiếng | ⚙️ → Tắt tiếng, làm lại #5 và #21 | Không có tiếng nào, hình vẫn đủ. Bỏ tắt tiếng thì tiếng về đúng mức cũ |
| 25 | Ẩn tab | Đang giữ rót, chuyển tab 5 s rồi quay lại | Tiếng dừng lúc ẩn. Quay lại không còn loop rót kẹt |
| 26 | Chất lượng Thấp | Chọn Thấp ở farm | Mất bóng ngay, không còn khói/bụi kéo dài, hạt thưa hơn, không rung. Thu hoạch liên tiếp 12 ô: điện thoại tầm trung ≥ 30 FPS (DevTools → Rendering → Frame rendering stats) |
| 27 | Giảm chuyển động | Bật `prefers-reduced-motion` trong hệ điều hành, cuốc 1 cây | Không rung. Chip vẫn bay nhưng nhanh hơn |
| 28 | Không lưu được | Chặn storage (chế độ riêng tư chặn ghi), đổi âm lượng | Âm lượng đổi ngay. Hộp hiện “Chưa lưu được cài đặt” một lần |
| 29 | Bộ UI | Mở lần lượt: Kho, Cửa hàng, Cài đặt farm, hộp quán, xác nhận bán, kết thúc thiên đàng | Nút đóng cùng kiểu tròn ngoài góc. Nút chính cùng màu xanh. Nút bị khoá xám với con trỏ cấm (không còn đồng hồ cát). Tab đang chọn cùng một kiểu. Toast farm và thiên đàng cùng một kiểu |
| 30 | Không đổi luật | Chơi 5 phút đầu một save mới: trồng, tưới, hái, sơ chế, bán | Xu, kho, XP từng bước khớp bản trước lượt 1. Không xuất hiện thêm `farm.act` nào trong log |

**Để lượt sau (ghi nhận, không làm lượt này):** màn chào mừng khi quay lại đọc `progress.offline` (trụ cột 2), tiếng đúng/sai cho câu hỏi ở thiên đàng (cần người sở hữu `heaven/game.js`), nhạc và môi trường khi có file thật, tự dò chất lượng theo thiết bị.
