# TEST MATRIX — hệ thống × kịch bản A–E × viewport

SHA gốc `d8fdf771cff18509aecf41a8b1f1b0ff83fcd684` + thay đổi chưa commit (xem PROJECT_DISCOVERY.md §0). Dev server: `http://localhost:5174/`.
File này là kế hoạch kiểm thử. Chưa ô nào được chạy.

## Kịch bản

| Mã | Kịch bản | Chuẩn bị |
|---|---|---|
| A | Người chơi mới: save trống → chọn nhân vật → intro → heaven → farm → quest `harvest` → `serve` (vào quán) | `localStorage.clear()` |
| B | Đang chơi dở, tải lại ở từng màn (heaven giữa chừng, farm, đang trong quán) và vào lại đúng chỗ | Chơi tới điểm cần thử rồi F5. Cũng có thể bơm save: `{version:1,introCompleted:true}` → heaven; có `farm` → farm |
| C | Offline / tab ẩn: vắng 30 s, 2 phút, > 8 giờ (sửa `farm.lastAt` lùi lại) | Sửa `lastAt` trong save rồi tải lại; ẩn tab bằng visibilitychange |
| D | Vòng kinh tế farm ↔ cafe: hái → phơi → rang → giao → pha bán; vào ra quán ≥ 10 lần | Save farm giữa game (có thợ, có hạt) |
| E | Biên và lỗi: storage bị chặn hoặc JSON hỏng, `version ≠ 1`, save v1/v2 cũ, mạng chậm hoặc GLB 404, quality low, resize/xoay, reset tiến trình | DevTools (chặn request, throttle), bơm save hỏng |

## Viewport

| Mã | Kích thước | Ghi chú |
|---|---|---|
| M | 375×812 dọc (`resize_window mobile`) | Ưu tiên: mobile-first, pointer coarse → mặc định quality medium, tắt MSAA nếu DPR ≥ 2 |
| L | 812×375 ngang | HUD, joystick, modal, dải chọn giống |
| T | 768×1024 | |
| D | 1440×900 | Bàn phím WASD/E/Enter/Esc |

## Cách kiểm (ký hiệu)

- **C** = đọc code (file:line)
- **U** = unit test có sẵn (`node --test tests/`). Chỉ chạy khi người dùng cho phép, vì AGENTS.md cấm tự chạy test
- **S** = `node scripts/balance-sim.mjs`
- **R** = chạy thật trên trình duyệt (AI chơi thử, không phải human playtest) và kiểm `localStorage`, console
- **P** = đo bằng skill perf (`?fps`, `bench-init.js` `__bench`/`__cpu`, heap snapshot)
- **—** = không áp dụng

## Ma trận

Mỗi ô ghi cách kiểm, sau dấu `/` là viewport cần chạy.

| Hệ thống | A | B | C | D | E |
|---|---|---|---|---|---|
| Boot, chọn màn theo save (`app/game.js:178-200`) | R / M,D | C+R / M | — | — | C+R: JSON hỏng, `version 2` cấp 1 → về selection / M |
| Selection: chọn giới tính, tên, swipe (`selection/scene.js`, `app/game.js:229-261`) | R / M,L,T,D | R: tên đã lưu điền sẵn / M | — | — | R: tên rỗng → `DEFAULT_NAME`, > 20 ký tự / M,D |
| Intro: timeline, skip, Enter/bấm (`intro/timeline.js`) | R+P / M,D | R: F5 giữa intro → chạy lại intro (`introCompleted` chỉ ghi khi xong) / M | R: ẩn tab giữa intro / M | — | R: GLB intro 404 → khối tạm / M |
| Heaven: 3 chuyên gia × 2 câu, reveal, quà, cổng (`heaven/journey.js`) | R / M,L,D | R: F5 sau mỗi câu, đáp án giữ nguyên / M | — | — | U (`heaven-gameplay.test.js`) + R: storage chặn → toast / M |
| Save/Load cấp 1 (`state/progress.js`) | R: kiểm key sau mỗi màn / D | R / D | — | — | C+R: storage chặn, `QuotaExceeded`, reset giữ `settings` và `cog-coffee-player` / D |
| Migration farm v1/v2 → v3 (`farm/model.js:30-134`) | — | — | — | — | U + R: bơm save v1/v2 → không mất kho, `legacyBackup` có / D |
| Farm: trồng, chăm, hái, máy (`farm/model.js`, `farm/game.js`) | R / M,L,D | R: mẻ đang chạy tiếp tục sau F5 / M | C+R: cây chỉ tính 8 giờ, mẻ máy xong hết (`model.js:241-289`) / M | R+S / M,D | R: kho đầy, hết nước, hết giống / M |
| Chợ và giá giảm theo ngày công (`rules.js:11-15`) | R / M | — | C: `market.day` đổi theo `workDay` / — | S + R / M | C: bán 0 g, số lẻ (`saleQuote`) / — |
| Mở rộng ruộng, AGENTS.md (đi tới biển, xác nhận, thiếu xu) | R / M,D | — | — | R / M | R: không liền kề, thiếu xu → báo số xu thiếu / M |
| Thợ, robot, hợp đồng, sự cố (`farm/crew.js`, `rules.js:83-89`) | — | R: hợp đồng không bị đốt khi F5 / M | C+R: vắng > 60 s → `shiftUntil` bị dời (`model.js:275`) / M | R + `?debug=incident` / M,D | U (`worker-avoidance.test.js`) / — |
| Chuyển farm ↔ cafe (`farm/game.js:768-789`) | R / M,D | R: F5 trong quán → về farm, mất khách và ca (chủ đích) / M | R: ẩn tab trong quán → `service.resume` / M | R+P: vào ra 10 vòng, heap và GPU không tăng / M,D | R: GLB quán chậm, quá 4 s vẫn vào được / M |
| Cafe: hàng chờ, order, bench, bưng, ca 4 phút (`cafe/service.js`, `bench.js`) | R: chế độ học, tối đa 2 khách / M,L,D | — | — | R / M,L,D | R: hết hạt hoặc vật tư; `?debug=grid` route / D |
| Cafe: nhân viên, gear, bàn, robot gift (`model.js:473-575`) | — | R: crew và gear giữ sau F5 / M | C: `paidUntil` dời khi quán đóng (`model.js:278`) / — | R+S / M | R: robot gift không cấp 2 lần / D |
| Thông báo offline (`model.js:287`) | — | — | C: không có UI đọc `progress.offline` (ISS-02) / — | — | — |
| Cài đặt: âm lượng, mute, quality, reset (`ui/settings.js`) | R / M,D | R: settings giữ sau F5 / M | — | — | C+R: tự hạ quality rồi chỉnh âm lượng → quality thấp bị lưu (ISS-01) / M |
| Tự hạ quality theo FPS (`app/game.js:39-58`) | P / M | — | R: tab ẩn rồi hiện lại không bị hạ oan (`dt > .25` reset) / M | P / M | P: CPU throttle 4× / M |
| Render, hiệu năng (draw call, DPR, shadow) | P mỗi màn / M,D | — | — | P: farm và quán / M | P: quality low và high / M |
| Rò rỉ khi chuyển màn (`dispose*`, `keepOnGPU`) | P: selection → intro → heaven → farm / D | — | — | P: farm ↔ cafe ×10 / D | — |
| Input: joystick, chạm, kéo camera, WASD, phím tắt | R / M,L | — | R: blur → `clearInput` / D | R / M,D | R: modal mở → khoá di chuyển (AGENTS.md) / M,D |
| HUD, modal, layout responsive (CSS) | R / M,L,T,D | — | — | R / M,L | R: xoay màn hình khi đang mở modal / M→L |
| Audio (bus, 3D listener) | R / D | R / D | R: tab ẩn / D | — | R: autoplay bị chặn trước gesture / M |
| Tải asset (meshopt, cache, lỗi → khối tạm) | P: `glbinfo.py`, network / M | — | — | — | R: chặn 1 GLB → còn khối tạm, không crash / M |

## Ưu tiên chạy (AI heuristic)

1. A trên M (luồng đầu, mobile-first)
2. B và C cho farm (save và offline là nơi dễ mất dữ liệu nhất)
3. D: farm ↔ cafe ×10, kèm P đo rò rỉ
4. E: storage chặn hoặc hỏng, save cũ
5. Các viewport còn lại
