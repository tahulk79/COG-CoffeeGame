# Cấp độ dẫn đường: mỗi cấp mở một thứ (Round 1)

> Bản đề xuất để review (2026-11-06). Chưa code. Phạm vi: Round 1 (chơi 1 game: Nông trại **hoặc** Quán, Lv10 = sự cố).
> Số liệu hiện tại lấy từ `src/core/config/economy.js`.

## 1. Hiện trạng: lên cấp gần như không cho gì

| Mục | Hiện tại | Vấn đề |
|---|---|---|
| Đường cấp | Lv1 → Lv10 cần 920 XP. Mô phỏng: chỉ trại ≈ 20 phút, chỉ quán ≈ 22–30 phút → **khoảng 2–3 phút một cấp** | Ổn, giữ nguyên |
| Khi lên cấp | Chỉ hiện banner "Cấp N!" kèm danh sách thứ vừa mở | **Không có quà** |
| Thứ mở theo cấp – Trại | Lv1 Robusta · Lv2 Máy phơi, hoa, chậu cây · Lv3 Arabica, đèn | **Lv4 → Lv9 không mở gì** |
| Thứ mở theo cấp – Quán | Lv1 Espresso · Lv2 Sữa, Bàn ghế, hoa, chậu cây · Lv3 đèn · Lv5 Latte | **Lv6 → Lv9 không mở gì**. Ki-ốt (Lv10) và Tủ bánh (Lv12) **không bao giờ dùng được**, vì Lv10 là sự cố |
| Người hỗ trợ | 2 loại mỗi game (Trại: Nông dân, Sprout Bot · Quán: Barista, Brew Bot). Thuê được ngay từ Lv1, không giới hạn số lượng; tối đa 3 người làm việc mỗi khu | Không gắn với cấp độ. Có tiền là thuê đủ 3 người ngay từ đầu |
| Thử nghiệm | Đang bật PLAYTEST: 9 999 999 xu | Quà xu và giá thuê **không test được** khi còn bật mức xu này |

**Kết luận:** cấp độ đang chỉ là con số. Từ Lv4 trở đi người chơi không có mốc nào để chờ. Cơ chế "mỗi cấp một người
hỗ trợ + một phần quà" lấp đúng khoảng trống này.

## 2. Đề xuất: 3 luật

### Luật 1 · Mỗi cấp được thuê thêm 1 người hỗ trợ

- **Số người tối đa = cấp − 1.** Lv1: 0 người (tự làm để học cách chơi), Lv2: 1 người, …, Lv9: 8 người.
- Bỏ giới hạn cố định "3 người mỗi khu". Số người được làm việc chính là số suất đã mở.
- Mỗi suất thuê **1 người, chọn loại tuỳ ý** trong các loại của game đang chơi (nhân viên hoặc robot đã mở).
- Lên cấp mà chưa thuê thì suất vẫn giữ (chấm đỏ ở nút Nhân viên nhắc "Còn 1 suất").
- Giá thuê giữ như bảng giá hiện tại. Cấp độ chỉ quyết định **được thuê bao nhiêu người**, còn tiền quyết định **thuê ai**.
- Sự cố Lv10: mất hết người hỗ trợ (đúng luật "mất hết"), sang nơi mới thì bắt đầu lại từ 0 suất.

### Luật 2 · Mỗi lần lên cấp có 1 hộp quà

- Banner "Cấp N!" có thêm hộp 🎁. Bấm để mở và nhận quà (giống mở rương, có hiệu ứng).
- Quà **cố định theo cấp**, không ngẫu nhiên. Như vậy dễ cân bằng và dễ test. Muốn ngẫu nhiên thì làm sau.
- Các loại quà dùng lại thứ đã có trong game, không thêm tài nguyên mới:
  - 🪙 Xu: mặc định `40 × cấp` (Lv2 = 80, Lv5 = 200, Lv9 = 360).
  - 🫘 Hạt: chỉ ở Quán, vì quán phải mua hạt.
  - 🎟️ Thẻ thuê miễn phí: thuê 1 người không mất xu.
  - 🤖 Lượt Auto.
  - 🌼 Đồ trang trí miễn phí.
- **Lv5 là mốc lớn:** quà to hơn, có hoạt cảnh.

### Luật 3 · Mỗi cấp mở ít nhất 1 thứ mới

Gồm suất người hỗ trợ (luật 1), quà (luật 2), và nếu có thì thêm 1 nội dung mới (giống cây, món, công trình, loại
người hỗ trợ). Robot mở muộn hơn nhân viên để có thêm mốc để chờ.

## 3. Bảng cấp đề xuất

### 🌱 Nông trại

| Cấp | Mở mới | Suất | Quà 🎁 |
|---|---|---|---|
| 1 | Robusta, ruộng đầu tiên, kho | 0 | — |
| 2 | Máy phơi, hoa, chậu cây · **Nông dân** | 1 | 🎟️ Thuê miễn phí người đầu tiên + 80 🪙 |
| 3 | Arabica, đèn | 2 | 120 🪙 |
| 4 | **Sprout Bot** (robot đầu tiên; hiện mở ở Lv1) | 3 | 🤖 1 lượt Auto + 160 🪙 |
| 5 | — | 4 | ⭐ **Mốc lớn:** 400 🪙 + 🌼 1 đồ trang trí |
| 6 | *(trống: cần nội dung mới)* | 5 | 240 🪙 |
| 7 | *(trống)* | 6 | 280 🪙 |
| 8 | *(trống)* | 7 | 🎟️ Thuê miễn phí + 320 🪙 |
| 9 | *(trống)* | 8 | 360 🪙 |
| 10 | ⚠️ Sự cố: mất hết → chọn nơi mới | — | — |

### ☕ Quán cà phê

| Cấp | Mở mới | Suất | Quà 🎁 |
|---|---|---|---|
| 1 | Espresso, quầy order, quầy pha, hiên | 0 | — |
| 2 | Sữa, Bàn ghế, hoa, chậu cây · **Barista** | 1 | 🎟️ Thuê miễn phí người đầu tiên + 80 🪙 |
| 3 | Đèn | 2 | 120 🪙 + 10 🫘 |
| 4 | **Brew Bot** (robot đầu tiên; hiện mở ở Lv1) | 3 | 🤖 1 lượt Auto + 160 🪙 |
| 5 | Latte | 4 | ⭐ **Mốc lớn:** 400 🪙 + 20 🫘 |
| 6 | *(trống)* | 5 | 240 🪙 |
| 7 | **Ki-ốt** (dời từ Lv10 xuống) | 6 | 280 🪙 |
| 8 | **Tủ bánh** (dời từ Lv12 xuống) | 7 | 🎟️ Thuê miễn phí + 320 🪙 |
| 9 | *(trống)* | 8 | 360 🪙 + 30 🫘 |
| 10 | ⚠️ Sự cố: mất hết → chọn nơi mới | — | — |

> Ô *(trống)* vẫn có suất + quà, nên mỗi cấp vẫn có thứ để chờ. Trại còn thiếu nội dung ở Lv6–9. Có thể bổ sung
> giống cây hoặc công trình mới sau; xem câu hỏi 4.

## 4. Thay đổi so với hiện tại

| Thứ | Hiện tại | Đề xuất |
|---|---|---|
| Số người hỗ trợ | Không giới hạn số lượt thuê, tối đa 3 người làm mỗi khu | Tối đa = cấp − 1 |
| Robot | Mở ở Lv1 | Mở ở Lv4 |
| Ki-ốt / Tủ bánh | Lv10 / Lv12 (không với tới) | Lv7 / Lv8 |
| Lên cấp | Banner | Banner + hộp quà |
| Thuê người | +5 XP | Giữ nguyên |

## 5. Phải để ý

- **Tám người cùng làm một quán nhỏ:** quán chỉ có 2 quầy, nên 8 người sẽ chen nhau. Hai hướng xử lý:
  - (a) Quán chỉ cho tối đa **5–6 người**. Các cấp cuối đổi suất thành quà lớn hơn.
  - (b) Giữ 8 người, kèm câu thoại hài khi thừa người (đã có ý tưởng trong `staff-robot-gameplay.md` §5).
  - Trại có 12 ruộng nên 8 người vẫn ổn.
- **Quà xu và tốc độ lên cấp:** quà xu giúp mua đất và công trình nhanh hơn. Mua đất và xây cũng cho XP, nên tốc độ lên
  cấp sẽ tăng một chút. Code xong cần chạy lại `npm run sim` để giữ mốc ~20–30 phút tới Lv10.
- **Test:** cần tắt PLAYTEST (đặt `PLAYTEST.coins = 0`) hoặc dùng `?profile=test&coins=…` để test với số xu thật.
- **Save cũ** đang có nhiều người hơn số suất: giữ nguyên người đã có, chỉ chặn thuê thêm.

## 6. Đã chốt và đã code (2026-11-06)

| Điểm | Chốt |
|---|---|
| Người hỗ trợ | **Mỗi cấp thuê thêm 1 người** (Lv1: 1, Lv5: 5…). Không có giới hạn riêng theo khu; ai đã thuê đều được làm |
| Robot | Mở ở **Lv4** (Sprout Bot, Brew Bot). Nhân viên mở từ Lv1 |
| Ki-ốt / Tủ bánh | **Lv7 / Lv8** (trước là Lv10 / Lv12, không với tới) |
| Quà thường | Mỗi cấp có hộp quà: `40 × cấp` xu. Lv2 và Lv8 thêm 🎟️ thẻ thuê miễn phí; Lv4 và Lv7 thêm 🤖 lượt Auto |
| Rương bất ngờ | Ở **Lv5, Lv10, Lv15**. Mở ra trúng ngẫu nhiên 1 giải: núi xu / 2 thẻ thuê / bao hạt / lượt Auto. Lưu ý: code hiện tại chỉ cho sự cố xảy ra **1 lần mỗi save**. Ở nơi đầu tiên, rương Lv10 bị sự cố xoá; từ nơi thứ 2 không còn sự cố nên rương Lv10, Lv15 mở được (xem `produce-system.md`) |
| PLAYTEST 9 999 999 xu | **Đã tắt** |
| Vay xu | Nút 💰 dưới ⚙️. 3 gói 1 000 / 2 000 / 5 000 xu, phí 10%, mỗi khoản thu tự trừ 20% để trả nợ, vay nhiều lần được (cộng dồn). Sự cố Lv10 KHÔNG xoá nợ — vay thì phải trả (UI không báo trước) |

## 7. Việc tiếp theo (chưa làm)

1. **Nông sản mới cho rương:** khoai, cà rốt, gà, lợn. Hiện ruộng chỉ trồng cà phê ra hạt. Muốn thêm thì cần một hệ
   "nông sản" riêng: kho riêng, giá bán riêng, model 3D, chuồng cho vật nuôi. Làm xong thì thêm các giải này vào
   `CHEST_PRIZES`.
2. **Sau sự cố, cấp về 1 hay giữ 10?** Đề xuất: **về 1** như hiện tại. Lý do:
   - Vòng "mỗi cấp 1 người + 1 hộp quà" được chơi lại ở nơi mới.
   - Nếu giữ Lv10 thì sang nơi mới không còn gì để chờ, và sự cố sẽ nổ ngay.
3. **Biến cố nhỏ theo cấp** (thay cho "mất hết" ở các cấp khác): bão làm cây lớn chậm, trộm lấy ít xu, giờ cao điểm
   đông khách, thương lái đặt hàng gấp… Biến cố chỉ làm khó trong một lúc, không xoá save. Sự cố lớn (mất hết) chỉ
   hết khi mở được Round 2. Cần một bản thiết kế riêng.
4. Lên Lv100: `LEVEL_XP` hiện tự tính tiếp sau Lv10 tới `MAX_LEVEL = 30`. Muốn tới 100 thì cần định lại đường XP.


## Level-10 restart: explanation and a follower (founder 2026-11-07)
- The restart stays. The dialogue now says it plainly: reaching level 10 ends the apprenticeship; the real game starts
  over with no coins, level or land; you keep what you learned (found recipes) and maybe someone who follows you.
- Before the reset the game picks one of your staff who wants to follow (`D.followerCandidate`): the worker with the
  highest morale, or — `FOLLOW.robotChance` 25% when you own robots — a robot that "evolved a mind" from living with
  people (two funny lines first). You confirm («Cho đi theo» / «Thôi»); `expiry/execute { follower }` keeps that unit
  (skills, rank, gear) unassigned; it joins the next region you enter.
- A follower is paid `followerWage` per 10 min, working or not (workers 10% of the hire price, min 10; the evolved robot
  20). With no coins the wage goes on your debt (`s.loan.owed`), repaid by the usual 20% of income.

## Level-10 heads-up (founder 2026-11-07)
Players are told before Level 10 that the incident is coming:
- A chip under the level badge: «⚡ Cấp 10: có biến cố»; from 3 levels before, it turns orange and pulses: «⚡ Còn N cấp tới
  biến cố». Tap → the 🚂 Rounds sheet. Hidden once the incident has happened (`story.level10Done`).
- Rounds sheet, Round 1: says what happens at Level 10 (start over in a new place without coins, level or land; keep found
  recipes; maybe a follower; the loan stays).
- Level-up banner at Lv7–9: «⚡ Còn N cấp nữa là tới biến cố Cấp 10 — bấm 🚂 để xem.»
