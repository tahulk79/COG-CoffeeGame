# 04 · Mô phỏng tiến trình

Ngày chạy: 04/11/2026. Mọi bảng dưới đây là **output đo được** khi chạy model thật (`src/features/farm/model.js`) với đồng hồ giả lập. **Không phải human playtest.** Hành vi người chơi trong script là giả định, ghi rõ ở từng mục.

Bằng chứng (`production/audit/evidence/economy/`):
- `balance-sim-{10,30,90,240}.txt`: chạy `EVENTS=1 node scripts/balance-sim.mjs N` (script gốc, không sửa).
- `archetype-sim.mjs` + `archetype-sim-30d.txt`: script mới, 6 kiểu người chơi × 30 ngày thật.
- `sensitivity.txt`: độ nhạy theo thời gian pha và việc có nâng bàn hay không.
- `edge-tests.mjs` + `edge-tests.txt`: thử biên, ROI, công suất.

Chạy lại: `node production/audit/evidence/economy/archetype-sim.mjs all 30`. Tùy chọn: `EVENTS=1`, `BREW=25`, `NOCAFEUP=1`.

## 1. Script gốc `scripts/balance-sim.mjs`

| Phút chơi | Tiền cuối | Cấp | Thu chợ | Thu quán (ly + ca) | Chi nâng cấp + thiết bị | Ly bán / khách đến / bỏ về |
|---|---|---|---|---|---|---|
| 10 | 196 | 5 | 169 | 130 + 76 | 0 | 19 / 21 / 0 |
| 30 | 1 045 | 9 | 1 595 | 414 + 213 | 430 | 58 / 69 / 0 |
| 90 | 922 | 15 | 7 055 | 1 374 + 600 | 6 795 | 180 / 272 / 52 |
| 240 | 672 | 25 | 22 559 | 3 837 + 1 717 | 24 736 | 479 / 870 / 277 |

**Script này đã lỗi thời so với luật hiện tại. Không nên dùng số của nó để chốt cân bằng:**
- Khoảng cách khách tính bằng `13 − …` và kẹp tối đa 18 (balance-sim.mjs:70). Code thật dùng `9 + max(0, 13 − 6,5·helpers) − …` và kẹp 24 (service.js:501). Khi tự pha một mình, script cho khách đến dày gần gấp đôi.
- Mục tiêu ca trong script là `6 + 2·hạng` (balance-sim.mjs:85). Code thật dùng `4 + hạng + 6·helpers` (service.js:441).
- Trong ca quán, người chơi vẫn chăm farm (`farmStep()` gọi trong vòng lặp ca), và mỗi giây làm được mọi thao tác. Thời gian pha giả định 12 s/ly.
- Dùng `Math.random`, nên mỗi lần chạy ra số khác nhau.

Điểm chung với sim mới: tiền chợ chiếm ≈ 80 % thu nhập, và tiền đổ gần hết vào Sân phơi, Kho, Lò rang — những thứ có ROI ≈ 0 (03 §D).

## 2. Sáu kiểu người chơi (`archetype-sim.mjs`)

Giả định chung, đều là **AI heuristic**:
- Mỗi phiên chơi xen kẽ 6 phút farm rồi 1 ca quán 4 phút.
- Thao tác farm tốn thời gian bằng thời lượng việc (theo `workDuration`) cộng 2 s đi bộ.
- Khách bỏ về nếu chờ quá 90 s.
- Quán không có nhân viên; khách đến và mục tiêu ca theo đúng công thức của `service.js`.
- Giữa các phiên, đồng hồ nhảy, và model tự tính thời gian vắng mặt (trần 8 giờ).
- Bắt đầu bằng save mới với quà `capital`, tức 350 xu.

| Kiểu | Phiên chơi | Pha (s/ly) | Điểm pha | Cách bán | Cách nâng cấp |
|---|---|---|---|---|---|
| casual | 10 phút/ngày | 35 | 75 (2★) | chợ | rẻ nhất trước (kho/sân/lò/quán + thiết bị) |
| regular | 30 phút/ngày | 30 | 80 | chợ | như trên |
| engaged | 3 × 30 phút/ngày | 25 | 85 | chợ, có tỉa | như trên |
| min-max | 3 × 30 phút/ngày | 20 | 92 (3★) | Đơn cố định trước rồi chợ, Mít kín farm, có tỉa | chỉ món có ROI: thiết bị quán, Góc rang, quán, lò rang ≤ 2 |
| rich (giàu) | 30 phút/ngày | 30 | 80 | chợ | mua mọi thứ mở được; **set sẵn 1 000 000 xu** (hack audit, vì game không có IAP) |
| irregular | 30 phút vào các ngày 1, 2, 5, 6, 10, 14, 15, 21, 28, 30 | 30 | 80 | chợ | rẻ nhất trước |

### Kết quả ngày 1 / 3 / 7 / 14 / 30

`net_value` = xu đang có + xu đã đầu tư vào tài sản một lần. `món` = số món đang bán được (bị khóa lại nếu uy tín tụt).

| Kiểu | Ngày | Phút đã chơi | Xu | net_value | Cấp | Uy tín | Món | Ly bán / bỏ về |
|---|---|---|---|---|---|---|---|---|
| casual | 1 | 10 | 224 | 514 | 4 | 49 | 2 | 5 / 2 |
| | 3 | 30 | 185 | 475 | 6 | 42 | 2 | 14 / 8 |
| | 7 | 70 | 194 | 784 | 7 | 34 | 2 | 33 / 18 |
| | 14 | 140 | 1 030 | 2 140 | 9 | 29 | 3 | 67 / 33 |
| | 30 | 300 | 1 327 | 5 346 | 13 | **11** | 7 | 143 / 73 |
| regular | 1 | 30 | 247 | 537 | 6 | 58 | 4 | 20 / 3 |
| | 3 | 90 | 807 | 1 737 | 9 | 65 | 5 | 58 / 12 |
| | 7 | 210 | 2 344 | 4 905 | 12 | 59 | 9 | 130 / 38 |
| | 14 | 420 | 496 | 10 657 | 17 | 43 | 7 | 256 / 89 |
| | 30 | 900 | 340 | 23 553 | 24 | **31** | 7 | 544 / 205 |
| engaged | 1 | 90 | 1 427 | 2 357 | 10 | 100 | 6 | 80 / 1 |
| | 3 | 270 | 3 679 | 7 698 | 14 | 96 | 11 | 237 / 9 |
| | 7 | 630 | 629 | 17 207 | 21 | 77 | 11 | 509 / 96 |
| | 14 | 1 260 | 1 513 | 34 148 | 28 | 71 | 11 | 979 / 257 |
| | 30 | 2 700 | 4 450 | 74 035 | 41 | 72 | 11 | 2 046 / 637 |
| min-max | 1 | 90 | 2 317 | 3 337 | 10 | 100 | 7 | 99 / 0 |
| | 3 | 270 | 573 | 10 468 | 15 | 99 | 11 | 297 / 1 |
| | 7 | 630 | 14 999 | 24 894 | 22 | 100 | 11 | 689 / 23 |
| | 14 | 1 260 | 40 167 | 50 062 | 31 | 98 | 11 | 1 369 / 69 |
| | 30 | 2 700 | **98 394** | 108 289 | 45 | 100 | 11 | 2 931 / 171 |
| rich | 1 | 30 | 988 917 | 999 379 | 7 | 33 | 7 | 15 / 13 |
| | 7 | 210 | 861 324 | 1 004 189 | 13 | 11 | 7 | 104 / 101 |
| | 30 | 900 | 359 565 | 1 022 294 | 24 | **11** | 7 | 437 / 452 |
| irregular | 1 | 30 | 247 | 537 | 6 | 58 | 4 | 20 / 3 |
| | 3 | 60 | 412 | 1 102 | 8 | 66 | 4 | 40 / 6 |
| | 7 | 120 | 1 743 | 2 953 | 10 | 67 | 7 | 77 / 17 |
| | 14 | 180 | 2 481 | 4 501 | 12 | 63 | 10 | 113 / 31 |
| | 30 | 300 | 2 727 | 7 755 | 15 | 61 | 10 | 186 / 56 |

### Cơ cấu thu nhập sau 30 ngày (xu)

| Kiểu | Chợ | Đơn cố định | Ly | Thưởng ca | Phần chợ | net_value / phút chơi |
|---|---|---|---|---|---|---|
| casual | 4 404 | 0 | 1 152 | 246 | 76 % | 17,8 |
| regular | 18 774 | 0 | 4 606 | 1 139 | 77 % | 26,2 |
| engaged | 54 193 | 0 | 17 943 | 4 341 | 71 % | 27,4 |
| min-max | 72 333 | 32* | 29 944 | 8 815 | 65 % | 40,1 |
| irregular | 6 669 | 0 | 1 564 | 231 | 79 % | 25,9 |

\* Min-max chỉ giao được 1 Đơn cố định. Đơn tiếp theo là Chè, mà min-max trồng toàn Mít, nên kẹt (xoay vòng theo giống, 03 §C3). Khi đủ 3 giống thì đơn lặp được vô hạn (đo riêng: 60 đơn liên tiếp).

Nhãn mốc ca (Không đạt / Đồng / Bạc / Vàng) trong 30 ngày: regular 33/49/8/0, engaged 86/184/0/0, min-max 0/268/2/0.

## 3. Phát hiện tiến trình

| Mức | Phát hiện | Bằng chứng |
|---|---|---|
| P1 | **Hết nội dung rất sớm.** Engaged mở đủ 11/11 món ngày 2 (126 phút); min-max mua hết mọi thứ có ROI ở ngày 3 (266 phút). Sau đó net_value của min-max đứng yên ở 9 895 xu đầu tư, xu dồn lên 98 394 vào ngày 30. Phần còn lại chỉ là tăng số cấp công trình | archetype-sim-30d.txt, bảng min-max |
| P1 | **Uy tín tụt làm khóa lại món.** Regular có 9 món ở ngày 7 nhưng chỉ còn 7 ở ngày 14 (uy tín 59 → 43; Bạc xỉu/Phin mít cần 55, CF trứng 60, CF muối 65). Casual tụt về uy tín 11 ở ngày 30 (sàn là 10). Người chơi thấy mình **mất** nội dung khi chơi tiếp | recipes.js:167, :176, :206, :220; bảng trên |
| P1 | **Nâng bàn là bẫy cho người chơi solo.** Regular không nâng quán/bàn (`NOCAFEUP=1`): uy tín ngày 30 là **74**, net_value 22 827. Có nâng: uy tín **31**, net_value 23 553. Nâng chỉ thêm ≈ 3 % net_value nhưng mất 43 uy tín và 4 món | sensitivity.txt; service.js:501 |
| P1 | **Có ngưỡng gãy theo thời gian pha** (casual, 30 ngày): 20 s → uy tín 100, 0 bỏ về; 25 s → 100, 12 bỏ về; 30 s → 60, 56 bỏ về; **35 s → 11, 73 bỏ về**. Tài liệu ghi một ly tự pha mất ≈ 25–35 s (cafe-fun-review.md:65), tức đúng vào vùng gãy | sensitivity.txt |
| P2 | **Khoảng chết của casual:** từ ngày 2 (13,7 phút) đến ngày 7 (60 phút) không có mua sắm hay mở khóa nào, chỉ lên cấp 5→7. Cơ chế mở theo cấp hết ở cấp 4 (Mít ở cấp 3, nút HUD ở cấp 4) | archetype-sim-30d.txt (EVENTS); content.js:5, :87–95 |
| P2 | Cấp farm chỉ còn để mở trần nâng cấp (cấp công trình ≤ cấp farm, rules.js:36). Regular đạt cấp 20 ở ngày 20, engaged ngày 7, min-max ngày 6. Từ cấp 21 trở lên không mở gì mới (MAX_LEVEL 999) | content.js:97; archetype EVENTS |
| P2 | Người chơi giàu không tiêu nhanh được: mọi nâng cấp bị khóa theo cấp farm, nên tới ngày 30 mới tiêu hết 662 729 xu (tất cả công trình lên cấp 20 / quán 10). Mua hết bàn và kiosk từ ngày 1 làm khách đến dày, uy tín rơi về 11 (vì sim không chạy agent nhân viên, mục 5) | bảng rich |
| P3 | Chơi thất thường không bị phạt: net_value mỗi phút chơi của irregular (25,9) ngang regular (26,2). Lý do: cây chín trong lúc vắng (tối đa 1 vụ/cây) và mẻ chế biến vẫn chạy | bảng trên; 03 §C7 |
| P3 | Không thấy kẹt tiến trình trong 6 kiểu chơi. Kẹt vĩnh viễn chỉ xảy ra ở trạng thái 0 xu + 0 cây (03 §C6) | edge-tests.txt §5 |

## 4. Mốc thời gian (phút chơi tích lũy, từ log EVENTS)

| Mốc | casual | regular | engaged | min-max |
|---|---|---|---|---|
| Cấp 3 (Mít) | 1,6 | 1,6 | 1,6 | 1,6 |
| Ruộng 4 | 60 (ngày 7) | 40 (ngày 2) | 40 (ngày 1) | 30 (ngày 1) |
| Món trứng/muối | chưa mở trong 30 ngày (uy tín < 60) | 66 | 66 | 56 |
| Máy espresso (4 món) | 156 (ngày 16) | 126 (ngày 5) | 126 (ngày 2) | 96 (ngày 2) |
| Cấp 10 | 141 | 101 | 86 | 76 |
| Cấp 20 | – (ngày 30 mới cấp 13) | 573 (ngày 20) | 556 (ngày 7) | 470 (ngày 6) |

## 5. Giới hạn của mô phỏng
- **Không có nhân viên** (thợ farm, barista, robot espresso, kiosk). Trong game thật, có tay pha thì mục tiêu ca cộng 6 và khách đến nhanh hơn 6,5 s mỗi helper (service.js:441, :501). Vì vậy kết quả quán của rich và min-max ở giai đoạn sau là **cận dưới**.
- Thời gian pha, thời gian chờ tối đa 90 s và thời gian đi bộ là **AI heuristic**. Thứ tự món theo random có seed cố định, nên chạy lại ra đúng số.
- Tiền nhiệm vụ (tổng 90 xu) được cộng vào thao tác kích hoạt nó, không tách thành cột riêng.
- Người chơi ảo không mắc lỗi thao tác, không đọc UI và không bị mất phiên giữa chừng.

## 6. Đề xuất chỉnh tiến trình (chưa áp dụng; xem thêm 03 §G)

| Ưu tiên | Đường cũ → mới | file:dòng | Kiểm chứng bằng |
|---|---|---|---|
| 1 | Uy tín tụt **không** khóa lại món đã mở: thêm `cafe.unlocked[]`, `lockReason` bỏ qua điều kiện uy tín cho món đã mở | recipes.js:249–253 | `archetype-sim regular`: số món không giảm sau ngày 7 |
| 2 | Bàn chỉ làm khách đến nhanh hơn khi có helper: `- tables*.6` → `- max(0,tables-3)*.6*min(1,helpers)` | service.js:501 | `regular` (không đặt `NOCAFEUP`): uy tín ≥ 60 ở ngày 30 |
| 3 | Nới ngưỡng gãy cho solo: `PATIENCE.queue 55 → 70`, hoặc thêm 4 s vào khoảng khách khi helpers = 0 (`9 + 13` → `9 + 17`) | service.js:57, :501 | `BREW=35 casual`: uy tín ≥ 50 |
| 4 | Lấp khoảng chết ngày 2–7 của casual: thêm mốc mở theo cấp 5–8 (vd. Máy espresso ở cấp 6 với giá 60), hoặc nhiệm vụ chuỗi 2 sau khi "Mua ruộng thứ hai" | content.js:73–95, recipes.js:19 | log EVENTS: casual có ≥ 1 mốc mới mỗi ≤ 2 ngày |
| 5 | Cập nhật `scripts/balance-sim.mjs` theo công thức khách và mục tiêu ca hiện tại, đặt seed cho random, và không chăm farm khi đang ở quán | balance-sim.mjs:66–85 | so với output archetype-sim |
| 6 | Nơi tiêu cuối game có lặp lại (sau khi sửa 03 G1/G2): món mùa hoặc sự kiện quán tốn hạt farm, đặt giá theo cấp | – | min-max: xu ngày 30 < 30 % net_value |
