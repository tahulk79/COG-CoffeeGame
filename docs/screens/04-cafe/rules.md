# 04 · Quán cà phê — luật và số liệu

Luật hiện hành, đúng theo code. Hằng số ở `cafe/recipes.js` (món, thiết bị, nhân viên), `cafe/service.js` (khách, ca, bảng việc), `farm/model.js` (`farm.act('cafe', …)`: pha, bán, thưởng, thuê) và `farm/rules.js`.

## 1. Vòng một ca

1. **Mở cửa** (🚪 HUD hoặc cửa 3D): một ca 4 phút (`CAFE_SHIFT_MS` = 240 s).
2. **Khách** đi từ vỉa hè vào sảnh: dùng kiosk trống nếu có, không thì xếp hàng tới quầy thu ngân.
3. **Nhận order**: đứng sau quầy thu ngân (trong 1,6 m) là tự nhận order khách đầu hàng mỗi 0,5 s và tự trao ly mang đi. Khách gọi một món đã mở, tới ghế sạch (ưu tiên bàn trống); hết ghế thì chờ **mang đi**.
4. **Pha** ở quầy pha (mục 6). **Bưng**: cầm ly, bấm đúng bàn (mang đi: quầy thu ngân hoặc quầy nhận đồ). Ly khớp theo **món**: khách bỏ về thì ly vẫn giao được cho khách khác gọi cùng món. Cầm ly không ai gọi mà bấm quầy pha thì ly lên kệ.
5. **Thanh toán** (mục 5). Khách uống 8 s rồi về; ghế **bẩn** tới khi dọn (bấm bàn hoặc nhân viên).
6. **Hết ca** (hết giờ hoặc đóng tay): báo cáo, thưởng (mục 4).

Rời quán về farm thì quán **tạm dừng** (khách, ly, đồng hồ ca, hạn tươi, sự cố, lương đứng yên); vào lại chơi tiếp đúng chỗ (`service.resume`). Tab ẩn cũng được bù như vậy. Chỉ khi rời hẳn ván, khách đang chờ tính là bỏ về, −1 uy tín mỗi người (`service.abandon`, miễn khi đang học).

## 2. Ca tập và ly đầu

**Ca tập** = `tutorial.seen` chưa có `cafe-intro` (`service.training`).

| Luật | Giá trị |
|---|---|
| Tự mở | Quán đóng, chưa có ca, kho có ≥ 15 g chè rang (liều V60) → tự mở một lần mỗi phiên (`autoOpened`), không toast |
| Khách | 1 khách đứng sẵn ở quầy thu ngân 1 (`guestAtRegister`), không qua kiosk. Mỗi lúc 1 khách chưa phục vụ; khách bỏ về thì khách mới tới sau 2 s |
| Món | Mọi order khi `stats.served = 0` là **Pour-over V60** |
| Đồng hồ | Không giờ hết, không mốc. HUD «Ca tập · bán ly đầu tiên» |
| Kết thúc | Bán ly đầu → ghi `cafe-intro`, đóng quán; không thưởng/phạt, không ghi `shiftLog`, không phát `shift_ended` |
| Báo cáo | «🎉 Ly đầu tiên đã bán!», số ly, doanh thu, «🚪 Mở ca mới», «Nghỉ một lát»; không nút Hội đồng. Hiện sau khi bàn pha và sổ tay đóng; rời quán trước đó thì giữ tới lần vào sau |
| Khoá cửa | Nút 🚪 ẩn (giữ chỗ), mục «open-cafe» ở farm ẩn, cửa 3D chỉ báo «Quán đang mở ca tập» |
| Van an toàn | Quán đóng, thiếu chè → 🚪 hiện lại; bấm 🚪/cửa thì bỏ ca tập (ghi `cafe-intro`), mở ca thường (`trainingValve`). Đủ chè thì 🚪 mở lại ca tập |

**Thẻ quán 3 bước** (`ui.js` `refreshHud`; bước suy ra từ trạng thái, không lưu; mỗi bước có mũi chỉ 3D):

| Bước | Chữ | Mũi chỉ | Qua khi |
|---|---|---|---|
| 1 | Đứng ở quầy thu ngân để nhận order | Quầy thu ngân | Có order |
| 2 | Tới quầy pha để pha Pour-over V60 | Quầy pha | Có ly trên tay/kệ |
| 3 | Cầm ly, bấm đúng bàn (mang đi: quầy thu ngân) | Bàn khách; ly trên kệ thì quầy pha | Bán ly đầu |

- Gợi ý thiếu hạt đứng trước mọi bước: kho dưới 10 g mỗi loại, hoặc thiếu chè cho ca tập (chỉ lối có chè: Đơn farm, Kho → Đặt farm, hoặc 🚪 ca thường).
- Save có `stats.served > 0` coi như xong `cafe-intro`. Sau đó thẻ hiện nhiệm vụ farm «🎯 tên · n/N».

**Ly V60 làm mẫu** (`bench.js`, `v60-guided`): ly V60 pha tay đầu tiên.
- Bước chọn: đáp án đúng còn hàng tự sáng viền kèm lý do; điểm tối đa 0,8, vẫn hiện ✓. Bước rót không kẹp (👀 Xem mẫu thì tối đa 0,8).
- Rót hoàn hảo tối đa 91 điểm (★★★). Ly tính như ly tự pha (`best`, `made`, ×2 giá, nháp Memory). «Sửa bước này trước» tính trên điểm trước khi kẹp.
- Xong ly ghi `v60-guided`; bỏ dở thì lần sau làm mẫu lại. Save có `mastery.v60.best ≥ 70` coi như đã xem.

**Lần đầu mở bàn pha** (`bench-intro`): một dòng vàng hướng dẫn, tắt sau bước đầu. Save có `cafe.mastery` coi như đã xem.

**Chế độ học** (`learning()`: chưa có `cafe-intro` hoặc `stats.served = 0`): tối đa 2 khách chưa phục vụ, bỏ về không trừ uy tín, trượt mốc không phạt. Kiên nhẫn ×3 tới khi save bán đủ 3 ly (`learner`).

## 3. Khách

| Luật | Giá trị |
|---|---|
| Kiên nhẫn (`PATIENCE`) | Xếp hàng 55 s · ngồi 80 s × độ êm bàn × hệ số thu ngân · mang đi 50 s |
| Đang được pha | Khách gấp nhất chờ đúng món bạn đang pha hao ×0,25 (`benchTarget`) |
| Hàng đầy | Hàng ≥ 6 + số quầy thu ngân → khách mới quay về, uy tín −1 (`MAX_LINE`) |
| Hết kiên nhẫn | Bỏ về 😠, uy tín −2, combo về 0 |
| Món của ca | Được gọi gấp 3 lần |
| Kiosk | Khách dùng kiosk trống, tự gọi 4 s (không trong ca tập) |

**Khoảng cách giữa hai khách** (`arrivalGap`, `brewForce`):

```
gap = max(3, 20(1 − C), 20/(1 + 1,5H), min(24, 9 + max(0, 13 − 6,5H) − (uy tín − 50)·0,06 − số bàn·0,6 − số kiosk))
thực tế = gap × p̄^1,5 × ngẫu nhiên 0,75–1,25
```

- `H` = tổng phần menu từng tay phụ pha được (barista đang làm, tối đa bằng số trạm; cộng Robot pha espresso). `C` = phần menu có ít nhất một tay phụ pha được. `p̄` = hệ số giá trung bình, món của ca nặng ×3.
- Tự pha một mình, uy tín 50, 3 bàn → khoảng 20 s.

## 4. Ca và mốc thưởng

| Luật | Giá trị |
|---|---|
| Mốc Đồng | `4 + hạng sao + round(3H)`, tính lúc mở ca (`shiftGoal`) |
| Bạc / Vàng | ⌈1,4 × Đồng⌉ / ⌈1,8 × Đồng⌉ (`SHIFT_TIERS`) |
| Ly được đếm | Ly bạn, nhân viên, máy; không đếm ly robot gói thử |
| Điều kiện sao | TB ★ ly **bạn tự pha** ≥ 2; không tự pha ly nào thì chỉ xét số ly (`shiftAvg`) |
| Thưởng | `min(300, số ly × 3/4/5)` xu; uy tín +1/+2/+3 |
| Trượt | Uy tín −1 chỉ khi dưới nửa mốc Đồng; đang học thì không phạt |
| Món của ca | Ngẫu nhiên trong menu lúc mở ca, bán +30% (trừ ly robot) |

- HUD ca: đồng hồ, thanh thời gian, «n/mốc tiếp», món của ca; đủ ly mà TB dưới 2 thì «⚠ … cần TB ★★».
- Hết ca: khách đang chờ về êm 👋 (không tính bỏ về); ly trên kệ, trên tay, ly nhân viên đang bưng bị bỏ («Ly bỏ: n»).
- Báo cáo ca thường: số ly, mốc, TB ★, khách bỏ về, doanh thu, thưởng, món của ca, «n ly chờ ghi sổ», so sánh robot, nút «Mở ca mới», «Nghỉ», «🏛 Gặp Hội đồng» (khi có chuyên gia chờ). Có Key of Balance thì thêm lãi ca và doanh thu từng món.
- Mỗi ca thường ghi một dòng `cafe.shiftLog` (giữ 10).

## 5. Giá, tip, uy tín

**Chất lượng ly** = `điểm × 0,75 + chất lượng lô hạt × 0,25 + gearBonus + hợp hạt + sữa + nước`, kẹp 0–100.
- `gearBonus`: +4 mỗi cấp trên 1 của thiết bị món dùng; +3 mỗi cấp máy xay trên 1.
- Sai loại hạt −5. Matcha: phần hạt cố định 80.
- Sữa Meiji +4, Dalat Milk +2; nước máy −3, Lavie +2 (`BRAND_QUALITY`).

**Giá ly** = `giá món × p × (0,6 + 0,4 × chất lượng/100)` × 0,7 nếu nguội × 1,3 nếu món của ca × 1,1 nếu có Góc rang × 2 nếu chủ quán tự pha (`OWN_CUP`; gồm tay, Pha nhanh, Auto pha).

**Tip** = `tipFactor(p) × giá món × (max(0, sao − 1) × 0,15 + phần kiên nhẫn còn × 0,1 + combo × 0,04 + 0,2 nếu pha theo trí nhớ + tip bàn + Giao tiếp phục vụ ≤ 0,1)`. Ly robot chỉ có phần kiên nhẫn.

**Combo**: ly bạn hoặc nhân viên ≥ 2★ → +1 (tối đa 5); ly < 2★ hoặc khách bỏ về giận → 0. Ly robot gói thử không đổi combo.

**Uy tín** (10–100, đầu 50): bán ly `(sao − 1) × 0,6`, thêm −0,3 nếu 0★ ở món p ≥ 1,2; khách giận hoặc bị chửi −2; hàng đầy hoặc bỏ khi rời ván −1; khách chê ly robot −0,5 (trần −2 cả gói); thưởng ca +1/+2/+3, trượt nặng −1.

**Hạng sao** = `clamp(1 + floor((uy tín − 10)/20), 1, 5)` (`cafeRank`): 10–29 ★ · 30–49 ★★ · 50–69 ★★★ · 70–89 ★★★★ · ≥ 90 ★★★★★.

**Chủ quán đặt giá** (Nâng cấp › Menu): hệ số p mỗi món 0,8–1,3, bước 0,05, mặc định 1; chỉ đổi khi quán **đóng** (`PRICE_MIN`, `PRICE_MAX`). Khách tới thưa/dày theo `p̄^1,5` (p̄ 1,3 → thưa hơn ~48%). Món p > 1: tip × `max(0, 1 − 2(p − 1))`. Thưởng ca không đổi.

## 6. Bàn pha

Modal giữa màn hình (`bench.js`). Đầu modal: order đang chờ (✓ nếu đã có người lo) và mục luyện mọi món (món khóa có 🔒). Thiếu nguyên liệu → liệt kê thứ thiếu, nút mở Kho.

| Loại bước | Cách chơi | Điểm |
|---|---|---|
| Chọn hạt | Chọn lô đủ liều | Đúng hạt 1, khác 0,7 |
| Chọn (xay, kỹ thuật) | Bấm đáp án; sai hẳn thì nút khóa, giải thích, chọn lại | Đúng 1, gần đúng 0,5, đã sai trước đó 0,3 |
| Rót / đun / đánh | Giữ nút (hoặc Space) tới vạch xanh rồi thả; thả trong vạch tự chốt, ngoài vạch thì thêm rồi «Xong». Không rút lại được | Trong vạch 1, ngoài `max(0,1; 1 − lệch/(rộng × 2,5))` |

- Kim từ rỗng tới đầy 3,2 s; khi tự giữ, qua vạch xanh mất ≥ 0,45 s (`handRate`). Bước chờ thật (ủ, nhỏ giọt) tua nhanh 2,6 s, bỏ qua được.
- 💡 Gợi ý (bước chọn), 👀 Xem mẫu (bước rót): bước đó tối đa 0,8.
- **Điểm ly** = `floor(trung bình bước × 100)`. Sao: ≥ 90 ★★★, ≥ 70 ★★, ≥ 40 ★ (`stars`).
- Kết quả: sao, «Điểm theo mô hình game · Chất lượng» kèm ⓘ (không đo vị ly thật), câu chuyện món, bước đúng/sai, «Bưng ly», «Pha món khác», «📓 Ghi sổ», dòng mở khóa barista/trí nhớ. Ly vào tay nếu có khách chờ món đó, không thì lên kệ.

| Cách ra ly (bước 1) | Luật | Thành thạo |
|---|---|---|
| Pha tay | Từng bước | Nâng `best`, tăng `made` |
| ⚡ Pha nhanh | Chờ 6 s (`QUICK_MS`); điểm = `best` của món kẹp 40–90 (`quickScore`) | Chỉ tăng `made` |
| 🤖 Auto pha | 2 xu khi ra ly (`AUTO_BREW_COST`); máy làm từng bước cho xem, mỗi bước ≤ 0,8 → 80 điểm ★★ | Chỉ tăng `made` |

**Pha theo trí nhớ**: món có `best ≥ 90` hiện công tắc; ẩn thông số, vạch xanh, mục tiêu và gợi ý; tip +0,2 × giá món.

**Ly để lâu** (theo thời gian quán mở, `FRESH_MS`): món có đá 90 s, món nóng 60 s. Quá hạn → nguội: −1★, giá ×0,7. Quá gấp đôi → ly trên kệ/tay tự bỏ; ly nhân viên đang bưng thì không. Kệ không giới hạn.

## 7. Thành thạo

- `cafe.mastery[món] = { best, made, tiers }`; chỉ ly pha tay nâng `best`.
- Lần đầu đạt 70 / 90: +15 / +30 XP (`MASTERY_XP`). Mỗi ly bạn/nhân viên bán: +1 + sao XP.
- Barista người pha món có `best ≥ 90 − Trí nhớ × 0,4` (Trí nhớ 50 → 70); thiếu thì bong bóng ❓ chỉ món cần dạy. `best ≥ 90` mở pha theo trí nhớ.

## 8. Công thức (`RECIPES`)

| Món | Giá | Hạt | Mở khi | Bước | Điểm chính |
|---|---|---|---|---|---|
| Phin đen nóng | 2,5 | 20 g vối | Có sẵn | 6 | Xay vừa thô, liều 19–21 g, nắp phẳng, ủ 15–25 ml, châm 60–80 ml |
| Cà phê sữa đá | 3 | 20 g vối | Có sẵn | 7 | Sữa đặc 20–30 ml trước, khuấy tan rồi mới đá |
| Bạc xỉu | 3 | 10 g vối | Uy tín 55 | 4 | Sữa nhiều, cà phê 25–35 ml sau cùng |
| Phin cà phê mít | 3,5 | 20 g mít | Uy tín 55 | 6 | Như phin đen, hạt Liberica |
| Espresso | 3 | 18 g chè | Máy espresso | 5 | Xay mịn, 17–19 g, nén phẳng, chiết 33–39 g |
| Americano | 3,2 | 18 g chè | Máy espresso | 6 | + 100–140 ml nước |
| Cappuccino | 4 | 18 g chè | + Vòi sữa | 8 | Sữa 60–65 °C, bọt dày, 100–140 ml |
| Latte | 4 | 18 g chè | + Vòi sữa | 8 | Sữa 60–65 °C, bọt mỏng, 180–220 ml |
| Cà phê trứng | 5 | 15 g vối | Máy đánh trứng, uy tín 60 | 5 | Chỉ lòng đỏ, đánh 3–5 phút, giữ nóng |
| Cà phê muối | 4,5 | 18 g vối | Máy đánh trứng, uy tín 65 | 5 | Kem 35–45 ml + muối 0,4–0,8 g phủ trên |
| Pour-over V60 | 5 | 15 g chè | Có sẵn | 9 | Vừa mịn, tráng giấy, 14–16 g, 92–94 °C, bloom 25–40 g, rót tới 140–160 g rồi 235–265 g, 2:30–3:00 |
| Matcha | 3,5 | — | Chổi tre | 5 | Rây, 1,8–2,2 g, nước 75–80 °C, đánh chữ W |
| Matcha Latte đá | 4,5 | — | Chổi tre, uy tín 40 | 7 | Matcha 30 ml nước, đá, sữa lạnh 140–160 ml |
| Dirty | 4,5 | 18 g chè | Máy espresso, uy tín 50 | 7 | Sữa lạnh trước, shot đổ lên, không khuấy |

Mỗi ly ghi `SCORE_MODEL_VERSION` để điểm hai phiên bản mô hình không trộn lẫn.

## 9. Nguyên liệu

| Nguồn hạt rang | Luật |
|---|---|
| Lô `starter` save mới | 600 g vối + 300 g chè, chất lượng 70 |
| Từ farm | Farm gửi hạt (2 xu cước); Kho quán → «Đặt farm» tạo đơn 252 g (tối đa 4 đơn quán mở) |
| Nhập hạt ngoài | 500 g vối, chất lượng 65; 75 xu, nơi chỉ quán 45 xu (`supplierPrice`) |
| Hạt cứu trợ | Nơi chỉ quán, tiền dưới giá nhập, hạt dưới 10 g → 300 g vối miễn phí, mỗi ngày công một lần (`RELIEF_GRAMS`) |
| Giữ hạt cho quán | Bật `reserve` thì farm không bán/gửi đi phần quán cần |

Kho quán có sức chứa; hạt đang trên đường tính vào.

| Vật tư (`SUPPLIES`) | Gói | Giá | Kho đầu |
|---|---|---|---|
| Ly & ống hút | 50 ly | 5 | 30 |
| Sữa đặc | ~300 ml | 6 | 300 ml |
| Sữa Dalat Milk / Meiji | 1 lít | 5 / 7 | 1 lít / 0 |
| Nước Lavie | 1,5 lít | 2 | 0 |
| Bột matcha | 30 g | 9 | 0 |
| Đá viên | 2 kg | 2 | 2 kg |
| Trứng gà | 10 quả | 4 | 0 |
| Kem whipping | 250 ml | 6 | 0 |
| Muối biển | 100 g | 1 | 0 |
| Giấy lọc V60 | 40 tờ | 4 | 40 |

- **Sữa và nước** (Kho › Vật tư, `cafe.prefs`): một sữa và một nước cho mọi món; mặc định Dalat Milk + nước máy (miễn phí). Hết sữa đang chọn → dùng loại kia; Lavie hết → nước máy.
- **Nơi chỉ quán**: tự vào quán; không có 🌱, Esc, 📦 Đơn hàng, «Đặt farm».

## 10. Nâng cấp

Modal Nâng cấp: Bàn ghế · Thiết bị · Tự động · Mở rộng · Menu.

**Bàn trong nhà** theo cấp «Quán» của farm: `min(10, 3 + round((cấp − 1) × 7/9))`; giá `140 × 1,42^(cấp − 1)`; cần cấp farm ≥ cấp mới. Mỗi bàn nâng riêng (`TABLE_LEVELS`):

| Cấp bàn | Ghế | Kiên nhẫn ngồi | Tip | Giá |
|---|---|---|---|---|
| Bàn gỗ 2 ghế | 2 | ×1 | 0 | — |
| Bàn 4 ghế | 4 | ×1 | 0 | 60 |
| Ghế đệm + đèn bàn | 4 | ×1,25 | +0,1 | 120 |
| Sofa + hoa tươi | 4 | ×1,4 | +0,2 | 220 |

| Thiết bị (`GEAR`) | Cấp đầu | Giá từng cấp | Tác dụng |
|---|---|---|---|
| Bộ phin | 1 | 40 → 90 | +4 chất lượng/cấp món phin |
| Máy xay | 1 | 80 → 160 | +3 chất lượng/cấp mọi món |
| Máy espresso | 0 | 120 → 200 → 320 | Mở Espresso, Americano, Dirty |
| Ca & vòi đánh sữa | 0 | 60 → 120 | Mở Cappuccino, Latte |
| Máy đánh trứng/kem | 0 | 70 | Mở trứng, muối |
| Bộ V60 + ấm cổ ngỗng | 1 | 60 → 120 | +4/cấp món V60 |
| Chổi tre + bát | 0 | 50 | Mở Matcha, Matcha Latte |
| Trạm pha thêm | 0 | 150 → 260 | 2–3 trạm cho barista |
| Quầy thu ngân 2 | 0 | 180 | Hai khách đầu hàng được nhận cùng lúc |
| Robot thu ngân (kiosk) | 0 | 200 → 300 | 1–2 kiosk; mỗi kiosk −1 s khoảng cách khách |
| Quầy nhận đồ + màn hình | 0 | 160 | Ly mang đi tự gọi khách tới lấy |
| Robot pha espresso | 0 | 350 | Tự pha Espresso/Americano chưa ai lo: 10 s, 70 điểm, ra ★ |
| Sân vườn | 0 | 400 | Thêm bàn 11–12 ngoài vườn |
| Góc rang | 0 | 300 | Mọi ly ×1,1 giá |

Máy và kiosk không chiếm chỗ đội. Ô thiết bị chưa mua có khung viền và biển «＋ icon tên»; bấm mở Nâng cấp › Tự động (kể cả khi Auto bật). Biển Sân vườn/Góc rang: đi tới biển; đủ tiền mở tab Mở rộng, thiếu thì báo số xu thiếu.

## 11. Đội nhân viên

- Tối đa 3 người (`MAX_CREW`), trộn người và robot. Giới hạn vai: thu ngân 2, barista 3, phục vụ 3, tạp vụ 1, quản lý 1. Tab Đội (n/3) · Người · Robot.
- Lương theo ca 4 phút, trả khi thuê; tự gia hạn khi bạn ở quán, quán mở và đủ tiền. Giờ đã trả chỉ trôi khi quán mở và bạn ở quán.
- Đào tạo tới cấp 5 (`STAFF_MAX`), giá `40 × cấp`, +6 mọi chỉ số mỗi cấp; lương × `1 + 0,25(cấp − 1)`. 14 ứng viên người (`CANDIDATES`).

| Vai | Lương | Hiệu ứng |
|---|---|---|
| Thu ngân | 6 | Nhận order sau `3,2 − Tốc độ × 0,022` s; kiên nhẫn khách × `1 + Giao tiếp/400` |
| Barista | 12 | Ly `16 − Tốc độ × 0,1` s, điểm `50 + Tay nghề × 0,4`; cần trạm trống |
| Phục vụ | 6 | `1,6 + Tốc độ × 0,022` m/s, tip + Giao tiếp/1000, bưng 2 ly |
| Tạp vụ | 5 | Cùng tốc độ, dọn `4,2 − Tay nghề × 0,028` s (người khác dọn 5 s) |
| Quản lý ca | 15 | Cả đội × `1 + (Giao tiếp + Trí nhớ)/1400`; mỗi 5 s mua gói vật tư dưới ¼ gói |
| Robot bưng 01–03 | 3 | 2,4 m/s, bưng 1 ly, không tip |
| Robot dọn 01 | 3 | 2,4 m/s, dọn 3,2 s |
| Robot pha 01 | 4 | Chỉ Phin đen nóng, 15 s, 50 điểm |

- Robot thuê khi nút Nhân viên ở farm đã mở; không đào tạo, không mệt, không sự cố.
- **Sao theo người làm** (`STAR_CAP`): robot và máy ★, nhân viên tối đa ★★, chỉ bạn ★★★.
- **Bảng việc** (`claims`): người rảnh nhận việc đúng vai, ưu tiên khách sắp hết kiên nhẫn; không ai làm trùng. Ly bạn đang pha không ai pha trùng; bạn chỉ nhận order chưa có thu ngân giữ. Phục vụ lấy thêm ly thứ hai nếu khách khác chờ đúng món, giao người gần trước. Người từ cấp 3 rảnh thì phụ bưng/dọn; robot giữ một việc.
- **Lười, mệt** (chỉ người, `morale.js`): năng lượng 0–100 theo phiên; tính cách siêng/thường/lười (0,02/0,05/0,14) và một việc ghét cố định theo id. Mỗi việc: cơ hội nghỉ `base + 0,4(1 − E/100)² + 0,15 nếu việc ghét`, trần 0,6. Nghỉ mệt (E < 35) 10 s rồi +30, ghét việc 3 s, lười 8 s. Làm chậm × `1 + 0,4(1 − E/100)`; barista mệt −12 điểm.

**Sự cố** (`INCIDENTS`, chỉ người, tối đa 1 mỗi người mỗi ca lương):

| Sự cố | Ai | Gốc | Tác dụng | Xử lý |
|---|---|---|---|---|
| Mải chơi 📱 | Mọi vai | 0,12 | Đứng yên ≤ 40 s | Chạm người → «Nhắc» |
| Nghỉ ốm 🤒 | Mọi vai | 0,04 | Nghỉ 1 ca, không mất lương | «Thuê robot thay» khi là phục vụ/tạp vụ và vai, đội còn chỗ |
| Chửi khách 😤 | Thu ngân, phục vụ | 0,05 | Báo trước 3 s lúc nhận order/bưng; không chặn → khách bỏ về, uy tín −2, giữ combo | Chạm người trong 3 s |

- Xác suất × `max(0,4; 1 − 0,12(cấp − 1))`; quản lý đang làm × 0,5 cho mải chơi, chửi khách. Chửi khách: cả quán tối đa 1 mỗi ca.
- Ốm tới hạn đầu ca, hai loại kia ở 20–80% ca. Quán đóng hoặc bạn vắng thì giờ ca đứng yên, sự cố chờ; hết ca khi quán đóng thì hủy.
- Không sự cố: 2 ca đầu sau khi thuê, khi gói thử robot đang chạy, uy tín < 30.

## 12. Gói thử robot (một lần)

- Tặng khi nút Nhân viên ở farm mở (`robotGift`: locked → ready → active → done).
- Gồm: Robot pha (thử) 1 ca, tối đa 10 ly, chỉ Phin đen nóng và Cà phê sữa đá, 50 điểm; Robot bưng (thử) 1 ca nếu vai còn chỗ; 200 g vối lô `gift`, +10 ly, +500 ml sữa đặc, +1,5 kg đá. Không chiếm chỗ đội.
- Lỗi cố định: phin nước 100 °C + xay mịn; sữa đá gấp đôi sữa đặc.
- Ly robot: 25% khách chê, bỏ về không trả tiền, uy tín −0,5 (trần −2 cả gói, áp cả khi học). Không ×2, không sao thưởng, không món của ca; không tính mốc ca, không đổi combo, không tăng `stats.served`.
- Báo cáo ca có khối «Ly bạn pha vs ly robot»: số ly, TB ★, khách chê, xu thu, lãi sau hạt + vật tư, lỗi chính. Hết gói thì robot thử rời đi; Robot pha (thử) không thuê được.

## 13. Auto ở quán

Dùng chung lượt với farm (`AUTOPLAY`: 3 × 10 phút); chỉ ⏸ hoặc hết giờ mới dừng.

- Mỗi nhịp: sự cố nhân viên (chửi khách sau 0,6 s, mải chơi 1,2 s) → hậu cần (thiếu vật tư cho order thì mua 1 gói nếu còn ≥ giá + 5 xu; hạt dưới 120 g, farm có ≥ 100 g, không có chuyến đang đi thì gọi hạt) → mở cửa → mang ly trên tay → lấy ly trên kệ → nhận order nếu không có thu ngân → dọn bàn khi hàng chờ mà hết ghế → pha order chưa ai lo → dọn bàn → đứng ở quầy thu ngân.
- Bàn pha: bấm ⚡ Pha nhanh rồi «Bưng ly». Thiếu nguyên liệu → đóng, 20 s không pha. Auto chỉ đóng bàn pha của nó và báo cáo ca. Cửa sổ của bạn đang mở thì Auto làm phía sau, không mở bàn pha.
- Khi Auto bật: chạm sàn, joystick, phím không điều khiển nhân vật; kéo vẫn xoay camera; chạm nhân viên, bàn, biển ô trống, vật Hội đồng vẫn mở bảng.
- **Ca tập**: Auto không chạm cửa, không nhận order, không pha, không bấm van an toàn; chỉ bưng ly đã có và dọn bàn.

## 14. Sổ tay cà phê (Coffee Memory)

Dữ liệu `state/memory.js`, khóa `godbean-memory` (tách save tiến trình); giao diện `memory-ui.js`.

- **Mở**: bục sổ tay 📓 trên quầy (giữa quầy pha và thu ngân) hoặc «📓 Ghi sổ» ở kết quả ly. Tab Ghi sổ · Lịch sử · ＋ Ly ngoài đời · Câu hỏi / Key.
- **Nháp**: mỗi ly bạn **pha tay** xong tạo nháp (không Pha nhanh, Auto pha, ly nhân viên/robot): giá trị từng bước, công thức chuẩn lúc pha, hạt, sữa/nước, điểm mô hình. Tối đa 30 nháp (`MAX_DRAFTS`, bỏ cũ nhất), 500 mục (`MAX_ENTRIES`).
- **Quick Taste**: 6 thuộc tính 1–5 (hương thơm, vị chua, vị ngọt, vị đắng, độ đậm đà, hậu vị) + mức thích + ghi chú. Không cộng thành «độ ngon». Ly cũ ẩn tới khi «Chốt cảm nhận»; sau đó gợi ý ly để so và ô Insight (Quan sát · Giả thuyết · Lần sau đổi).
- Chế độ Nhanh / Nhật ký / Scientist (cần Key of Curiosity), nhớ lần cuối. «Lần sau đổi» hiện một dòng khi mở bàn pha món đó.
- So sánh A/B: đổi ≥ 2 biến thì cảnh báo; điểm chỉ so khi cùng `modelVersion`; lệch ≤ 5% coi như giống (`STEP_TOLERANCE`).
- XP: ly game +3, ly ngoài đời +5, Insight đủ 3 ô +5; tối đa 30/ngày công (`MEMORY_XP`). Cảm nhận không đổi giá, sao, uy tín.

## 15. Mẹo thiên đàng và Hội đồng

- Mẹo đã thuộc: `recipe` → Phin đen nóng và Cà phê sữa đá bắt đầu `best` 40; `adjust` → kết quả ly có «Sửa bước này trước»; `customer` → uy tín +3 một lần. Câu chưa thuộc hỏi lại ở báo cáo ca hoặc kết quả ly dưới 70 điểm.
- **Vật Hội đồng** trong sảnh: ẩn tới khi chuyên gia đầu có mặt; có người chờ thì sáng, biển «✨ Mới». Chạm mở hội thoại tại chỗ chỉ khi cửa đóng. Ca thường đầu tiên ở nơi có quán gọi chuyên gia nhóm kinh doanh (`councilArrive('business')`). Luật Hội đồng: [02 · Thiên đàng](../02-heaven/README.md).

## 16. Bố cục 3D

- Map 32 × 24 m. Dãy quầy sau (z −10,6), mỗi thiết bị một ô cố định: 3 trạm pha, kệ giao ly, bục sổ tay, 2 quầy thu ngân, quầy nhận đồ, tủ bánh. Lối nhân viên phía sau (z ≈ −12,15).
- Sảnh: hàng chờ dọc dây chắn, 2 kiosk, chỗ chờ mang đi, vật Hội đồng, bảng thực đơn (mở Sổ công thức), kho góc trái (mở Kho). 8 bàn trong nhà, 2 bàn hiên, 2 bàn Sân vườn; biển Sân vườn và Góc rang.
- Cửa: đóng thì chặn người ngoài, từ trong đi ra tự mở. Lần đầu vào, nhân vật đứng ở hiên.
- Khách và nhân viên dùng chung lưới `findRoute`; ghế là vật cản; người đi bộ né nhau và né người chơi. Bấm vật thì khung sáng đúng cỡ dưới chân vật.
- Điện thoại dọc: camera nhìn vào dãy quầy (`portraitView`).

## 17. Debug

- `?debug=grid`: lưới ô đi được/bị chặn, điểm đứng, tuyến kiểm. G vẽ lại, H kiểm trường hợp xấu nhất; `window.__cafeLayoutAudit`, `__cafeBlockersAt(x, z)`. Thêm đồ mới thì thêm vào `layoutPoints()` / `LAYOUT_ROUTES`, H phải ra 0 lỗi.
- `?debug=incident`: `__forceIncident(id, type)`, `__incidentOdds(id)`.
