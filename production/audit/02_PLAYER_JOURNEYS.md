# 02 — Hành trình người chơi

> Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.
> Đây là AI chơi thử (không phải human playtest). Mọi đánh giá cảm nhận ghi nhãn **AI heuristic**.

## Test A — Người chơi mới (newplayer)

### Điều kiện chạy (đọc trước khi tin số)

| Mục | Giá trị |
|---|---|
| Origin | `http://newplayer.localhost:5174` (localStorage riêng, bắt đầu trống: `Object.keys(localStorage) = []`) |
| Viewport | 390×844, DPR 2, `(hover: none)` = true, `(pointer: coarse)` = true; **`navigator.maxTouchPoints = 0`** |
| Throttle | Không throttle CPU |
| Công cụ | **Pane trình duyệt nội bộ của Claude** (`mcp__Claude_Browser__*`), không phải chrome-devtools (MCP chrome-devtools báo "browser is already running…", 3 lần thử đều lỗi → xem Blocked) |
| Thời gian chơi | 0 → ~14,5 phút đồng hồ thật (`performance.now()` = 861 s lúc dừng) |
| FPS thật trong lúc chơi | **3 fps** (heaven, t≈156 s) và **1,5 fps** (quán, t≈682 s), đo bằng đếm `requestAnimationFrame` 2 s. Lý do: `tabs_context` báo "The Browser pane is currently hidden" → trình duyệt bóp rAF |

**Hệ quả của 1,5–3 fps** (đã kiểm từ code): `src/app/game.js:125` kẹp `dt = Math.min(raw, .1)`, nên mọi thứ chạy theo khung hình (đi bộ, tiến độ hái `src/features/farm/game.js:820`, khách quán đến `src/features/cafe/service.js:497`) chạy chậm còn khoảng 15–30% tốc độ thật. Ngược lại cây lớn (`farm/model.js:260`, theo thời gian thực) và đồng hồ ca quán (`cafe/service.js:441`, `endsAt = Date.now() + SHIFT_MS`) chạy theo đồng hồ thật. Vì vậy **các mốc thời gian dưới đây dài hơn thực tế ở 60 fps, không dùng để so với mục tiêu ≤ 150 s / ≤ 5 phút của `docs/design/onboarding-flow.md` §2.**

Hệ quả thứ hai: input của công cụ là chuột (`pointerType = mouse`), nên `usesTouch()` (`src/ui/dialogue.js:9`, dựa trên `lastPointer`) trả về false và game hiện chữ hướng dẫn PC ("Bấm mặt đất để đi…", "WASD/mũi tên…"). Đây là **đúng thiết kế với input chuột**, không phải lỗi. Chữ cảm ứng ("Kéo nút tròn để đi…") có trong code (`heaven/ui.js:19`, `farm/game.js:735`) nhưng chưa kiểm được bằng chạm thật.

Hệ quả thứ ba: ảnh chụp của pane bị trễ một nhịp ở fps thấp (bấm xong chụp ngay vẫn thấy khung cũ, chờ 2–3 s mới thấy). Ban đầu tưởng lỗi "chọn Nam nhưng vào game là Nữ"; đọc `src/app/game.js:229-235` thì mũi tên đổi qua lại giữa hai nhân vật, hai lần bấm (phải rồi trái) đưa về Nữ, và `savePlayer` lưu đúng `player.gender` → **không phải lỗi game**, đã loại khỏi danh sách lỗi.

### Mốc thời gian

Thời gian = giây kể từ lúc trang tải xong màn chọn nhân vật (đồng hồ thật, game bị chậm như trên).

| Mốc | Đang ở đâu | Hiểu mục tiêu? (AI heuristic) | Ảnh |
|---|---|---|---|
| ~30 s (t=36) | Màn tải "Đang pha một khởi đầu mới…", vừa bấm «Vào Game» | Có. Màn chọn chỉ có 2 nhân vật, tên điền sẵn "An Nhiên", 1 nút lớn | `evidence/newplayer/01-select-390.jpg`, `02-m30s-loading-intro.jpg` |
| ~2 phút (t≈105) | Thiên đàng, nói chuyện Thần Chết | Có. Thẻ "Mình đang ở đâu? · Tới gần Thần Chết…" chạm vào là tự đi tới | `05-m2-heaven-reaper.jpg` |
| ~5 phút (t≈292) | Thiên đàng, chuyên gia thứ 3 (Thần Thương Hội) | Có. Thẻ nhiệm vụ đổi theo từng bước ("Gặp Thần Pha Chế · 0/2 câu…") | `09-m5-heaven-3rd-expert.jpg` |
| ~7 phút (t≈413) | Vào farm | Gần đủ: thẻ "Hái lứa quả đầu tiên · Chạm cây có biểu tượng quả chín" | `11-m7-farm-enter-pc-hint.jpg` |
| ~10 phút (t≈533–581) | Farm: hái xong lứa đầu (XP 10/30, xu 230→240, nút «Vào quán» hiện chấm "Mới"); mua Ruộng 3 (240→70 xu) | Có | `17-m9-farm-first-harvest-cafe-unlocked.jpg`, `19-m10-farm-field-bought.jpg` |
| ~13–14 phút (t≈800–850) | Quán: khách đầu gọi món khi ca còn 0:45; hết ca **0 ly** | Một phần: hướng dẫn "Bước 2/4 · Đứng ở quầy thu ngân" rõ, nhưng ca hết trước khi kịp pha (do fps thấp) | `22-m13-cafe-first-order-at-0m45-left.jpg`, `24-m14-cafe-shift-end-0-served.jpg` |
| 20 phút | **Không đạt** — dừng ở 14,5 phút (xem Blocked) | — | — |

| Câu hỏi | Trả lời |
|---|---|
| Phần thưởng đầu tiên | t≈178 s: hộp kết quả câu 1 "Mẹo: Mắt chọn quả · Lô quả chín bạn tự hái +5 chất lượng" (`07-heaven-perk-reward.jpg`). Phần thưởng có số thật đầu tiên ở farm: hái lứa đầu, +10 xu +XP (t≈533). |
| Lúc bối rối đầu tiên | t≈450 s ở farm. Chạm một cây đang lớn (hàng 2) → thông báo "Quả đang chín · Cây chưa khát · khoảng 6 phút nữa." trong khi nhãn trên luống ghi "34s" (`13-farm-timer-34s-vs-toast-6min.jpg`). Code: chuỗi ở `src/features/farm/game.js:477`; "6 phút" là thời gian tới lúc cây khát nước, "Quả đang chín" là tên giai đoạn (`farm/rules.js:45`), còn "34s" là thời gian tới khi chín. Thêm nữa: nhiệm vụ nói "biểu tượng quả chín" nhưng cây chín hiển thị **giỏ** 🧺 phía trên luống, và hàng 1 đã chín sẵn từ lúc vào (`farm/model.js:74`, ô 0–3 `stage='ready'`) mà người mới không nhận ra. |
| Lúc chán đầu tiên (AI heuristic) | Thiên đàng: 6 câu hỏi, đáp án đúng luôn hiển nhiên (đáp án sai là câu đùa: "Đổi sang chiếc cốc đắt nhất", "Bật nhạc to hơn") → không có thử thách. Đi bộ giữa các chuyên gia dài (bị phóng đại bởi 3 fps). |
| Lý do chơi tiếp (AI heuristic) | Giọng thoại hài (bị biển đập đầu, "chưa chết · chỉ ngất"), mẹo có số thật gắn với farm/quán, cây có giỏ chín để hái ngay, nút mới mở dần có chấm "Mới". |

### Đếm lần bấm không có phản hồi rõ

| Lần | Nơi | Kết luận sau khi chờ 2–3 s / đọc code |
|---|---|---|
| 1 | Mũi tên "Nhân vật sau" ở màn chọn | Có phản hồi, ảnh chụp trễ (môi trường) |
| 2 | Chọn đáp án câu 1 thiên đàng | Có phản hồi sau ~2 s (fps thấp) |
| 3 | Thẻ nhiệm vụ farm lần đầu | Nhân vật có đi, nhưng không có mũi tên/chữ báo rõ trong ảnh đầu (fps thấp) |
| **Tổng xác nhận do game** | **0** | 3 lần "có vẻ không phản hồi" đều do môi trường 1,5–3 fps. Không đủ điều kiện kết luận cho máy thật. |

### Kiểm luật AGENTS.md

| Luật | Kết quả | Bằng chứng |
|---|---|---|
| Chọn giống bằng dải icon nhỏ phía dưới, không modal, không làm tối map | **Đạt** | `14-farm-seed-strip-bottom-highlight.jpg`: dải "Vối 12" ở đáy, map sáng bình thường |
| Bấm ô đất sáng viền đúng ô, nhân vật tới gần | **Đạt** | Cùng ảnh: viền vàng đúng ô; sau khi chọn giống hiện thanh "Trồng" trên đầu nhân vật (`15-farm-planting-progress.jpg`) |
| Bấm biển khóa → đi tới biển trước; tới nơi mới mở xác nhận nếu đủ tiền & liền kề; chỉ trừ khi xác nhận | **Đạt** | Vòng sáng ở biển, nhân vật đi tới, ~18 s sau mới mở "Mở ruộng 3? · Xác nhận mở ruộng · Số dư sau khi mua: 60 xu" (`18-farm-buy-field-confirm.jpg`). Xu chỉ đổi sau khi bấm (240→70 = −180 + 10 thưởng nhiệm vụ `expand` tự nhận, `farm/model.js:228`). Nhánh thiếu tiền chưa thử. |
| Modal khóa di chuyển | **Đạt (một phần)** | Trong modal mở ruộng, nhấn W ×20 → cảnh không đổi. Code: `farm/game.js:800` truyền `ui.modalOpen` vào `world.update`. Joystick trong modal chưa thử. |
| Shop/Kho mở modal giữa màn | Chưa thử (Cửa hàng chưa mở khóa ở lúc dừng) | — |

### Lỗi/quan sát mới từ Test A

| ID | Mức | Mô tả | Bằng chứng |
|---|---|---|---|
| A-1 | P2 | Thông báo chạm cây trộn hai bộ đếm: "Quả đang chín · Cây chưa khát · khoảng 6 phút nữa" cạnh nhãn "34s"; người mới đọc thành "6 phút nữa mới chín" | `farm/game.js:477`, `farm/rules.js:45`, ảnh 13 |
| A-2 | P2 | Nhiệm vụ nói "biểu tượng quả chín", trên cây chín là icon giỏ; người mới bỏ qua hàng cây đã chín sẵn | `farm/content.js:74`, ảnh 11, 13 |
| A-3 | P2 | Ca quán chạy theo đồng hồ thật còn khách/đi bộ chạy theo khung hình (`dt` kẹp 0,1 s). Máy yếu < 10 fps sẽ phục vụ ít khách hơn trong cùng ca 4 phút. Ca tập đầu không trừ uy tín (`cafe/service.js:449`) nên người mới không bị phạt, nhưng vẫn ra báo cáo "0 ly" | `app/game.js:125`, `cafe/service.js:441,497`, ảnh 24 |
| A-4 | P3 | `public/models/cafe/robots.glb` không tồn tại; console: "Không tải được /models/cafe/robots.glb, giữ khối tạm" (Vite trả index.html → JSON parse lỗi). Code vẫn tải ở `cafe/game.js:464`. Chưa từng có trong git | console tab, `ls public/models/cafe` |
| A-5 | P3 | Báo cáo cuối ca: cột Robot "0 ly" nhưng "Lãi sau hạt + vật tư −2,65 xu". Chưa rõ là chi phí gói robot có chủ đích hay sai; cần kiểm | ảnh 24 |
| A-6 | P3 (AI heuristic) | Thần Tiếp Nhận đứng dưới vùng joystick khi đi tới (ảnh 12); nhân vật chồng hình lên NPC khi nói chuyện | ảnh 12 |
| A-7 | P4 | Modal tên "Mở ruộng 3?" khi người chơi mới có 1 ruộng; Ruộng 2 (120 xu) ở chỗ khác. Đúng dữ liệu (`farm/content.js:28,33`) nhưng gây thắc mắc | ảnh 18 |

Console: không có lỗi `error` trong 14,5 phút; 1 `warn` (A-4).

### Blocked (Test A)

- MCP chrome-devtools không dùng được (profile đang bị một tiến trình khác giữ) → không có CPU throttle chuẩn, không chụp thẳng vào file (ảnh được chép từ thư mục kết quả công cụ sang `evidence/newplayer/`).
- Pane trình duyệt nội bộ bị ẩn nên chạy 1,5–3 fps → không đo được thời gian onboarding thật, không chơi được tới 20 phút, chưa pha được ly nào (quầy pha, đánh giá sao, bán ly đầu chưa kiểm bằng chơi).
- Input là chuột: chữ hướng dẫn cảm ứng và joystick chạm thật chưa kiểm.
- Chưa thử: chăm cây (tưới/bón/cỏ), bán ở Chợ (Cửa hàng chưa mở khóa), nhánh thiếu tiền khi mua ruộng.

## Test C/D/E — Người chơi giàu, quay lại, khai thác lỗi (stress)

Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật. Thực tế lần này: pane trình duyệt nội bộ của Claude (viewport 1024×768, không throttle CPU), origin riêng `http://stress.localhost:5174`. Không phải human playtest. Ảnh ở `evidence/stress/`.

### Điều kiện chạy (đọc trước khi tin số)
- MCP chrome-devtools không mở được (profile `chrome-devtools-mcp` đang bị tiến trình khác giữ); Claude in Chrome chưa kết nối. Dùng pane trình duyệt nội bộ.
- Pane bị ẩn nên trang chạy nền: đo được 6 rAF/5 s, có lúc 1 rAF/8 s. `dt` kẹp 0,1 s nên nhân vật đi chậm khoảng 10 lần. Hệ quả: **không đo được FPS**, và không chơi được các thao tác cần đi bộ (hái, mở ruộng bằng biển, giao đơn).
- Fixture chỉ đặt qua `localStorage` (evaluate). Thao tác chơi (nâng cấp, mua, bán, mở/đóng modal, vào quán, mở/đóng cửa quán) là click thật.

### C — Người chơi giàu
| Bước | Kết quả | Bằng chứng |
|---|---|---|
| Save 10.000.000 xu, XP 100.000 (cấp 46), 999 giống | Load bình thường, HUD `₫ 10.000.000` | `c01-rich-farm-loaded.jpg` |
| Nâng cấp bằng click thật: Sân phơi 1→2, Dụng cụ 1→11 (21 lần bấm thẻ + xác nhận liên tiếp) | Đúng 11 dòng ledger, xu trừ khớp (10.000.000 → 9.994.122). Reload: cấp và xu giữ nguyên | `c02-upgrade-tools-lv11.jpg` |
| Các mục còn lại lên tối đa (20, quán 10), mở hết 4 ruộng, 48 cây chín | Đặt bằng fixture (đi bộ không khả thi ở 1 fps). Load OK, 48/48 cây `ready` | `c03-full-ripe-334draw.jpg` |
| Draw call (`?fps`, chất lượng high) | 135 draw (1 ruộng trống) → **334 draw** (4 ruộng, 48 cây chín, mọi mục cấp tối đa). Quán: 197 draw. FPS: không đo được (xem điều kiện) | ảnh c03, c04 |
| Bán 19,75 kg hạt rang, bấm đúp «Bán ngay» + 1 click nữa | Chỉ bán 1 lần (+690,05 xu, 1 dòng ledger) | ledger sau 6 s |
| Mua 1 giống, bấm đúp «Mua ngay» + 1 click nữa | Chỉ mua 1 lần (−10 xu, giống 999→1000) | ledger |
| Mở/đóng modal Kho 20 vòng (40 click) | Modal đóng đúng; heap JS 34,9 → 35,9 MB, DOM 767 → 779 node. Không thấy rò rỉ đáng kể | `performance.memory` |
| Vào quán (bấm đúp «Vào quán») | Chỉ dựng 1 lần, vào quán OK (197 draw, 10 bàn/20 chỗ) | `c04-cafe-entered-197draw.jpg` |
| Mở/đóng cửa quán 5 lần liên tiếp | Không trừ tiền; ca kết thúc ngay với báo cáo «0 ly», quà robot chuyển `active` (S-11) | dialog «Hết ca» |
| Reload giữa màn loading vào quán | Về farm, save nguyên vẹn (xu, 48 cây chín, quà robot `ready`) | đọc save sau reload |

### D — Quay lại sau một thời gian (lùi `lastAt` trong save)
Fixture: ô 1 cây non (vối, 90 s mới trưởng thành), ô 2 cây trưởng thành vừa hái (360 s tới chín), nước 90, xu 1000.

| Vắng | Ô 1 (cây non) | Ô 2 (trưởng thành) | Khác |
|---|---|---|---|
| 0 | đang lớn | đang lớn | `offline=null` |
| 15 phút | vừa trưởng thành, `growthMs=10` | **chín**, 2565 g | `offline.seconds=900`; **không có thông báo nào trên màn hình** (S-1) |
| 3 giờ | trưởng thành, `growthMs=0`, nước 0, cỏ 100 | chín | quả chín trong kho 85 → 53 điểm chất lượng |
| 26 giờ | như trên, sức khoẻ 79 | chín | tính tối đa 8 giờ (`offline.seconds=28800`) |
| 400 ngày | như trên | chín | vẫn 8 giờ; không crash |

- Xu không đổi ở mọi mốc. Game **không có thưởng theo giờ/đăng nhập** (grep `src/`: không có hệ thống này), nên không có gì để nhận trùng.
- Ô 1 sau 15 phút lẽ ra phải chín (90 s + 360 s < 900 s, ô 2 cùng điều kiện nước đã chín) nhưng bị mất phần thời gian thừa khi qua mốc trưởng thành (S-2).
- Đồng hồ trang (ghi đè `Date.now` +8 giờ): game cộng ngay 8 giờ, `lastAt` lưu ở tương lai. Trả đồng hồ về rồi mua 1 giống: giao dịch ghi ở mốc +8 giờ, mô phỏng đứng yên tới khi giờ thật đuổi kịp. Reload thì `lastAt` bị kẹp về hiện tại, nên có thể lặp lại để được thêm 8 giờ mỗi lần (S-3).

### E — Khai thác lỗi
| Thử | Kết quả |
|---|---|
| Bấm đúp nút xác nhận mua/bán/nâng cấp | Không trừ/cộng trùng. Click thứ hai lọt xuống thẻ bên dưới, mở xác nhận cho món khác (S-5) |
| Xu âm (−500) | Bị kẹp về 0. Cửa hàng hiện giá «0 xu» trên nút mờ, không nói thiếu tiền (S-6) |
| Xu là chuỗi `"abc"` | Về 200 xu, không crash |
| Xu 1e15 | Kẹp 1e12, HUD vẫn vừa khung |
| Ruộng sai thứ tự (`['field-3']`) | Save được chấp nhận nguyên (field-0 + field-3), không kiểm liền kề khi load (S-9) |
| `plots:"x"`, lô gram âm, `upgrades` 999/−3, plot NaN/crop lạ | Load OK, giá trị được kẹp |
| `farm:[]`, `farm:null`, `farm:{version:3}` | Farm mới, 350 xu: quà thiên đàng +150 phát lại vì thiếu `giftApplied` (S-8) |
| `cafe` toàn rác | Farm load OK (chưa vào quán để thử) |
| JSON hỏng / `version:99` | Về màn chọn nhân vật, không báo gì; bắt đầu lại sẽ ghi đè save cũ (S-7) |
| `workers:[…,null]`, `lots:[null]`, `decorations:[null]` | **Màn lỗi «Chưa mở được thế giới 3D»**, tải lại vẫn lỗi, nút ⚙️ bị ẩn → kẹt vĩnh viễn (xác nhận runtime cho EX-1) |

Ảnh: `e01-workers-null-crash.jpg`. Lỗi kỹ thuật: `Cannot read properties of null (reading 'id' | 'product' | 'type')`.

### Blocked (Test C/D/E)
- Không đo được FPS/CPU throttle/heap snapshot: chrome-devtools bị khoá profile, pane ẩn chạy ≤ 1 fps.
- Không chơi được bằng đi bộ (WASD/joystick): hái liên tục, mở ruộng qua biển, giao đơn, nhận thưởng nhiệm vụ bằng thao tác. Các mục tối đa và mở ruộng chỉ đặt bằng fixture.
- Chưa vào quán với save `cafe` rác; chưa pha/bán ly ở quán.
- Console bị xoá mỗi lần reload; lỗi load chỉ đọc được qua `#error code` (`fail()` không `console.error`).

## Test B — Xu kiếm được mỗi phút, 10 phút đầu farm (ux)

> Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật. AI chơi bằng sự kiện chạm thật (không phải human playtest).

| Mục | Giá trị |
|---|---|
| Origin / thiết bị | `http://ux.localhost:5174`, Chrome 156 headless riêng qua CDP (chrome-devtools MCP bị khoá profile), 390×844, touch, 60 fps, không throttle |
| Bắt đầu | Fixture chapter 3 của SKILL.md (`gift:'capital'`) → farm, **350 xu**. T0 = lúc farm hiện (ước lượng ±5 s) |
| Cách chơi | Chỉ thao tác hợp lệ: chạm cây, chọn giống ở dải giống, «Vào quán» → «Mở cửa» → quầy thu ngân → bàn pha 6 bước → «Mang ly đi», sân phơi «Bắt đầu». Không sửa save |
| Nhịp AI | Mỗi thao tác tốn thêm vài giây độ trễ công cụ, nên **chậm hơn người thật**; kết quả là cận dưới |

| Phút (ước lượng) | Việc | Xu |
|---|---|---|
| 0 | vào farm | 350 |
| ~1 | hái 1 cây chín → thưởng nhiệm vụ «Hái lứa quả đầu tiên» +10 | 360 |
| 1–3 | hái 8 cây (22,26 kg quả chín), trồng 4 giống vào luống trống (không tốn xu, có sẵn 6 giống) | 360 |
| 4–6 | vào quán, mở ca 4 phút, pha 1 ly Phin đen (2★, tay nghề 74) → +6,37 xu bán + 15 thưởng nhiệm vụ «Bán ly đầu tiên» | 381,37 |
| 6–8 | ca hết khi đang pha ly thứ 2 (3 bàn chờ), báo cáo "Phục vụ 1 ly · 6,37 xu" | 381,37 |
| 8–10 | về farm, cho 22,2 kg quả vào sân phơi (37 phần → 3,7 kg nhân, 2 mẻ); 8 cây đã chín lại | **381,37** |

**Kết quả: +31,37 xu / 10 phút ≈ 3,1 xu/phút** (thực nhận). 80 % từ thưởng nhiệm vụ (25 xu), 20 % từ quán (6,37 xu), 0 từ chợ.

- Giá trị còn trong kho lúc dừng (**ước lượng**, chưa bán): 3,7 kg nhân sạch × 0,04 xu/g ≈ 148 xu giá gốc, sau đường cong chợ `marketValue(0,148)` ≈ 139 xu (`farm/content.js` giá `dried`, `farm/rules.js` `marketCurve`); 8 cây chín ≈ 20 kg quả × 0,004 ≈ 80 xu nếu bán quả tươi.
- So mục tiêu thiết kế: `docs/design/cafe-fun-review.md:191` ghi đầu game ≈ 15 xu/phút **sau lô đầu**. 10 phút đầu chưa có lô đầu bán ra nên thực nhận thấp hơn ~5 lần; thời điểm tiền về là sau phơi → rang → bán/giao (ngoài 10 phút này).
- AI heuristic: 10 phút đầu hầu như không thấy xu tăng từ việc làm (ngoài thưởng nhiệm vụ). Ly đầu chỉ 6,37 xu so với biển mở ruộng kế tiếp 180 xu (`01-farm-enter-390.jpg`).
- Ảnh: `evidence/ux/01…14-*-390.jpg`; save cuối: `evidence/ux/fixture-testB-end-10min.json`.
