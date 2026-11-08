# 3 giống cà phê, cây lâu năm & vùng trồng (nông trại)

> Đã code (2026-11-08), branch `feat/coffee-varieties`. Phạm vi: chỉ nông trại. Café chỉ cần đọc được kho hạt mới.

## 1. Đối chiếu thực tế (cơ sở thiết kế)

| | Arabica (cà phê chè) | Robusta (cà phê vối) | Liberica/Excelsa (cà phê mít) |
|---|---|---|---|
| Trồng | Khó: 800–2.200 m, 15–24°C, dễ gỉ sắt lá | Dễ: 0–800 m, 22–30°C, kháng bệnh | Dễ: chịu nóng, đất xấu, đất ẩm |
| Năng suất | Thấp (~0,5–1,5 t/ha) | Cao (VN ~2,5–3 t/ha) | Thấp: quả to nhưng tỷ lệ nhân thấp |
| Caffeine | ~1,2–1,5% | ~2,2–2,7% (mạnh nhất) | ~1,2–1,5% |
| Vị | Thơm, chua thanh | Đắng, đậm | Khói, gỗ, mùi mít |
| Giá | Cao nhất | Rẻ | Ngách |
| Đặc điểm | Tự thụ phấn; quả chín thì rụng | Không tự thụ phấn; quả chín bám cành | Cây 10–20 m; chín không đều |

Vì vậy Liberica **không** phải "nhiều hạt, cực mạnh". Nó là cây chịu đựng, dành cho lúc người chơi offline.

## 2. Vai trò & số liệu (`src/core/config/economy.js` → `CROPS`)

> Từ 2026-11-08, giá cây giống, thời gian lớn và XP trong bảng này đã được thay bằng số liệu ở mục 2b (cây lâu năm). Hạt, giá hạt và các cơ chế chăm sóc vẫn như dưới đây.

| | Robusta | Arabica | Liberica |
|---|---|---|---|
| Vai trò | Người chơi chủ động, nuôi xưởng chế biến | Người chơi tối ưu, bán thô giá cao | Người chơi offline |
| Mở khoá | Lv1 | Lv3 | Lv5 (trước đây: Round 2) |
| Giá hạt giống | 2 | 5 (cũ 6) | 4 (cũ 16) |
| Thời gian lớn | 15 s | 45 s (cũ 40) | 120 s + 45 s đợt 2 |
| Hạt / lần trồng (1★) | 2 | 3 (cũ 4) | 3 (đợt 1: 60%, đợt 2: phần còn lại) |
| Hạt / phút / ô (sản lượng) | 8 | 4 | ~1,1 |
| Giá / hạt thô | 2 | 5 | 3 |
| XP | 1 | 3 | 5 (chỉ tính 1 lần, ở đợt cuối) |
| Hái tươi (3★) trong | 30 s | 10 s | 600 s |
| Chế biến (sấy → rang → đóng túi) | Có | Có + thưởng đặc sản | Có + thưởng đặc sản |

Cơ chế chăm sóc riêng:
- **Arabica rụng quả:** chín quá 30 s thì cứ mỗi 20 s mất 1 hạt (tối thiểu còn 1). Cây đang rụng có hiệu ứng quả rơi. Ô đất hiện "Quả đang rụng: hái ngay!".
- **Robusta thụ phấn chéo:** nếu mọi ô xung quanh trong bán kính 3,5 m đều trồng **giống khác** thì −1 hạt. Ô trống hoặc ô đứng một mình không bị phạt. Bản đầu phạt cả ô đứng một mình, nhưng như vậy làm chậm đầu game gấp đôi (lúc đó chỉ có 1 ô ruộng), nên đã bỏ.
- **Liberica 2 đợt:** đợt 1 cho 60% số hạt, cây ở lại, 45 s sau chín đợt 2. Không bao giờ hỏng.

## 2b. Cây lâu năm, trồng theo hàng (founder chọn phương án B, 2026-11-08)

Ngoài đời, cà phê là **cây lâu năm**: trồng một lần, 2–4 năm sau mới ra quả, rồi thu hoạch hằng năm trong 20–30 năm. Cây được trồng **theo hàng** (Robusta khoảng 3×3 m, Arabica 2×1,5 m, Liberica 5×5 m), có **bồn** quanh gốc, cỏ giữa hàng và cây che bóng. Vùng cao làm **bậc thang**. Game giờ làm theo đúng như vậy.

**Vòng đời một cây:**
- Trồng cây giống (trả tiền 1 lần) → vụ đầu (`growSeconds`) → chín → hái.
- Sau khi hái, **cây vẫn ở lại**. Mỗi mùa (`cycleSeconds`) cây ra hoa trắng → quả xanh → chín.
- Sau `life` vụ, cây **già** và chỉ còn 50% số hạt.
  - **Cưa đốn phục hồi** (`farm/prune`): tốn 60% giá cây giống. Cây mọc lại trong 60% thời gian vụ đầu, rồi trẻ lại.
  - **Chặt bỏ** (`farm/uproot`): miễn phí, không hoàn tiền. Ô trống để trồng giống khác.

**Số liệu:**

| | Robusta | Arabica | Liberica |
|---|---|---|---|
| Cây giống (trả 1 lần) | 15 | 35 | 30 |
| Vụ đầu | 60 s | 120 s | 240 s |
| Mỗi mùa sau đó | 36 s | 80 s | 150 s (+45 s cho đợt 2) |
| Tuổi thọ (số vụ) | 40 | 30 | 50 |
| XP mỗi mùa | 2 | 4 | 6 |

Các số khác (hạt, giá, rụng quả, thụ phấn, 2 đợt) giữ như mục 2.

**Hình ảnh:**
- Bồn tròn quanh gốc thay cho ô đất vuông.
- Các cây cùng hàng trong một lô được nối bằng dải đất phủ.
- Cao nguyên có bờ đá bậc thang ở mép dưới mỗi hàng.
- Trung du và cao nguyên có cây che bóng ở đầu hàng.
- Hái xong cây chỉ rung nhẹ, không biến mất.

**Bản đồ đồn điền (founder chốt 2026-11-08: mặt đất phẳng + cảnh đồi, mỗi ô là một hàng cây):**
- **Mỗi ô là một luống** (gò đất dài 2,3 m) có 3 cây. Liberica 2 cây to vì trồng thưa. 3 ô cạnh nhau nối thành một hàng dài, nên mỗi lô có 2 hàng kín cây.
  - Vị trí và số ô mỗi lô giữ nguyên, nên save cũ và kinh tế không đổi.
  - Hái 1 lần là xong cả luống.
- **Mặt đất đổi màu dần theo độ cao** về phía bắc: đồng bằng xanh nắng → trung du lộ đất đỏ bazan → cao nguyên xanh đậm.
- **Đồi cà phê bao quanh**, nằm ngoài khu chơi: phía bắc đồi cao, hai bên đồi thấp. Trên đồi có các đường hàng cây chạy theo đường đồng mức. Đây chỉ là cảnh, không chạm vào được.
- **Mở rộng đất:**
  - Đất chưa mua vẫn là đất hoang (bụi, đá).
  - Biển trên lô đang bán ghi vùng + giá, ví dụ "⛰️ Trung du · 🪙 1.800".
  - Thẻ lô ghi vùng, loại đất (phù sa / đỏ bazan / sương mù bậc thang / đất ẩm ven ao) và giống nào hợp (★ rất hợp, ✓ được, − bị phạt).
  - Nút mua đổi thành **🪓 Khai hoang**.

**Bổ sung sau khi xem ảnh chụp (2026-11-08):**
- Cây trên luống to hơn (khoảng 1,5×). Luống thấp và hẹp lại để không giống chậu hoa.
- Cây che bóng đứng giữa 2 hàng của mỗi lô ở trung du và cao nguyên.
- **Hàng cây dày nhiều lớp:** mỗi ô có 2 lớp cây so le (Robusta 4×2, Arabica 5×2, Liberica 3×2). Tán cây to đè lên nhau. Luống phủ kín bề ngang nên các ô liền thành một hàng. Lối đi giữa các tầng khoảng 0,5 m, người hái đứng sát mép tầng giữa các cây (`ROW`, `BENCH_DEPTH` trong `plots.js`).
- **Tầng ruộng bậc thang:** ở trung du và cao nguyên, mỗi hàng cây nằm trên một tầng đất đắp có tường đá kè ở mặt dốc (phía nam). Hàng càng về phía bắc của lô càng cao.
  - Độ cao mỗi bậc: trung du 0,22 m, cao nguyên 0,45 m (`TERRACE_STEP` trong `plots.js`).
  - Cây và luống đặt trên mặt tầng. Lối đi trước tầng, chỗ người hái đứng, vẫn ở mặt đất.
- Trung du lộ từng mảng đất đỏ bazan qua lớp cỏ.
- Đồi nền ở phía bắc và phía đông (camera nhìn về hướng đông bắc). Camera ở nông trại zoom ra được tới 2,4.
- Đất hoang là rừng cần khai hoang: cây rừng cao, gốc cây đã chặt, bụi thưa hơn.
- Ảnh kiểm tra được chụp bằng Chrome chạy ẩn ở khung 390×844, dùng save tạo từ sim.

**Quản lý, công nhân và sim:**
- Công nhân chỉ trồng vào bồn trống.
- `D.betterCropFor` cho biết khi nào một cây nên được thay bằng giống tốt hơn (≥ 1,3×). Ví dụ: Robusta ở trung du khi Arabica vừa mở khoá.
- Sim cưa đốn cây già và thay cây khi có giống tốt hơn.

**Save cũ:** cây đang trồng vẫn chạy bình thường. `born` mặc định là `plantedAt`, `n` mặc định là 0.

**Sim (main → branch):**

| Kiểu chơi | main | Branch | Lệch |
|---|---|---|---|
| Chơi chủ động, Lv10 | 15:54 | 17:00 | +7% |
| Không xây xưởng | 14:48 | 15:30 | +5% |
| Giao việc, Lv10 | 21:00 | 20:00 | −5% |
| Luôn trồng Liberica | — | 18:00 | |

Chế biến lãi 350 xu/phút so với bán thô 285 xu/phút (+23%).

## 3. Vùng trồng (`layout.js` → `CLIMATE_OF`)

Nông trại mọc dần lên phía bắc, tương đương với lên cao dần.

| Vùng | Lô | Màu đất | Hiệu ứng |
|---|---|---|---|
| 🌾 Đồng bằng | F1, F2, F5, F6, F13, F14, Y0, W1, D1 (phía nam đường chính) | Nâu phù sa | Arabica: −1★, chậm 30% |
| ⛰️ Trung du | F3, F4, F7–F12, F15, F16, P1, P2 | Đỏ bazan | Trung tính |
| 🏔️ Cao nguyên | F17, F18, W2–W5, P3, P4, G1, O2, H1 | Nâu sẫm mùn | Arabica +1★ |
| 💧 Ven ao | PD1, O1 | Nâu xám bùn | Arabica: −1★, chậm 30%; Liberica +1★ |

- Không vùng nào cấm giống nào, nên người chơi không bao giờ bị kẹt.
- **Lô trung du sớm:** F3 (180 xu, mua được khoảng phút thứ 6) đã là trung du. Arabica có chỗ trồng đúng vùng ngay khi mở khoá, sớm hơn yêu cầu Lv5–10.
- **Khi cầm hạt giống:** ô hợp giống phát sáng xanh, ô bị phạt phát sáng vàng. Ô đất ghi tên vùng và mức hợp với giống đang cầm.
- Chữ "terrain" trong code đã dùng cho loại lô (meadow, pond…). Vì vậy vùng trồng dùng tên `climate`.

## 4. Kho hạt theo giống

- `inventory.beans` vẫn là **tổng** số hạt, nên café, sức chứa kho và giao diện cũ không phải sửa.
- `inventory.beanMix = { robusta, arabica, liberica }` lưu số hạt từng giống, luôn cộng lại bằng tổng.
- **Lấy hạt dùng** (café, xưởng sấy, thử nghiệm món): giống rẻ nhất đi trước.
- **Mẻ đặc sản:** sản phẩm sau chế biến không phân biệt giống. Để Arabica và Liberica giữ được giá cao khi đi qua chế biến, mỗi hạt của giống đắt hơn trong mẻ sấy được thưởng (giá thô của nó − 2) xu khi thu mẻ (`RECIPES.dry.premium`), kèm toast "Mẻ đặc sản".
  - Lý do: bản đầu cho Arabica "chỉ bán thô" thì chế biến lãi ít hơn bán thô (sim: 263 so với 424 xu/phút), khiến xưởng vô dụng.
- **Bán một phần:** giống đắt nhất bán trước. Kho hiện số hạt và giá của từng giống.
- **Save cũ:** nếu thiếu `beanMix` hoặc số liệu lệch, toàn bộ hạt được tính là Robusta (`state.js`). Khi reset ở Lv10, kho giống cũng được xoá.
- Mọi chỗ ghi vào kho hạt đều đi qua `addBeans` / `takeBeans` (`game.js`).

## 5. Quản lý, robot và chế độ tự chơi

- `D.bestCropFor(s, plotId)`: chọn giống tốt nhất cho vùng của ô đó.
  - Giá trị một lần trồng = xu + XP × 6 (`CLIMATE_PICK`).
  - Tốc độ = min(số ô / thời gian lớn, sức lao động / số lần thao tác). Liberica tính 3 thao tác vì hái 2 đợt.
- **Kế hoạch ngày của quản lý:** mỗi lô được giao giống hợp vùng. Một giống đang bị phạt ở lô đó sẽ không được giữ lại.
- **Công nhân và robot:** dùng `pickCropFor`, thứ tự ưu tiên là kế hoạch ngày, rồi hạt người chơi đang chọn, rồi giống tốt nhất cho vùng, rồi giống rẻ nhất.
- **Thứ tự thu hoạch:**
  - Công nhân có kỹ năng `ripeFirst`: hái ô gấp nhất trước (Arabica sắp rụng > Liberica đợt 1 > ô chín lâu nhất).
  - Công nhân khác: hái Arabica gần nhất trước, nếu không có thì hái ô gần nhất.

## 6. Kết quả sim (`node scripts/economy-sim.mjs <phút> farm 1 <persona>`)

| Kiểu chơi | main (138c4cf) | Branch này | Lệch |
|---|---|---|---|
| Chơi chủ động, Lv10 lần đầu | 15:54 | 16:06 | +1% |
| Chơi chủ động, không xây xưởng | 14:48 | 14:54 | +1% |
| Giao việc, Lv10 lần đầu | 21:02 | 19:42 | −6% |
| Xu/phút phút 35–45: có chế biến so với bán thô | 287 / 269 (+7%) | 486 / 405 (+20%) | Xưởng vẫn đáng xây |

- Sim in thêm số lần trồng từng giống (`plant:<crop>`).
- `npm test`: 174/174 pass.
- Biến môi trường `SIM_CROP` ép sim luôn trồng một giống.

## 7. Hình ảnh

Cây được vẽ bằng instancing nên mỗi giống chỉ khác ở kích thước và màu:

| | Rộng | Cao | Lá | Quả chín |
|---|---|---|---|---|
| Arabica | 0,82× | 0,72× | Xanh đậm hơn | Đỏ tươi |
| Robusta | 1× | 1× | Màu gốc GLB | Màu gốc |
| Liberica | 1,3× | 1,85× | Xanh vàng đậm | Đỏ sẫm |

Bảng chọn hạt có:
- Giá mỗi hạt và vùng hợp.
- Thẻ thông tin cho giống đang cầm: tên Việt và tên khoa học, độ khó, sản lượng, độ mạnh, giá, cách chăm, 1 sự thật thực tế.
- Đủ chữ tiếng Việt và tiếng Anh.

## 8. Chưa làm / đề xuất sau

- **Arabica ưa bóng râm:** đề xuất cây trang trí đặt cạnh ruộng Arabica cho +1★. Chưa code.
- **Model riêng cho từng giống:** hiện chỉ scale và đổi màu từ `coffee-tree.glb`. Muốn có hình lá và quả khác hẳn thì cần thêm 2 GLB.
- **Café:** giá ly theo giống hạt, đơn đặc biệt "cà phê mít".
- **Nút "trồng trước khi rời game":** gợi ý Liberica khi người chơi sắp offline.
