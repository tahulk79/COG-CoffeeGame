# 05 — UX mobile & độ trễ input (ux)

> **Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.** GPU là Apple M1 (ANGLE Metal), không đại diện GPU điện thoại.
> AI chơi thử bằng sự kiện input thật (không phải human playtest). Đánh giá cảm nhận ghi nhãn **AI heuristic**.

## Điều kiện chạy

| Mục | Giá trị |
|---|---|
| Origin | `http://ux.localhost:5174` (localStorage riêng, bắt đầu trống) |
| Trình duyệt | MCP chrome-devtools **không dùng được** ("browser is already running…", xem Blocked). Thay bằng Chrome 156 headless riêng (`--user-data-dir` trong scratchpad, ANGLE Metal M1) điều khiển qua CDP; script trong `evidence/ux/driver/` |
| Input | `Input.dispatchTouchEvent` (viewport mobile, `maxTouchPoints=5`, `pointer:coarse`), `dispatchMouseEvent`/`dispatchKeyEvent` (desktop). `evaluate` chỉ để đo, đặt fixture, đọc save |
| Viewport | 360×800@3, 390×844@2/3, 430×932@3 (mobile+touch), 844×390@3 (ngang, touch), 1280×720@1, 1920×1080@1 (chuột) |
| Save | Test B: fixture chapter 3 của SKILL.md rồi chơi hợp lệ. Kiểm UX: `evidence/ux/fixture-mid-farm.json` = save sau 10 phút Test B, sửa `claimed` tới `expand`, xu 1500, xp 360 (cấp 5), hàng 3 ruộng 1 để trống, 10 giống |
| Đo | `PerformanceObserver` `event` (durationThreshold 16) + `longtask` gắn trước app (`driver/init.js`); vùng bấm bằng `getBoundingClientRect` + `elementFromPoint` (`driver/targets.js`); vị trí ô đất trên màn hình chiếu từ camera thật (`driver/init2.js` bắt camera qua hook `__THREE_DEVTOOLS__`) |
| FPS lúc đo | 60 fps cả khi CPU throttle 4× (đếm rAF 3 s) |

## Kết quả theo viewport

Ảnh: `evidence/ux/<vp>-<n>-*.jpg` (vp = m360, m390, m430, l844, d1280, d1920). Số đo thô: `evidence/ux/vp-<vp>.txt`.

| Kiểm | 360×800 | 390×844 | 430×932 | 844×390 | 1280×720 | 1920×1080 |
|---|---|---|---|---|---|---|
| HUD farm: nút < 44 px | 0 | 0 | 0 | 0 | 0 | 0 |
| HUD chồng nhau (rect giao nhau) | dải giống × joystick 106×80 | như 360 | như 360 | không | không | không |
| Dải chọn giống: nút < 44 px | 3 | 3 | 3 | 3 | 3 | 3 |
| Picking: chạm tâm ô 11 (chiếu từ camera) → ô được trồng | ô 11 ✓ | ô 11 ✓ | ô 11 ✓ | ô 11 ✓ | ô 11 ✓ | ô 11 ✓ |
| Ô 8, 9 của ruộng đầu nằm ngoài màn khi vào farm | x=−107/−43 | x=−108/−40 | x=−120/−44 | trong màn | trong màn | trong màn |
| Modal shop / kho / nâng cấp | đủ, cuộn trong modal | đủ | đủ | **chật**, xem UX-3 | đủ | đủ |
| Xác nhận mua: nút < 44 px | 3 | 3 | 3 | 3 | 3 | 3 |
| Mua 1 giống 10 xu → xu | 1500→1490 | 1500→1490 | 1500→1490 | 1500→1490 | 1500→1490 | 1500→1490 |
| Quán: nút < 44 px | 0 | 0 | 0 | 0 | 0 | 0 |
| Bàn pha mở được | ✓ | ✓ | ✓ | ✓, nội dung bước bị đẩy xuống dưới | ✓ | ✓ |
| Dialogue (Thần Chết): nút < 44 px | 0 | 0 | 0 | 0 | 0 | 0 |
| Chữ tràn | chỉ ellipsis có chủ đích (thẻ nhiệm vụ) | như 360 | như 360 | như 360 | như 360 | như 360 |

Thêm:
- **Joystick** (390, touch kéo lên 40 px trong 1,4 s): camera đi z 11 → 5,34. **WASD** (1920, giữ D 1,2 s): camera x −4,2 → 0,53. Cả hai chạy.
- **Xoay màn hình** khi đang mở shop (390×844 ↔ 844×390, không reload): canvas 844×390, `camera.aspect` 2,164 rồi về 0,462; modal xếp lại, không mất trạng thái (`rot-1-*.jpg`).
- **Safe area**: CSS dùng `env(safe-area-inset-*)` cho thanh nút, drawer, joystick, HUD ngang (`hud.css:6,17,44,74`, `heaven.css:26`). `#farm-modal` chỉ có padding cố định 24/14 px (`farm.css:22,39`), không `env()`. CDP không giả lập được tai thỏ nên **chưa kiểm runtime**.
- **Desktop** (chuột): gợi ý "Enter hoặc bấm để tiếp", ẩn joystick (`heaven.css:50`). Chạy đúng.

## Độ trễ input → phản hồi

`duration` của Event Timing (input delay + xử lý + tới khi vẽ khung, làm tròn 8 ms). Long task là các task > 50 ms trong lúc thao tác.

| Thao tác (390×844) | Không throttle: click ms | CPU 4×: click ms (delay/xử lý) | Long task (CPU 4×) |
|---|---|---|---|
| Chạm ô đất trống (mở dải giống) | 40–48 | **144** (30/79) | **91 ms** |
| Mở shop | 32–56 | 96 (33/38) | 0 |
| Bấm giá mua (mở xác nhận) | 40–48 | **104** (45/26) | 0 |
| Xác nhận mua | 32–40 | 96 (34/34) | 0 |
| Mở kho | 32–40 | 96 (42/22) | 0 |
| Mở nâng cấp | 32–40 | 104 (42/30) | 0 |
| Vào quán (tải cảnh) | 32 | 56 | **245, 205, 125 ms** (không throttle: 58–117 ms, 2–3 task) |
| Dialogue "▾" | 24–48 | — | 0 |

- Không throttle: mọi click 24–64 ms ở mọi viewport. Hai lần lẻ ~300 ms ở 360×800 (pointerup mua / mở kho, `vp-m360.txt`), không lặp lại.
- Mở modal (shop/kho/nâng cấp) không có long task, kể cả ở CPU 4×.

## Vấn đề

| ID | Mức | Vấn đề | Bằng chứng | Đề xuất |
|---|---|---|---|---|
| UX-1 | P2 | Vùng bấm < 44 px ở mọi viewport: nút đóng dải giống 23×23, mũi tên cuộn dải giống 22×42, «Để sau»/«Mua ngay» cao 42, nút đóng xác nhận rộng 32, «Nâng cấp · 100 xu» ở sân phơi cao 35 | `farm.css:153` (close 23 px), `:1028` (arrow 22×42), `:771` (min-height 42), `:774` (32 px), `:964` (padding 8 px); `vp-*.txt` mục seed-strip/shop-confirm; `13-dryer-modal-390.jpg` | Giữ hình nhỏ nhưng nới vùng bấm lên 44 (min-width/min-height 44 hoặc pseudo-element trong suốt) |
| UX-2 | P2 | Shop khi thiếu xu: số lượng hiện 0, giá "0 xu", nút mờ, không nói thiếu bao nhiêu; chạm nút không có phản hồi (0 sự kiện click vì `disabled`) | `farm/ui.js:513` (`maximum = floor(coins/unitPrice)` → 0), `:520-523`; runtime xu 5, giống 10 xu: `m390-disabled-buy-coins5.jpg` | Khi `maximum<1`: giữ số lượng 1, giá thật, dòng "Thiếu N xu" (giống luật mua ruộng trong AGENTS.md) |
| UX-3 | P2 | Màn ngang 844×390: bàn pha chỉ thấy tiêu đề + hình, nút thao tác của bước nằm dưới phải cuộn; modal nâng cấp có nút đóng tràn 11 px ra ngoài (x 811–855 > 844, tâm vẫn bấm được); drawer phải cuộn mới tới «Cài đặt», «Xây dựng»; shop thấy ~1,3 thẻ | `l844-8-bench.jpg`, `l844-6b-upgrade-close.jpg`, `l844-5-drawer.jpg` (drawer scrollHeight 367 > 306) | Bố cục ngang riêng cho bàn pha (hình trái, điều khiển phải); kẹp nút đóng trong viewport |
| UX-4 | P2 | Màn dọc: vào farm, nửa trái ruộng đầu nằm ngoài màn (ô 8, 9 chiếu ra x < 0 ở 360/390/430); người mới không thấy hết luống của mình nếu chưa đi | `vp-m3*.txt`, `vp-m430.txt` dòng "row3 plots"; `01-farm-enter-390.jpg` | Lệch camera/khung ban đầu để ruộng đầu nằm trọn khi màn dọc (AI heuristic về mức độ) |
| UX-5 | P2 | Độ trễ khi CPU 4×: chạm ô đất 144 ms kèm long task 91 ms (dựng dải giống), mua 104 ms; vào quán có long task tới 245 ms | bảng trên | Đo trace phần dựng dải giống (`farm/ui.js` quanh `:607`) trước khi sửa; không sửa khi chưa có trace |
| UX-6 | P2 | Thiếu asset `/models/cafe/robots.glb`: Vite trả `index.html` (200 text/html), console warning ×9 mỗi lần vào quán | `cafe/game.js:464`; `ls public/models/cafe` không có file; console "Không tải được /models/cafe/robots.glb, giữ khối tạm." | Thêm GLB hoặc bỏ tải khi chưa có art |
| UX-7 | P3 | Dải chọn giống phủ joystick (106×80) ở màn dọc, không đi được khi dải mở | đo rect, `08-seed-strip-390.jpg` | Chấp nhận được vì đổi ô bằng chạm vẫn chạy; nếu muốn, đẩy dải lên trên joystick |
| UX-8 | P3 | Quán 390: hàng phiếu order phủ joystick | `11-cafe-orders-cover-joystick-390.jpg` | Đặt phiếu lệch phải hoặc trên joystick |
| UX-9 | P3 | Câu hỏi bài học tự bật ngay khi vào farm (430×932), che HUD; có «Để sau» | `m430-0-lesson-popup-on-load.jpg` | AI heuristic: hoãn tới lúc rảnh (không giữa thao tác) |
| UX-10 | P3 | Ca quán hết khi bàn pha đang mở giữa chừng: bàn pha đóng, ly đang pha không còn | quan sát Test B (`12-cafe-shift-end-390.jpg`); chưa đọc code | Kiểm code `cafe/service.js` hết ca; cân nhắc cho pha xong ly đang làm |
| UX-11 | P3 | HUD xu hiện số lẻ "381,37" sau khi bán ly ở quán | `farm/rules.js:46` `formatCoins` (`maximumFractionDigits:2`); `12-cafe-shift-end-390.jpg` | AI heuristic: làm tròn khi hiển thị HUD |

Đã kiểm, **không** lỗi: picking 3D trúng đúng ô ở cả 6 viewport; xoay màn hình; joystick; WASD; không nút HUD/quán/dialogue nào < 44 px; mở modal không có long task.

## Console

- `Không tải được /models/cafe/robots.glb, giữ khối tạm.` (warning, 9 lần) — UX-6.
- `The AudioContext was not allowed to start…` (16 lần) — do headless/không có gesture trước khi tạo AudioContext; không đánh giá là lỗi.
- Không có `error`/exception chưa bắt.

## Blocked

- MCP chrome-devtools: mọi lệnh trả "The browser is already running for …/chrome-devtools-mcp/chrome-profile". Đã thay bằng Chrome headless riêng qua CDP (cùng loại sự kiện input, Event Timing, CPU throttle).
- Không giả lập được safe-area (tai thỏ) và không có thiết bị thật.
- Không đo trace/heap; không đo network throttle.
