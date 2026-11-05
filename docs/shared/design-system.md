# 04 — Game Design System (Phase 2)

Nguyên tắc: **tiến hóa `ui-kit.css` + token `--ui-*` đang có, không viết lại**. Giữ tên biến cũ để không vỡ selector farm/quán. Chỉ thêm token còn thiếu, và chuyển dần CSS riêng của từng màn sang class `ui-*`. Mọi component nằm trong `src/ui/styles/ui-kit.css`. Icon nằm trong `src/ui/icons.js` (mới, mở rộng cách làm của `ui/currency.js`).

## 1. Color tokens

### 1.1 Giữ nguyên (đã có trong `game.css`)
`--ui-ink`, `--ui-ink-soft`, `--ui-ink-light`, `--ui-wood*`, `--ui-paper*`, `--ui-plank*`, `--ui-cream*`, `--ui-leaf*`, `--ui-go*`, `--ui-gold*`, `--ui-close*`, `--ui-good*`, `--ui-bad*`, `--ui-warn*`, `--ui-off*`, `--ui-focus`, `--ui-shine`, `--ui-sheet`, `--ui-coin-*`, `--ui-shadow`, `--ui-drop-soft`.

### 1.2 Thêm

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--ui-jade` / `--ui-jade-edge` | `#5fa596` / `#3f7c70` | Nhấn thiên đàng, trạng thái "đang chọn" trong lưới đồ |
| `--ui-lacquer` | `#b5523a` (= `--ui-bad`) | Viền tiêu đề đặc biệt, chấm "Mới" |
| `--ui-rattan-image` | `url(…rattan.svg)` | Viền mây tre của HUD cấp 1 (SVG nhẹ, < 2 KB) |
| `--ui-hud-bg` | `#fff7e3eb` | Nền HUD nổi trên 3D: đặc, đủ tương phản, **không blur** |
| `--ui-nameplate-bg` / `--ui-nameplate-ink` | `#3b2a1cd9` / `#fff6dc` | Nhãn NPC/công trình nổi trên thế giới (nền tối để đọc được trên mọi nền sáng) |
| `--ui-marker` | `#ffd25e` | Marker tương tác, viền sáng ô đất được chọn |

Quy tắc tương phản: chữ trên nền HUD/modal ≥ 4.5:1, chữ trên nameplate ≥ 7:1.

## 2. Typography

| Token | Mobile | Desktop (`clamp`) | Weight | Dùng |
|---|---|---|---|---|
| `--fs-display` | 22px | `clamp(22px, 1.6vw, 28px)` | 800 | Tiêu đề modal, ending |
| `--fs-title` | 16px | `clamp(16px, 1.15vw, 19px)` | 800 | Tên item, tên NPC |
| `--fs-body` | 14px | `clamp(14px, 1vw, 16px)` | 600 | Hội thoại, mô tả |
| `--fs-label` | 12px | `clamp(12px, .85vw, 14px)` | 800 | Nhãn nút HUD, tab |
| `--fs-caption` | 11px | `clamp(11px, .75vw, 13px)` | 700 | Chú thích, badge |
| `--fs-number` | 16px | `clamp(16px, 1.1vw, 20px)` | 800, tabular | Xu, số lượng |

Font: `--game-font: 'Baloo 2', system-ui, sans-serif`. Bỏ Fredoka khỏi link Google Fonts.

## 3. Spacing · radius · elevation · z-index

- Spacing thang 4: `--sp-1:4px` `--sp-2:8px` `--sp-3:12px` `--sp-4:16px` `--sp-5:24px`. Gutter màn hình = `max(12px, env(safe-area-inset-*))`.
- Radius: `--r-sm:10px` (chip, badge) · `--r-md:14px` (nút, ô) · `--r-lg:22px` (panel) · `--r-xl:25px` (modal).
- Elevation dạng "đồ vật có độ dày": `--lift-1: 0 3px 0 <drop>`, `--lift-2: 0 4px 0 <drop>, 0 10px 24px var(--ui-drop-soft)`. Cấm shadow mờ lớn kiểu web.
- Z-index: `canvas 0 · nameplate 3 · HUD 5 · coach 6 · modal 7 · transition 8 · error 10 · toast 30 · incident 31`. Gom vào biến `--z-*`; hiện các số đang rải rác trong CSS.

## 4. Icon family

- Lưới 24×24, vùng an toàn 2px. Nét 2px màu `currentColor` (mặc định `--ui-ink`), tô 2 tông (màu chính + tông nhạt 40%), góc bo 2px, không gradient.
- Kỹ thuật: SVG sprite `<symbol>` inline một lần trong `index.html`; dùng `<svg class="ui-icon"><use href="#i-coin"/></svg>`. Helper `icon(name)` trong `src/ui/icons.js` thay cho mọi emoji ở `features/*/ui.js`.
- Kích thước: 16 (inline với chữ) · 20 (nút nhỏ) · 24 (HUD) · 40 (ô đồ) · 56 (chi tiết item).
- Icon item (cây giống, hạt, món) có thể là **ảnh render từ model** (asset-3d render qua Blender, PNG 128px, atlas WebP) để đồng bộ với thế giới 3D. Icon hệ thống (đóng, cài đặt, mũi tên…) luôn là SVG.

Danh sách tối thiểu (map từ emoji đang dùng trong `02` P1-1):

| Nhóm | Icon |
|---|---|
| Hệ thống | close, back, settings, help/book, menu, lock, check, info, warning, arrow-guide, plus, minus, sound, sound-off |
| Tài nguyên | coin, xp, reputation-star, storage/crate, cup-count, timer, seat |
| Farm | sprout, tree, seed-robusta, seed-arabica, seed-liberica, cherry, water-drop, fertilizer, weed, pickaxe/tool, basket, sun-dry, roast, grind, well, field |
| Quán | door-open, door-closed, cup-hot, cup-iced, phin, espresso, milk, ice, recipe-book, order-ticket, broom/dirty-cup, register, pastry |
| Người | worker, robot, guest, staff, phone-incident, sick-incident, rude-incident, manager |
| Điều hướng | farm, cafe, shop, bag, upgrade, workers, orders, build |

## 5. Components

Mỗi component có các trạng thái: **normal · hover (chỉ `@media (hover:hover)`) · pressed · disabled · selected · loading** khi áp dụng. Vùng chạm tối thiểu 44×44.

| Component | Class | Trạng thái & quy tắc |
|---|---|---|
| Game button | `.ui-btn` + `--go` `--gold` `--plain` `--link` `--icon` `--sm` `--lg` | Đã có. Thêm `[aria-busy=true]` → spinner hạt cà phê thay icon, giữ nguyên chiều rộng. Disabled luôn kèm lý do (`title` + dòng nhỏ dưới, vd. "Cần cấp 2"). |
| HUD button | `.ui-hud-btn` | Icon 24 + nhãn 12px. `selected` = viền `--ui-marker`. Badge số ở góc trên phải. Mobile tối đa 4 nút cố định mỗi cảnh. |
| Resource counter | `.ui-counter` (mới) | Icon + số tabular, nền `--ui-hud-bg`. Nếu bấm được thì có dấu "+" nhỏ. Khi tăng/giảm: số nảy 120 ms, màu thoáng `--ui-good`/`--ui-bad`. |
| Progress bar | `.ui-progress` (mới, gộp `.farm-xp-track`, `#farm-work`, thanh ca quán) | Cao 8 (HUD) / 12 (modal), track `--ui-off`, fill `--ui-go`. Đầy thì chớp vàng 1 lần. |
| Inventory slot | `.ui-slot` (mới, gộp ô túi farm) | Vuông 64–72px, icon 40, badge số lượng góc dưới phải. `selected` = viền ngọc 3px + nâng 2px. `locked` = icon lock + mờ. `empty` = viền chấm, không đổ bóng. |
| Item card / detail | `.ui-detail` (mới) | Panel cố định dưới lưới: icon 56 · tên · mô tả ≤ 2 dòng · hàng hành động (stepper số lượng + nút giá). Thay cho card cao 300px của shop. |
| Shop grid | `.ui-grid` (mới) | `repeat(auto-fill, minmax(72px,1fr))`. Mobile 4 cột, desktop 6–8. Tab danh mục phía trên. Trạng thái trống: minh họa + 1 câu + nút. |
| Modal panel | `.ui-modal` + `--sm/--md/--lg` | Đã có. **Chỉ dùng 3 cỡ.** Quán chuyển `#cafe-dialog` sang cùng cấu trúc. Mở: scale .96→1 + fade 200 ms. Khóa di chuyển (đã có `clearInput`). |
| Tabs | `.ui-tab`, `.ui-tabs--segmented` | Một kiểu tab cho mọi modal (thẻ trên). Segmented chỉ dùng cho lựa chọn 2–3 giá trị (giới tính, chất lượng). |
| Dialogue box | `.dialogue` (dialogue.css) | Portrait 64px (ảnh render nhân vật, fallback khung màu + icon vai trò), nameplate màu theo nhân vật, chữ 14–16px, nút next ▾, auto/skip gọn bên phải. Cao ≤ 38% (portrait) / ≤ 30% (landscape). |
| Dialogue choice | `.ui-choice` (mới) | Thẻ gỗ nhạt full-width, số phím tắt bên trái. Pressed/selected/đúng (`--ui-good`)/sai (`--ui-bad`), có lắc nhẹ khi sai. |
| Nameplate (3D) | `.ui-nameplate` (mới, DOM chiếu vị trí) | Nền `--ui-nameplate-bg`, 12–13px, kích thước màn hình cố định. Hiện khi trong 6 m hoặc là mục tiêu quest. Ra ngoài khung → mũi tên chỉ hướng ở mép, clamp safe area. Thay label `CanvasTexture`. |
| Quest tracker | `.ui-quest` | Thu gọn: icon + tiêu đề + tiến độ, cao ≤ 48px. Chạm để mở rộng mô tả + nút "dẫn đường". Ẩn khi hội thoại/modal mở. |
| Interaction indicator | `.ui-interact` + marker 3D | Bong bóng icon theo loại (NPC: speech, công trình: bánh răng, cây: tay hái, quầy: cốc) bám world position phía trên đối tượng, cách đầu nhân vật ≥ 24px. Phím E / chạm. |
| Tooltip | `.ui-tip` (mới) | Desktop: hover 400 ms. Touch: nhấn giữ 350 ms. Tối đa 2 dòng. |
| Toast | `.ui-toast` (+ `--unlock`) | Đã có. Một hàng đợi duy nhất, tối đa 2 toast cùng lúc, 3 s. Không bao giờ nằm trong vùng ngón cái (joystick/nút hành động). |
| Coach | `.ui-coach` | Đã có. Một kênh duy nhất (bỏ toast gợi ý trùng ở desktop). |
| Alert / badge / chip / switch / slider | đã có | Giữ, chỉ thay emoji bằng icon. |
| Loading | `#loading` | Logo chữ Godbean + tagline + ly phin nhỏ giọt (animation hiện có) + mẹo chơi luân phiên. |
| Error | `#error` | Panel `--md` có minh họa, câu thân thiện, nút "Tải lại" + "Thử đồ họa thấp", chi tiết kỹ thuật trong `<details>`. |

## 6. HUD layout (mọi cảnh dùng chung khung)

```
PORTRAIT 390×844                         LANDSCAPE 844×390
┌──────────────────────────────┐        ┌─────────────────────────────────────────────┐
│[Avatar·Lv]        [₫ 350 +][≡]│        │[Avatar·Lv][Ca 3:42·0/12☕·⭐50]   [₫ 350 +][≡]│
│[Quest 1 dòng ▸]               │        │[Quest ▸]                          [Act 1]   │
│                               │        │                                   [Act 2]   │
│         THẾ GIỚI 3D           │        │              THẾ GIỚI 3D          [Act 3]   │
│     (nameplate, marker)       │        │                                             │
│                               │        │(◯)                       [coach]            │
│ [coach 1 dòng]                │        └─────────────────────────────────────────────┘
│(◯ joystick)    [Act][Act][≡M] │
└──────────────────────────────┘        DESKTOP: như landscape, scale theo clamp(),
                                         joystick ẩn (pointer:fine), phím tắt 1–4.
```

- **Góc trên trái**: danh tính + quest. **Góc trên phải**: tiền + menu hệ thống (cài đặt, hướng dẫn). **Dưới phải (vùng ngón cái)**: tối đa 3 hành động theo ngữ cảnh + nút "Quản lý" (≡M) mở ngăn kéo chứa phần còn lại (kho, nâng cấp, nhân viên, đơn, xây dựng, công thức…). **Dưới trái**: joystick.
- Trạng thái ca quán (thời gian, ly, khách, ghế, uy tín) gom thành **một dải icon+số** thay cho bảng 4 dòng.
- "Cần xử lý" / "Hoạt động" của farm thành badge trên nút Quản lý. Mở ra là panel trong ngăn kéo.
- Không hiện nút điều hướng tới chính màn đang ở. Không trùng chức năng (xu mở shop **hoặc** nút shop, không cả hai không có affordance).
- Ngân sách: HUD ≤ 20% diện tích viewport ở cả 3 kích thước.
- **Vùng trên điện thoại (05/11/2026, `src/ui/styles/hud.css` mục "Phone zones")**: mỗi khối một chỗ, không chồng nhau.
  - Dọc, từ dưới lên: thanh hành động (phải) + joystick (trái) → nút Auto (phải, trên thanh) → thông báo (`#farm-notice`, đáy + 212 px) → coach (đáy + 290 px).
  - Ngang: thanh hành động là cột phải, Auto nằm bên trái cột đó ở đáy, thông báo ở giữa đáy (giữa joystick và Auto), coach ở giữa trên cùng.
  - Ngăn kéo Quản lý hoặc dải chọn giống mở ra thì ẩn Auto, và ẩn joystick ở màn dọc. Nút Auto chưa có chữ thì không hiện.

## 7. Animation timing

| Token | Giá trị | Dùng |
|---|---|---|
| `--t-tap` | 100ms | Nhấn nút, đổi tab |
| `--t-panel` | 200ms | Mở/đóng modal, ngăn kéo |
| `--t-toast` | 240ms vào / 3s giữ / 200ms ra | Toast |
| `--t-reward` | 700ms | Xu/XP bay về counter (`vfx-chip` đã có) |
| `--t-scene` | 600ms | Chuyển cảnh (`#scene-transition`) |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Xuất hiện |
| `--ease-back` | `cubic-bezier(.3,1.4,.5,1)` | Phần thưởng, badge "Mới" |

`prefers-reduced-motion`: bỏ scale/translate, giữ fade ≤ 120 ms.

## 8. Sound feedback hooks

Hệ thống có sẵn: `shared/audio/index.js` tự phát theo `data-sfx` trên nút (mặc định `ui.click`, `.ui-close` → `ui.close`, `data-sfx="none"` để tắt). Design system chỉ quy định id cho từng component, không viết thêm engine:

| Component | `data-sfx` |
|---|---|
| Nút thường / tab | `ui.click` (mặc định) |
| Đóng modal | `ui.close` (mặc định) |
| Mua / xác nhận tốn tiền | `ui.buy` *(cần thêm vào `sounds.js` nếu chưa có)* |
| Nút disabled bị bấm | `ui.deny` *(cần thêm)* |
| Mở khóa / toast unlock | `ui.unlock` *(cần thêm)* |
| Lựa chọn đúng / sai | `ui.correct` / `ui.wrong` *(cần thêm)* |

Khi tới Phase 5, kiểm `sounds.js` trước: id nào đã có thì dùng lại; id thiếu thì giao `sound-designer`.

## 9. Lộ trình áp dụng (để Phase 5 không vỡ màn nào)

1. Thêm token mới (§1.2, §2, §3, §7) vào `game.css`, chưa đổi giao diện.
2. Thêm sprite icon + `ui/icons.js`, thay emoji theo từng file. `installCurrencyIcons` giữ nguyên.
3. Thêm component mới (`ui-slot`, `ui-grid`, `ui-detail`, `ui-counter`, `ui-progress`, `ui-quest`, `ui-nameplate`, `ui-choice`) vào `ui-kit.css`.
4. Dựng khung HUD chung (§6) cho farm + quán; giữ id DOM cũ mà code gameplay đang tìm.
5. Chuyển từng modal: túi → shop → nâng cấp → nhân viên → đơn → trang trí → modal quán.
6. Xóa CSS cũ trong `farm.css`/`cafe.css` khi selector không còn dùng.

