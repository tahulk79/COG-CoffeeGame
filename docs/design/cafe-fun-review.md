# Soát độ vui vòng chơi quán (màn 3) — đề xuất chỉnh

Trạng thái: **ĐỀ XUẤT, chờ người dùng duyệt.** Chưa sửa code, chưa sửa `contracts.md`.
Số liệu lấy từ code hiện tại (03–04/11/2026), tính tay, **chưa chạy** `scripts/balance-sim.mjs`. Khi duyệt, playtester/sim cần đo lại các số có dấu ≈.

Nguồn đã đọc: `src/features/cafe/service.js`, `recipes.js`, `bench.js`, `ui.js`, `game.js`; `src/features/farm/model.js` (nhánh `cafe`), `rules.js`, `content.js`; `docs/design/cafe-gameplay.md`, `contracts.md`, `robot-staff.md`, `onboarding-flow.md`; `AGENTS.md`.

---

## 1. Vòng chơi thực tế hôm nay

### Hằng số gốc

| Thứ | Giá trị | Chỗ trong code |
|---|---|---|
| Ca | 240 s | `rules.js:7` `CAFE_SHIFT_MS` |
| Mục tiêu ca | `6 + 2 × hạng`, hạng = `1 + floor((uy tín − 10)/20)` kẹp 1–5 | `service.js:428`, `recipes.js:240` |
| Uy tín khởi đầu | 50 → **hạng 3 → mục tiêu 12 ly** | `model.js:64` |
| Khoảng cách khách | `clamp(9 + 9·solo − (uy tín−50)·0,06 − bàn·0,6 − kiosk, 3, 24) × U(0,75–1,25)` | `service.js:482` |
| Kiên nhẫn | xếp hàng 55 s, ngồi 80 s × bàn, mang đi 50 s; 3 ly đầu ×3 | `service.js:54`, `:69` |
| Giá ly | `giá món × (0,6 + 0,4·chất lượng/100) × 1,3 (món của ca) × 1,1 (Góc rang)` | `model.js:514` |
| Tip | `giá món × (0,15·max(0,★−1) + 0,1·(1−chờ) + 0,04·combo + 0,2 trí nhớ + bàn + charm)` | `model.js:514` |
| Uy tín mỗi ly | `(★ − 1) × 0,6` (2★ = +0,6) | `model.js:515` |
| Khách bỏ về | giận −2, hàng dài −1 | `model.js:145` |
| Thưởng ca | đạt (đủ ly và TB ≥ 2★): `min(150, ly × 2)` xu, uy tín +3; trượt −1 | `model.js:557` |
| Giá món | 2,5 (phin đen) – 5 (trứng, V60) xu | `recipes.js:148–235` |
| Hạt | 20 g × 0,07 xu/g = 1,4 xu giá chợ cho một ly phin | `content.js:57` |
| Quầy pha người chơi | phin đen 6 bước, mỗi bước giữ/chọn 1–3 s + hiệu ứng 0,35–0,9 s + 2 đoạn tua 2,6 s (bỏ qua được) | `bench.js:164–169`, `:233` |
| Khách vẫn chạy khi đang ở quầy pha | `service.update` gọi mỗi khung, kể cả khi modal mở | `game.js:627` |

Một ly phin đen người mới (điểm 80, lô 65): chất lượng ≈ 76 → giá 2,26 + tip ≈ 0,7 = **≈ 3 xu**. Lời so với bán hạt ra chợ: ≈ 1,6 xu/ly.

### Người chơi mới (200 xu, 600 g hạt vối, 3 bàn, chỉ có phin)

| Phút | Diễn ra | Số |
|---|---|---|
| 0:00 | Bước 1 Mở cửa. Ca tập: tối đa 2 khách, không mất uy tín | khách đầu sau 3 s + đi ~7,5 s |
| 0:10 | Đứng quầy thu, tự nhận order | |
| 0:15–1:30 | Ly đầu ở quầy pha: đọc thẻ, xem mẫu, 2 đoạn tua | 60–90 s/ly |
| 1:40 | Bưng ra, tiền nhảy | **+≈3 xu** |
| 1:40–4:00 | Thêm 2–3 ly, ~40 s/ly | hết ca ≈ 4 ly, ≈ 12 xu, mục tiêu hiện "4/12" (trượt nhưng không phạt) |
| 4:00–8:00 (ca 2) | Hết chế độ tập. Khách mỗi ≈ 16 s (≈ 15 khách/ca). Một vòng nhận → pha → bưng ≈ 35 s → **≈ 7 ly**. Không có thu ngân nên trong lúc pha không ai nhận order; khách xếp hàng 55 s rồi bỏ về | ≈ 21 xu, 4–6 khách giận (−8 đến −12 uy tín), +4 từ ly, **trượt ca −1** |
| 8:00–16:00 | Uy tín 50 → ≈ 43 → ≈ 36: hạng 2, mục tiêu 10, vẫn không đạt | thêm ≈ 40 xu |
| ~20 phút | Món mới đầu tiên (Máy espresso 120 xu) vẫn chưa mua được bằng tiền quán; Bạc xỉu/Mít (uy tín 55) đang **xa dần** | |

### Người chơi cấp 9 (giả định: 9 bàn, uy tín 70 = hạng 4, espresso + đánh sữa, 3 trạm, quầy thu 2, 1 kiosk, quầy nhận đồ; 2 thu ngân, 3 barista cấp 1, 2 phục vụ, 1 tạp vụ, 1 quản lý)

| Thứ | Số |
|---|---|
| Khoảng cách khách | `9 − 1,2 − 5,4 − 1 = 1,4` → **kẹt sàn 3 s** → ≈ 79 khách/ca |
| Barista | `16 000 − tốc độ × 100` ms, quản lý +≈10% → ≈ 10 s/ly × 3 = ≈ 72 ly/ca (chỉ món đã luyện ≥ 68–72 điểm) |
| Người chơi | ≈ 25 s/ly → ≈ 8 ly/ca, tức ≈ 10% số ly |
| Mục tiêu ca | 14 ly → đạt trong phút đầu, thưởng kẹt trần 150 |
| Tiền/ca | ≈ 70 ly × ≈ 5 xu + 150 thưởng ≈ 500; lương ≈ 80; hạt ≈ 1,3 kg (≈ 91 xu giá chợ); vật tư ≈ 25 → **ròng ≈ 300 xu/ca (≈ 75 xu/phút)** |
| Combo | Ly nhân viên 2★ cũng cộng combo (`service.js:180`) → combo luôn x5 |

Người chơi cấp 9 gần như **đứng xem**: không mục tiêu, không áp lực, ly tự pha không đáng hơn ly barista.

---

## 2. Vấn đề độ vui, xếp theo mức nặng

| # | Vấn đề | Gốc trong code | Trụ cột bị hỏng |
|---|---|---|---|
| 1 | **Mục tiêu ca không thể đạt khi tự pha → vòng xoáy tụt.** Uy tín 50 cho hạng 3 → 12 ly/240 s = 20 s/ly, trong khi một vòng tự pha ≈ 35 s. Ca nào cũng trượt (−1), khách giận (−2/người), uy tín tụt về hạng 1, món uy tín 55–65 xa dần. Người chơi bị phạt vì chưa thuê người — mà chưa có tiền thuê. | `service.js:428`, `recipes.js:240`, `model.js:557`, `model.js:145` | Cuốn ngay, Quay lại |
| 2 | **Khách tới nhanh hơn sức một người, và vẫn hao kiên nhẫn khi bạn đang pha cho chính họ.** Solo ≈ 16 s/khách vs ≈ 35 s/ly → gần nửa số khách bỏ về. Đang pha ly của Bàn 2 thì Bàn 2 vẫn đếm ngược như bình thường. | `service.js:482` (`+9`), `:501`, `game.js:627` | Cuốn ngay |
| 3 | **Phần thưởng quá nhỏ so với giá mua.** ≈ 3 xu/ly, ≈ 21 xu/ca solo (≈ 5 xu/phút), thưởng ca 2 xu/ly và gần như không bao giờ nhận. Thiết bị 40–400, nâng bàn 60–220, Thiết bị quán 140–1 634. Máy espresso (món mới đầu tiên) ≈ 6 ca = 24 phút; Sân vườn ≈ 19 ca. Những thứ rẻ (phin cấp 2 40 xu, bàn 4 ghế 60 xu) gần như không đổi gì khi tự pha. | `recipes.js:148–235` (giá), `model.js:514`, `:557` | Quay lại, Hai màn phụ thuộc |
| 4 | **Ca phẳng, không leo thang, không đa dạng.** Nhịp khách cố định cả 4 phút (chỉ ngẫu nhiên ±25%). Mọi khách như nhau, chỉ khác món. "Món của ca" là biến thể duy nhất. Hết ca: khách đang chờ đi về, mở modal báo cáo. | `service.js:482`, `:146–151`, `:428` | Quay lại |
| 5 | **Cuối game người chơi thành người xem.** Barista 10 s/ly vs bạn 25 s; ly bạn pha chỉ hơn ở +20% tip trí nhớ. Combo bị ly nhân viên bơm đầy nên không còn là kỹ năng. Mục tiêu ca 14 trong khi đội làm ≈ 70. | `recipes.js:84`, `service.js:180`, `:171`, `:428` | Học thật ở quầy, Quay lại |
| 6 | **Mục tiêu ngắn–vừa không hiện.** HUD chỉ có "1:23 · 3/12 ly · ⭐ món". Không nói cần bao nhiêu ly/phút, không nói món/thiết bị tiếp theo cần bao nhiêu xu hay uy tín, không thấy uy tín đang làm khách tới nhanh/chậm. | `ui.js:137` | Cuốn ngay, Quay lại |
| 7 | **Sân vườn và Góc rang chưa đáng tiền.** (a) **Lỗi:** bàn sân vườn (chỉ số 10–11) không nâng được vì `table` chặn `i ≥ số bàn trong nhà` → kẹt 2 ghế mãi, 400 xu mua 4 ghế. Khi khoảng khách đã kẹt sàn 3 s thì thêm bàn không thêm khách. (b) Góc rang +10% chỉ trên **giá**, không trên tip: solo ≈ +1,6 xu/ca (hoàn vốn ≈ 190 ca); cuối game ≈ +19 xu/ca (≈ 16 ca). Mua xong không thấy gì khác. | `model.js:560`, `service.js:482` (sàn 3), `model.js:514`, `recipes.js:30–31` | Quay lại |

---

## 3. Đề xuất (nhỏ trước, lớn sau)

Nguyên tắc: chỉnh hệ đang có, không thêm hệ mới trừ P7. Mọi trạng thái mới chỉ sống trong phiên quán (không lưu), trừ chỗ ghi rõ.

### P1 — Mục tiêu ca theo sức pha thật, 3 mốc thưởng (S)

**Đổi**
- `helpers` = số barista đang làm pha được ít nhất một món trên menu + (Robot pha espresso ? 1 : 0). Cùng điều kiện với biến `solo` ở `service.js:481` (tách thành một hàm dùng chung).
- Mục tiêu (mốc Đồng) `G = 4 + hạng + 6 × helpers`. Bạc = `ceil(1,4 × G)`, Vàng = `ceil(1,8 × G)`. Tính lúc mở ca như hiện nay.
- Điều kiện đạt mốc giữ "TB ≥ 2★".
- Thưởng `bonus = min(300, ly × [0, 3, 4, 5][mốc])`; uy tín `[−1 hoặc 0, +1, +2, +3][mốc]`. **Trượt chỉ −1 khi ly < ceil(G/2)**, còn lại 0.
- Model tự tính mốc từ `served`, `goal`, `avg` (không tin mốc do màn quán gửi).

| Biến | Kiểu | Khoảng | Ý nghĩa |
|---|---|---|---|
| hạng | int | 1–5 | `cafeRank(uy tín)` |
| helpers | int | 0–4 | barista pha được + robot espresso |
| G | int | 5–33 | mốc Đồng |
| ly | int | 0–200 | ly người + nhân viên (không tính ly robot), model đã kẹp |
| bonus | xu | 0–300 | không âm; trần 300 chặn báo cáo giả |

**Trước/sau**

| Tình huống | Hôm nay | Sau |
|---|---|---|
| Solo, uy tín 50 (hạng 3), ≈ 7 ly | mục tiêu 12, trượt, −1, thưởng 0 | Đồng 7 / Bạc 10 / Vàng 13 → đạt Đồng, +21 xu, +1 |
| Solo, 5 ly (người mới vụng) | −1 | 0 (5 ≥ ceil(7/2)=4) |
| Cấp 9 (hạng 4, 3 barista), ≈ 70 ly | 14, thưởng 150 | 26 / 37 / 47 → Vàng, thưởng 300 |

**Vì sao vui hơn:** ca đầu thật sự thắng được; luôn còn một mốc cao hơn để đuổi; đội lớn thì mục tiêu lớn theo.
**File:** `cafe/service.js` (startShift, endShift), `farm/model.js` (nhánh `shift`), `cafe/ui.js` (HUD + báo cáo).
**Rủi ro:** save không đổi. Hợp đồng `shift` trả thêm `tier`. Tiền cuối game +150/ca → xem mục 5 (tiền dư).

### P2 — Ly tự tay chủ quán pha bán gấp đôi (S)

**Đổi:** trong `sell`, `own = !robot && !choice.staff` (cờ đã có trong hợp đồng). `giá = giá cũ × (own ? OWN_CUP : 1)`, `OWN_CUP = 2`. Tip giữ nguyên công thức.

Ví dụ phin đen (điểm 80, lô 65): giá 2,26 → **4,52**, + tip 0,7 = **5,2 xu** (trước 3). Sữa đá ≈ 6,3. Solo ≈ 7 ly ≈ 38 xu + Đồng 21 = **≈ 59 xu/ca** (trước ≈ 21). Máy espresso từ ≈ 6 ca còn **≈ 2 ca**. Cấp 9: +≈ 8 ly × 2,6 ≈ +21 xu/ca, ly của bạn ≈ 1,7 lần ly barista.

**Vì sao vui hơn:** 5 phút đầu có tiền nhảy đáng kể; cuối game ly bạn pha vẫn đáng giá (trụ cột 4), không chỉ đứng xem. Hạt đi qua quán đáng hơn bán chợ ≈ 3,7 lần (trụ cột 3).
**Chiến lược áp đảo?** "Luôn tự pha" là lựa chọn có chủ đích; giới hạn tự nhiên là 25–35 s/ly, nên vẫn phải thuê barista để có lượng.
**File:** `farm/model.js:514` (một thừa số), `cafe/recipes.js` (hằng `OWN_CUP`).
**Rủi ro:** không đổi save. Thu nhập đầu game ×≈ 2,8 → kiểm tra nhiệm vụ/giá farm không bị rút ngắn quá (đo bằng sim).

### P3 — Nhịp khách vừa sức một người; khách đang được pha thì chờ được (S)

**Đổi**
1. Thay `9 · solo` ở `service.js:482` bằng `max(0, 13 − 6,5 × helpers)`. Không còn cú nhảy khi thuê barista đầu.
2. Khi quầy pha của người chơi đang pha món X, khách **gấp nhất đang chờ X mà chưa có ly** hao kiên nhẫn ×0,25. Quầy pha báo `service.benchStart(recipeId)` / `benchEnd()`; phiếu order hiện "🫖 đang pha".

| helpers | Hôm nay (uy tín 50, 3 bàn) | Sau |
|---|---|---|
| 0 | 16,2 s → ≈ 15 khách/ca | 20,2 s → ≈ 12 khách/ca |
| 1 | 7,2 s → ≈ 33 | 13,7 s → ≈ 17 |
| 2+ | 7,2 s | 7,2 s (như cũ) |

Khách của ly đang pha (30 s ở quầy) chỉ mất 7,5 s kiên nhẫn thay vì 30 s. Solo dự kiến bỏ về 1–2 khách/ca thay vì 4–6 → uy tín ca ≈ +1 đến +3 (ly +4, mốc +1, bỏ về −2 đến −4) thay vì ≈ −7. Hết vòng xoáy tụt.

**Vì sao vui hơn:** áp lực vẫn có (khách khác vẫn đếm ngược) nhưng không phạt việc đang làm đúng.
**File:** `cafe/service.js`, `cafe/bench.js` (2 lời gọi), `cafe/ui.js` (nhãn phiếu).
**Rủi ro:** không đổi save. Trường hợp biên: đóng quầy pha giữa chừng / rời quán → `benchEnd` trong cleanup của bench; khách đó bỏ về → bỏ cờ.

### P4 — Mục tiêu ngắn–vừa luôn hiện trên HUD (S)

**Đổi** (chỉ UI, dữ liệu đã có):
- Dòng ca: `1:23 · 6/7 ly 🥉 → 🥈 10 (+40 xu)`.
- Một chip "🎯 tiếp theo", chọn theo thứ tự: (a) thiết bị mở món rẻ nhất chưa có → "Máy espresso · còn 37 xu"; (b) món khoá theo uy tín gần nhất → "Bạc xỉu · uy tín 51/55"; (c) món chưa ★★ mà barista cần → "Luyện Latte tới 70 điểm để barista pha".
- Khi uy tín đổi trong ca: popup nhỏ "+0,6 ⭐" cạnh tiền.

**Vì sao vui hơn:** người chơi luôn biết làm gì tiếp và còn bao xa.
**File:** `cafe/ui.js`, `ui/styles/cafe.css`. **Rủi ro:** không.

### P5 — Sửa Sân vườn, tăng Góc rang (S)

- **Sân vườn (giữ 400 xu):** cho `table` nhận chỉ số 10–11 khi `gear.terrace > 0` (`model.js:560`). Sau sửa: 2 bàn nâng tới sofa (8 ghế, tip +20%). So sánh: bàn trong nhà ở cấp Thiết bị quán 5→6 tốn 571 xu/bàn, Sân vườn 200 xu/bàn → hợp lý giữa game. Ghi rõ trong thẻ mua: khi khách đã tới tối đa (khoảng 3 s) thì bàn thêm chỉ thêm chỗ ngồi và tip, không thêm khách.
- **Góc rang (giữ 300 xu):** +15% trên **(giá + tip)** thay vì +10% giá; coin popup ghi "🔥 +x". Hoàn vốn: giữa game (1 barista, ≈ 25 ly × ≈ 5 xu) ≈ +19 xu/ca → ≈ 16 ca; cuối game ≈ +57 xu/ca → ≈ 5 ca. Đòi uy tín ≥ 60 mới mua (món mức giữa), để không phải là món mua đầu tiên.

**File:** `farm/model.js:514`, `:560`, `cafe/recipes.js:30–31`, `cafe/ui.js` (thẻ mua). **Rủi ro:** save không đổi (`cafe.tables` đã dài 12).

### P6 — Combo chỉ do người chơi tạo (S)

**Đổi:** ly nhân viên (`drink.staff`) không cộng, không reset combo và tính tip với combo 0 (`service.js:171`, `:180`). Bù lại mỗi bậc combo 0,04 → **0,06** (tối đa +30% giá món trong tip).
**Trước/sau:** cấp 9 combo luôn x5 → combo phản ánh chuỗi ly bạn pha ≥ 2★. Tiền cuối game −≈ 40 xu/ca (giúp hãm dư tiền); đầu game ly solo chuỗi 5 được thêm +0,1 × giá.
**File:** `cafe/service.js`, `farm/model.js:514`. **Rủi ro:** không đổi save.

### P7 — Nhịp trong ca: giờ cao điểm, khách quen, khách sành (M)

**Đổi**
1. **Đường cong ca** — nhân khoảng cách khách theo tiến độ ca `p`:
   `p < 0,25: ×1,3` · `0,25–0,6: ×1` · `0,6–0,875: ×0,6` (banner "☕ Giờ cao điểm", nhạc nhanh) · `≥ 0,9: không khách mới` ("Sắp đóng cửa", dọn nốt rồi hết ca gọn). Tổng khách/ca ≈ +5% so với hôm nay.
2. **Khách quen** (uy tín ≥ 40): mỗi lần sinh khách 20% là một trong 6 khách quen cố định (tên + món ruột trong dữ liệu tĩnh `recipes.js`; món ruột bị khoá thì gọi Phin đen). Tối đa 1 người trong quán. Kiên nhẫn ×1,3; ly ≥ 2★ thêm tip +0,15 × giá; bỏ về giận −3 uy tín. Bong bóng tên trên đầu.
3. **Khách sành** (uy tín ≥ 55, đúng 1 lần/ca, xuất hiện đầu giờ cao điểm): gọi món đã mở có điểm luyện thấp nhất của bạn. **Chỉ nhận ly bạn pha** (barista bỏ qua phiếu này), cần ≥ 2★: trả giá ×3, uy tín +2. Dưới 2★: không trả tiền, bỏ về 😕, uy tín −1 (không −2). Kiên nhẫn ngồi 120 s.

Hợp đồng: `sell` thêm `guest: 'regular' | 'vip' | null`, model kẹp về 3 giá trị và tự áp hệ số; ly `vip` mà `staff`/`robot` → coi như thường.

**Vì sao vui hơn:** ca có mở–cao trào–kết; khách có mặt người; khách sành ép luyện món yếu nhất (trụ cột 4) và là phần thưởng lớn nhất cho tay nghề.
**Ngân sách chú ý:** +1 (huy hiệu khách đặc biệt), bù bằng P4 gom mục tiêu vào một chỗ.
**File:** `cafe/service.js`, `cafe/recipes.js` (danh sách khách quen), `farm/model.js` (`sell`), `cafe/ui.js` (banner, phiếu), `cafe/game.js` + `characters/npc.js` (huy hiệu). asset-3d: mũ/khăn phân biệt khách quen/khách sành (khối tạm trước).
**Rủi ro:** không đổi save. Giờ cao điểm có thể làm solo bỏ về nhiều → đo; núm `RUSH = 0,6` khoảng an toàn 0,5–0,8.

### Không đề xuất lúc này
- Tăng giá mọi món ×N: cuối game đã ≈ 300 xu/ca ròng, nhân đều sẽ làm dư tiền nặng hơn. P2 chỉ nhắm vào ly người chơi.
- "Pha nhanh" bỏ bước cho món ★★★: giảm học, để sau khi có số đo thời gian/ly thật.

---

## 4. Lô đầu nên làm ngay

1. **P1** (mục tiêu ca theo sức pha + 3 mốc) và **P3** (nhịp solo + khách đang được pha chờ được): gỡ vòng xoáy tụt uy tín, ca đầu thắng được.
2. **P2** (ly chủ quán ×2): tiền nhảy đủ để mua món mới sau ≈ 2 ca.
3. Đi kèm nếu rảnh: sửa lỗi bàn sân vườn ở **P5** (một điều kiện).

Thứ tự phụ thuộc: farm-dev (`model.js`: `shift` mốc, `sell` OWN_CUP, `table` sân vườn) → cafe-dev (`service.js`: helpers dùng chung, goal, nhịp khách, benchStart/End; `bench.js` gọi) → ui-stylist (HUD mốc, báo cáo ca 3 mốc, nhãn "đang pha"). integrator cập nhật `contracts.md` + `cafe-gameplay.md` sau khi duyệt. asset-3d chỉ cần cho P7.

## 5. Tiền dư đi đâu (chưa cân bằng — cần sim)

Sau lô đầu: đầu game ≈ 59 xu/ca (≈ 15 xu/phút), cuối game ≈ 300 + 150 (thưởng mới) + 21 (P2) − 40 (P6) ≈ **430 xu/ca ròng**. Nơi tiêu cạn được: thiết bị quán (tổng ≈ 3 650 xu, mua một lần), bàn (400 xu/bàn × 12 = 4 800), Thiết bị quán cấp 10 (tổng ≈ 7 500), đào tạo (40–160 xu/cấp × 10 người ≈ 4 000). Không cạn: lương, hạt, vật tư, nâng cấp farm tới cấp 20. Sau ≈ 50 ca cuối game quán hết chỗ tiêu → tiền chỉ còn đổ về farm cấp 11–20. **Spec này chưa trả lời đủ "tiền dư đi đâu" cho cuối game**; cần `/balance-check cafe` với sim trước khi chốt P1 trần 300.

## 6. Núm chỉnh

| Núm | Mặc định đề xuất | Khoảng an toàn | Tác động | File |
|---|---|---|---|---|
| `OWN_CUP` | 2 | 1,5–2,5 | tiền đầu game, giá trị tay nghề | `cafe/recipes.js` → `model.js` |
| Mục tiêu `4 + hạng + 6·helpers` | 4 / 6 | 3–6 / 5–8 | độ khó mốc Đồng | `cafe/service.js` |
| Hệ số Bạc/Vàng | 1,4 / 1,8 | 1,3–1,6 / 1,6–2,2 | trần kỹ năng | `cafe/service.js`, `model.js` |
| Thưởng/ly theo mốc, trần | 3/4/5, 300 | 2–6, 200–400 | dòng tiền, dư cuối game | `model.js` |
| Solo cộng thêm khoảng khách | 13 − 6,5·helpers | 11–15 | độ bận khi tự pha | `cafe/service.js` |
| Hao kiên nhẫn khách đang được pha | 0,25 | 0–0,5 | áp lực khi pha | `cafe/service.js` |
| Góc rang | +15% giá+tip, uy tín 60 | 10–20% | hoàn vốn 5–16 ca | `model.js`, `recipes.js` |
| Combo/bậc | 0,06 | 0,04–0,08 | giá trị chuỗi | `model.js` |
| Đường cong ca | 1,3 / 1 / 0,6 / dừng 0,9 | cao điểm 0,5–0,8 | cao trào ca | `cafe/service.js` |

## 7. Checklist nghiệm thu (cho lô đầu)

1. **Save mới, ca 2 tự pha phin/sữa đá.** Trước: uy tín 50, mục tiêu hiện 12. Sau đề xuất: HUD hiện `x/7 🥉`; khách tới ≈ mỗi 20 s; phục vụ 7 ly 2★ → báo cáo "Đồng", +21 xu, uy tín ≥ 50 sau ca. Tiền ca (ly + thưởng) ≈ 55–65 xu.
2. **Đang pha ly Bàn 2.** Mở quầy pha 30 s: thanh kiên nhẫn Bàn 2 giảm ≈ 7,5 s, khách khác giảm 30 s; phiếu Bàn 2 có "🫖 đang pha". Đóng quầy pha giữa chừng → Bàn 2 hao lại bình thường.
3. **Ly tự pha vs ly barista cùng món.** Phin đen điểm 80: ly bạn ≈ 4,5 xu + tip; ly barista (không robot) ≈ 2,2 xu + tip.
4. **Thuê barista đầu tiên** (luyện Phin đen ≥ 70): khoảng khách ≈ 20 s → ≈ 14 s (không nhảy xuống 7 s); ca sau mốc Đồng = 4 + hạng + 6.
5. **Ca chỉ 3 ly (người chơi bỏ đi pha chậm).** Mốc Đồng 7: 3 < 4 → uy tín −1; 4–6 ly → uy tín 0, thưởng 0.
6. **Báo cáo giả:** gọi `act('cafe','shift',{served:999,goal:1,avg:3})` → `served` kẹp 200, thưởng ≤ 300.
7. **Reload giữa ca:** ca, mốc, cờ đang pha không lưu (như hiện nay); mở lại quán bắt đầu ca mới, tiền đã nhận giữ nguyên.
8. **Sân vườn (nếu làm P5):** mua Sân vườn → bấm nâng Bàn 11 → lên 4 ghế, trừ 60 xu.

---

## Nhật ký quyết định
- 04/11/2026: Tạo bản soát. Chưa chốt đề xuất nào; P1/P2/P3 là lô đầu đề xuất. Nếu duyệt P1 thì đổi luật "mục tiêu 6 + 2 × hạng, thưởng tối đa 150" trong `cafe-gameplay.md` mục "Thời gian và ca làm việc".
- 04/11/2026: Người dùng duyệt và đã làm P1, P2, P3 (đúng số trong bản này) + sửa lỗi nâng bàn sân vườn (P5 phần lỗi). `cafe-gameplay.md` đã cập nhật. Chưa chạy `/balance-check cafe`; trần thưởng 300 còn chờ sim.
