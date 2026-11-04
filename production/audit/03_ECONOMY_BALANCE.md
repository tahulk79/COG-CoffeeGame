# 03 · Kinh tế & cân bằng

Ngày soát: 04/11/2026 · Nhánh `audit/game-studio-playtest-optimization` · Chỉ đọc code và chạy mô phỏng; **không sửa code game**.
Khung: skill `/balance-check`. Bằng chứng nằm trong `production/audit/evidence/economy/`. Đây **không phải human playtest**. Số liệu có 3 loại: (a) đọc từ code, ghi file:dòng; (b) đo bằng script chạy model thật; (c) ước lượng, có ghi "ước lượng" hoặc nhãn **AI heuristic**.

## Kết luận: **NGHIÊM TRỌNG**

1. **Đơn cố định ở Chợ lặp được không giới hạn**, giá 1,2 × giá gốc và **không bị trừ giá khi chợ bão hòa**. Nó áp đảo cách bán ở chợ: cùng 12 kg hạt rang thì được **1 280 xu, so với 594 xu** nếu bán chợ (đo được, mục C3).
2. **Không có nơi tiêu có ích cho tiền dư.** Với người chơi tối ưu, đồ đáng mua đã hết từ **ngày 3**. Đến ngày 30 họ giữ **98 394 xu** không biết tiêu vào đâu (đo được). Ngược lại, 653 689 xu nâng cấp công trình gần như không trả lại gì (mục D).
3. **Nâng "Thiết bị quán" (thêm bàn) hại người chơi tự pha một mình.** Khách đến dày hơn nên bỏ về nhiều hơn, uy tín tụt và các món cần uy tín bị khóa lại. Cùng người chơi 30 phút/ngày, đến ngày 30: có nâng thì uy tín còn **31**, không nâng thì giữ **74** (đo được).
4. **Farm áp đảo quán.** Với mọi kiểu người chơi, bán ở chợ chiếm khoảng 65–80 % thu nhập. Thêm nữa, quán có thể bỏ farm mà vẫn lời nhờ nhập hạt ngoài (C4), làm lung lay trụ cột "hai màn phụ thuộc nhau".

## A. Nguồn dữ liệu (`CÓ` = đã đọc)

| Nguồn | | Ghi chú |
|---|---|---|
| `src/features/farm/content.js` | CÓ | CROPS :2–6, FIELDS giá :33, MACHINES :43–44, PRODUCTS giá :54–59, QUESTS :73–83, LEVEL_XP :7, xpForLevel :97 |
| `src/features/farm/rules.js` | CÓ | DAY_MS :2, CAFE_SHIFT_MS :7, FERTILIZER_PRICE :9, SUPPLIER_PRICE :10, MARKET_DAILY + đường giá :13–15, ASSETS :16–27, upgradePrice :34, workerWage :78 |
| `src/features/farm/model.js` | CÓ | mọi `money(...)`; `makeOrder` :225; market `order` :670–673; `sell` :674–680; cafe `sell` :506–518; `shift` :554–563; offline `advance` :241–289 |
| `src/features/farm/orders.js` | CÓ | chỉ tính bước sản xuất, không có tiền |
| `src/features/farm/decorations.js` | CÓ | 25/40/30 xu, không tác dụng gameplay |
| `src/features/cafe/recipes.js` | CÓ | SUPPLIES :4–13, GEAR :16–33, STAFF_ROLES :40–46, staffWage :100, trainCost :101, TABLE_LEVELS :104–109, OWN_CUP :111, RECIPES :154–243 |
| `src/features/cafe/service.js` | CÓ | khoảng cách khách :501, mục tiêu ca :441, PATIENCE :57 |
| `docs/design/cafe-fun-review.md`, `cafe-gameplay.md` | CÓ | khoảng mục tiêu chỉ có cho quán (núm P1–P6); **farm không có khoảng mục tiêu** |
| `src/features/farm/crew.js` (AI thợ), agent nhân viên quán | KHÔNG mô phỏng | xem mục "Không đánh giá được" |

## B. Nguồn vào / nơi tiêu (từ code)

### Nguồn vào
| Nguồn | Công thức | file:dòng |
|---|---|---|
| Bán chợ | `gram × giá SP × priceScale × (0,7 + 0,3·Q/100)`, qua đường bão hòa theo ngày công 6 phút: 100 % giảm dần tới sàn 30 % sau khi bán 840 xu gốc | model.js:309, rules.js:13–15 |
| Đơn cố định (Chợ) | 200 g hạt rang → `round(200·0,07·priceScale·1,2)` = **17 / 22 / 25 xu** (vối/chè/mít), +14 XP, xong là có đơn mới ngay, **không có hạn chờ và không tính vào mức bão hòa** | model.js:225, :670–673; UI game.js:183, :395 |
| Bán ly | `giá × (0,6 + 0,4·Q) × 1,3 nếu món của ca × 1,1 nếu có Góc rang × 2 nếu bạn tự pha` + tip `giá × (0,15·(sao−1) + 0,1·(1−chờ) + 0,04·combo + bàn + charm)` | model.js:514 |
| Thưởng ca | `min(300, ly × [0,3,4,5][mốc])`; mốc Đồng = `4 + hạng + 6·helpers` | model.js:557–560, service.js:441 |
| Nhiệm vụ | tổng 90 xu, một lần | content.js:73–83 |
| Quà thiên đàng | `capital` +150 xu, hoặc `seeds`, hoặc `tools` | model.js:173 |
| Mẹo `costs` | +30 xu, một lần | model.js:182 |
| Hoàn tiền khi tải save cũ | phí tuyển, cá 8 xu/con | model.js:165, :169 |

### Nơi tiêu
| Nơi tiêu | Giá | Loại | file:dòng |
|---|---|---|---|
| Cây giống | 10 / 20 / 30 | gần như một lần (cây lâu năm) | content.js:3–5 |
| Phân bón | 1 xu/túi | tiêu hao | rules.js:9 |
| Ruộng 2–4 | 120 / 180 / 300 | một lần | content.js:33 |
| Nâng cấp 10 công trình | `base·1,42^(lv−1)`, từ cấp 10 tăng bậc hai; trần cấp 20 (quán 10); cần farm cấp ≥ cấp đích | một lần, tổng **653 689** | rules.js:34–36 |
| Thiết bị quán (GEAR) | tổng **3 650** | một lần | recipes.js:16–33 |
| Nâng bàn | 60/120/220 × 12 bàn = **4 800** | một lần | recipes.js:104–109 |
| Vật tư quán | ly 0,1 · sữa đặc 0,02/ml · sữa tươi 0,005/ml · đá 0,001/g … | tiêu hao | recipes.js:4–13 |
| Nhập hạt ngoài | 75 xu/500 g | tiêu hao | rules.js:10, model.js:485–488 |
| Cước giao | 2 xu/chuyến | tiêu hao | model.js:374, :484 |
| Thợ farm | phí tuyển 150–180; lương `30 + 10·(cấp−1)`/ngày công 6 phút; robot 15/ngày, gói 5/10 ngày giảm 10/25 % | tiêu hao | rules.js:48–61, :78–81 |
| Đào tạo thợ farm | `40 × cấp` (cấp 1→10: 1 800/người) | một lần | model.js:449 |
| Nhân viên quán | lương mỗi ca 4 phút: thu ngân/phục vụ 6, barista 12, tạp vụ 5, quản lý 15 (+25 %/cấp); robot 3 | tiêu hao | recipes.js:40–46, :100 |
| Đào tạo nhân viên quán | `40 × cấp` (1→5: 400/người) | một lần | recipes.js:101 |
| Trang trí | 25–40/món, tối đa 100 món | một lần, không có tác dụng | decorations.js:2–6 |
| Bảo trì hàng rào | 5 xu | gần như không bao giờ cần (mục D) | model.js:591 |

## C. Đo được (script chạy model thật)

### C1. Giá trị một cây trong một vụ (`edge-tests.txt` §1; hạt rang chất lượng 80, chợ chưa bão hòa)
| Giống | Mở ở cấp | Hạt rang/vụ (có bón) | Xu/vụ | **Xu/phút** | Lợi từ 1 xu phân |
|---|---|---|---|---|---|
| Vối | 1 | 462 g | 30,4 | 5,07 | ×5,5 |
| Chè | 2 | 400 g | 34,3 | 5,71 | ×6,2 |
| Mít | 3 | 524 g | 51,7 | **7,83** | ×9,4 |

- **Mít trội hơn Chè ở mọi mặt:** xu/phút cao hơn 37 %, gram/phút 79 so với 67. Chè chỉ có một lợi thế: món espresso không bị −5 điểm vì sai hạt (model.js:504).
- **Phân bón luôn có lời gấp 5–9 lần**, nên đây không phải một lựa chọn. Không bón còn bị phạt ×0,9 (model.js:264).
- **Tỉa cành** không tốn gì mà thêm 5 % sản lượng và +5 chất lượng, nên luôn nên làm.

### C2. Chợ bão hòa (§2)
Bán 840 xu gốc trong một ngày công thì nhận 546 xu (65 %); bán 4 000 xu gốc thì nhận 1 494 xu (37 %). Farm đủ 48 cây vối có bón phân làm ra khoảng 1 459 xu gốc mỗi vụ, tức **vượt trần chợ từ ruộng thứ 3**.

### C3. Đơn cố định lặp lại (§3) — **lựa chọn áp đảo**
- Có đủ 3 giống, mỗi giống 4 kg, farm cấp 4: **lặp được 60 đơn liên tiếp, +1 280 xu**. Bán 12 kg đó ở chợ trong cùng ngày công chỉ được **594 xu** (bằng 2,15 lần).
- XP: mỗi 200 g được 14 XP; bán chợ chỉ khoảng 4,8 XP cho mỗi 200 g.
- Giới hạn duy nhất: đơn xoay vòng theo giống, nên **thiếu một giống là kẹt** ("kẹt ở đơn arabica sau 1 lần"). Đơn chưa nhận thì không bao giờ hết hạn (model.js:246 chỉ xét đơn đã `accepted`).

### C4. Quán chạy bằng hạt nhập ngoài, không cần farm (§4)
Nhập 500 g giá 75 xu, tự pha với điểm 80: phin đen lời **+2,05 xu/ly**, sữa đá +2,49, bạc xỉu **+3,77** (vì món này chỉ tốn 10 g hạt). Quán vẫn lời khi không cần farm. Lý do là `OWN_CUP = 2` (recipes.js:111) nhân đôi giá. Như vậy chú thích "outside beans cost more than farm beans so the café still needs the farm" ở rules.js:8 không còn đúng. Bị giới hạn chỉ bởi thời gian và số khách, nên **chưa phải vòng in tiền vô hạn**.

### C5. Công suất trạm so với sản lượng farm tối đa (§7)
Farm tối đa (48 cây vối có bón) ≈ 26 400 g quả/phút, ra ≈ 4 400 g nhân/phút.
- **Sân phơi cấp 1 đã xử lý được 36 000 g/phút**, đủ cho cả farm, nên nâng cấp 2–20 **không thêm sản lượng** mà chỉ rút ngắn thời gian chờ.
- **Lò rang** cấp 1 xử lý 3 333 g/phút, cấp 2 xử lý 4 209, cấp 3 xử lý 5 168. Từ cấp 3 trở đi không còn là nút cổ chai. Mẻ cũng chạy tiếp khi vắng mặt (hàng chờ 48 mẻ), nên kể cả cấp 1 vẫn theo kịp nếu bạn chơi theo phiên.

### C6. Kẹt khi hết sạch (§5)
Trạng thái: 0 xu, không còn cây, không còn hạt giống, không có hàng, quán không có hạt hoặc ly. Mọi cách kiếm tiền đều bị từ chối, và sau 8 giờ vắng mặt vẫn còn 0 xu. Để rơi vào đây, người chơi phải tự "Cuốc bỏ cây" (game.js:142, model.js:600) và tiêu hết tiền, nên **hiếm nhưng là kẹt vĩnh viễn**.

### C7. Vắng mặt 8 giờ (§6)
Cả 12 cây đều chín, sức khỏe còn khoảng 78–79, sản lượng giảm còn khoảng 2 400 g/cây (thay vì 3 000). Thời tiết của cả khoảng vắng mặt chỉ được lấy ở **một thời điểm, lúc người chơi quay lại** (model.js:248, :255). Tùy phút quay lại, nước trong ruộng là 100 hoặc 0. Hiện tại ảnh hưởng đến sản lượng nhỏ (≤ 1 %), nhưng đây là luật không ổn định.

## D. Lợi nhuận ròng và ROI từng nâng cấp

Định nghĩa: **net_value = xu đang có + tổng xu đã đầu tư vào tài sản một lần** (ruộng, nâng cấp, thiết bị, bàn). ROI = thu thêm mỗi ngày / giá. Thu thêm được đo bằng sim khi có thể; còn lại là ước lượng.

| Hạng mục | Tổng giá | Tác dụng thật | ROI | Kết luận |
|---|---|---|---|---|
| Ruộng 2 (120) | 120 | +12 cây ≈ +365 xu gốc/vụ | hoàn vốn < 1 vụ | **rất tốt** |
| Ruộng 3–4 (480) | 480 | +24 cây, nhưng chợ đã bão hòa (C2) | thấp nếu chỉ bán chợ; cao nếu dùng Đơn cố định hoặc quán | tốt, bị chợ chặn |
| Phân bón | 1/túi | ×1,22 sản lượng | ×5,5–9,4 | luôn mua, không phải lựa chọn |
| Sân phơi 2→20 | 75 579 | không thêm sản lượng (C5) | **0** | bẫy tiền |
| Lò rang 2–3 | 160 + 228 | gỡ nút cổ chai khi farm đầy | dương | đáng mua |
| Lò rang 4→20 | ≈ 120 500 | không thêm sản lượng | **0** | bẫy tiền |
| Kho 2→20 | 68 019 | chỉ giúp tích trữ; mỗi lần hái tối đa 3,3 kg | ≈ 0 sau cấp 2–3 (ước lượng) | thừa |
| Vận chuyển 2→20 | 75 579 | mỗi chuyến chở 1 → 4,4 kg; cước chỉ 2 xu | ≈ 0 | thừa |
| Hàng rào 2→20 | 60 465 | độ bền tụt từ 100 xuống 25 mất **750 000 giây ≈ 208 giờ** (model.js:250); sửa 5 xu | **≈ 0** | thừa |
| Đất, Ao, Giếng, Dụng cụ | 68k / 76k / 45k / 57k | chỉ đỡ thao tác (ít tưới, ít lấy nước); không đổi ra xu | không đo được bằng xu | QoL, quá đắt |
| Thiết bị quán (bàn) 2→10 | 7 495 | khách đến nhanh hơn 0,6 s mỗi bàn (service.js:501) | **âm khi tự pha một mình** (đo được: uy tín 31 so với 74) | bẫy với người chơi solo |
| Máy espresso / Ca sữa / Máy đánh trứng / V60 | 120 / 60 / 70 / 90 | mở 2 + 2 + 2 + 1 món, giá trung bình mỗi ly tăng | dương: hoàn vốn ≈ 1–3 ngày (regular, ước lượng) | đáng mua |
| Phin cấp 2–3, Máy xay cấp 2–3 | 130 / 240 | +4 / +3 chất lượng, nên giá mỗi ly tăng khoảng 0,06–0,08 xu | hoàn vốn sau ≈ 500–1 300 ly | yếu |
| Góc rang | 300 | +10 % giá (không tính tip) | ước lượng: regular ≈ 23 ngày, min-max ≈ 3,5 ngày | chỉ đáng khi pha nhiều |
| Sân vườn | 400 | +2 bàn ngoài trời | âm khi solo (giống Thiết bị quán) | bẫy với solo |
| Robot espresso, trạm pha, kiosk… | 350 / 410 / 500 … | có tác dụng qua helper hoặc agent | **chưa đo** (sim không chạy agent) | — |
| Thợ farm, nhân viên quán | xem B | tự động hóa | **chưa đo** | — |

## E. Chiến lược áp đảo / vòng lặp

| Mức | Phát hiện | Bằng chứng |
|---|---|---|
| P1 | Đơn cố định lặp vô hạn, giá 1,2 × và không bị trần chợ chặn | C3; model.js:225, :670–673 |
| P1 | Mít trội hơn Chè ở mọi mặt; trồng Mít kín farm là tối ưu khi bán chợ | C1 |
| P2 | Phân bón và tỉa cành là việc bắt buộc, không phải lựa chọn | C1; model.js:264 |
| P2 | Quán lời với hạt nhập ngoài, nên không thật sự cần farm | C4 |
| P2 | Ly tự pha = 2 × giá ly nhân viên, kèm thưởng ca tới 5 xu/ly; người chơi pha nhanh thì quán mạnh hơn hẳn | model.js:514, :559 |
| P3 | Giá bán ly không phụ thuộc giống (chỉ −5 điểm nếu sai hạt), nên ở quán giống nào cũng như nhau | model.js:504, :514 |

## F. Ngoại lệ so với mục tiêu tài liệu
- Quán (`cafe-fun-review.md`): tài liệu viết "Solo, uy tín 50 → khách ≈ mỗi 20 s; Đồng 7 ly". Code đúng như vậy (service.js:441, :501). Riêng trần thưởng ca 300 còn chờ sim (dòng 222 của tài liệu). Kết quả sim: thưởng ca chiếm 13–23 % thu nhập quán và **chưa lần nào chạm trần 300**, kể cả min-max (bạc 268/270 ca). Mốc Vàng cho người chơi solo gần như không đạt được (min-max chỉ có 2/270 ca Vàng).
- Farm: **chưa có khoảng mục tiêu, nên không phán xét** giá, thời gian vụ hay XP.
- Công cụ đo `scripts/balance-sim.mjs` **đã lỗi thời so với luật hiện tại** (xem 04 §1): còn dùng công thức khách cũ và mục tiêu ca cũ.

## G. Đề xuất (chưa áp dụng)

| Ưu tiên | Vấn đề | Đường cũ → mới | Hằng số / file:dòng | Tác động mong đợi |
|---|---|---|---|---|
| 1 | Đơn cố định lặp vô hạn | Có đơn mới ngay sau khi giao → mỗi ngày công 1 đơn (đơn mới mở sau `WORK_DAY_MS`); hoặc tính `base` của đơn vào `market.sold` | model.js:673 (`progress.order=makeOrder(at)`) | đưa đơn về vai "thưởng nhỏ"; chợ bão hòa có tác dụng trở lại |
| 2 | Tiền dư không có nơi tiêu | Sân phơi, Kho, Vận chuyển, Hàng rào: cắt trần còn 5–8, hoặc gắn tác dụng thật (vd. Sân phơi cấp cao +chất lượng hoặc +giá; Kho cấp cao giảm hao quả). Thêm nơi tiêu có lặp lại gắn với quán (món mùa, sự kiện) | rules.js:16–30, :34 | 653k xu tiêu có ý nghĩa, hoặc giảm chi phí vô ích |
| 3 | Thêm bàn hại người chơi solo | `- tables*.6` → `- max(0, tables - 3)*.6*min(1, helpers)` (thêm bàn chỉ làm khách đến nhanh hơn khi có tay pha) | service.js:501 | giữ uy tín người chơi solo; bàn vẫn có giá trị khi có đội |
| 4 | Mít trội hơn Chè | Chè `priceScale 1.3 → 1.45` hoặc `regrowMs SEASON_MS → 0.85×` | content.js:4 | 3 giống đều có lý do để trồng |
| 5 | Quán không cần farm | `SUPPLIER_PRICE 75 → 110`, hoặc lô nhập ngoài chất lượng 65 → 50 | rules.js:10, model.js:488 | hạt farm rẻ hơn rõ rệt; giữ đúng trụ cột |
| 6 | Kẹt vĩnh viễn khi 0 xu và không cây | Nếu 0 cây, 0 hạt và < 10 xu thì tặng 1 cây vối (hoặc cấm cuốc cây cuối cùng) | model.js:600 | không thể kẹt |
| 7 | Thời tiết vắng mặt lấy 1 điểm | Tính phần mưa theo tỷ lệ 2/7 cho cả khoảng vắng | model.js:248, :255 | kết quả không phụ thuộc phút quay lại |

## Không đánh giá được
- **Thợ farm và nhân viên quán**: AI nằm trong scene (`crew.js`, agent ở `service.js`), không có trong model. Vì vậy chưa đo ROI lương, gói robot, robot espresso, trạm pha hay kiosk.
- **Thời gian pha thật của người chơi** (20–35 s/ly) chỉ là giả định (**AI heuristic**). Kết quả quán nhạy với số này (04 §4).
- Trang trí không có tác dụng gameplay, chỉ để tiêu tiền.

Bước tiếp theo theo `/balance-check`: chọn sửa ưu tiên 1 (giao game-designer cập nhật spec rồi dev chỉnh hằng số), lưu báo cáo vào `docs/design/balance-...`, hay dừng — **để người dùng quyết**.
