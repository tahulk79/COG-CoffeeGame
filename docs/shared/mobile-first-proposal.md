# Đề xuất mobile-first: 10 quyết định thiết kế

| | |
|---|---|
| Trạng thái | **Đề xuất** — chưa phải luật. Chờ sếp duyệt; chưa có F-xx trong GDD nên **chưa được code** (AGENTS.md) |
| Ngày | 05/11/2026 |
| Người quyết | Quang uỷ quyền Claude tự quyết (05/11), qua 2 workflow: 40 agent tra cứu game + quyết + phản biện 2 lăng kính (luật/save, người chơi mobile), rồi 11 agent gộp và soát chéo |
| Nguồn | [Ý tưởng mobile-first](../design/ideas/2026-11-05-mobile-first-don-gian-hoa.md) · [Review toàn luồng](../design/audits/2026-11-05-review-luong-mobile-first.md) mục 9 |
| Giới hạn | Chưa chạy sim, test, game hay playtest. Số chưa có ghi "cần sim `scripts/balance-sim.mjs`". Chưa đọc trực tiếp PDF founder cho luồng mở đầu (Q1 R17) |

Khi sếp duyệt câu nào: thêm dòng F-xx vào GDD §0.3, sửa tài liệu màn ghi ở mục "Tài liệu phải sửa" của câu đó **cùng lúc**, rồi mới code.

## 1. Tóm tắt

| Câu | Chủ đề | Quyết định | Đổi luật đã chốt | Chờ sim |
|---|---|---|---|---|
| Q1 | Luồng mở đầu | Chọn B'' (B' có sửa): trước farm chỉ còn thiên đàng mini 1 chạm. Ba chuyên gia không mở cùng lúc thành một bài đố 6 câu mà xuất hiện so le theo ngữ cảnh, tại Cổng Hội đồng trong farm và một vật 3D trong quán. Chỉ gặp được ở lúc không áp lực. Câu chưa gặp chuyên gia không bao giờ bị hỏi lại. Chốt hướng ngay; quà để Q2 quyết, mốc thời gian chờ playtest. | Có (8) | Có (3) |
| Q2 | Quà khởi đầu | Bỏ thẻ chọn 3 hành trang ở 02-mini: mọi người chơi mới nhận cố định Túi hạt giống ('seeds') bằng 1 chạm "Nhận". Không lập "Quà Hội đồng" có lựa chọn, và không thêm lần trao quà nào khi chưa sim. Việc nâng quán khởi đầu theo mốc quán chỉ là phương án dự phòng, chờ sim. Tất cả ở trạng thái Đề xuất, đi cùng Q1 = B', chờ sếp duyệt và đối chiếu PDF founder. | Có (9) | Có (3) |
| Q3 | Bản đồ chọn sẵn Việt Nam | CÓ, theo phương án lai. Lần chọn vùng đầu tiên (save chưa có `startingRegion`), bản đồ mở toàn cảnh rồi tự chọn sẵn Việt Nam, dùng thẻ thu gọn không có nhãn xếp hạng. Không lưu gì trước khi bấm «Trùng sinh ở đây». Giữ đủ ba luật F-28: ẩn loại nơi, cảnh báo «không đổi được», khóa vĩnh viễn. Đây là đánh đổi với mục đích của 02b README:17, nên sếp phải duyệt trước khi code. | Có (5) | Có (3) |
| Q4 | Trục Cấp | Q4 chỉ chốt HƯỚNG "Cấp mở, xu trả, uy tín đo sức khoẻ quán, Awakening theo sự kiện", còn XP thợ/robot/tự nhận = 0 thì chờ sếp quyết là sửa lỗi hay đổi kinh tế (mục 4 câu 3). Mọi mốc cấp, harvestXp và LEVEL_XP đều chờ sim scripts/balance-sim.mjs. Thêm luật chống kẹt mềm, luật giữ quyền save cũ có trường lưu, nguồn hạt chè cho V60 ở cấp 1, xử lý riêng theo loại nơi (chỉ trồng / chỉ quán), và cờ nguồn hành động cho Auto. Chưa được code khi sếp chưa duyệt, GDD chưa có dòng F-xx và AGENTS.md chưa được người dùng sửa. | Có (6) | Có (9) |
| Q5 | Gieo / thu theo ruộng | Giữ lõi: không có nút, chạm giữ hay cử chỉ nào "Gieo/Thu cả ruộng" một lần. Gieo bằng chạm 1 ô, hoặc chạm ô rồi kéo túi hạt qua nhiều ô (kéo-gieo mở từ save mới). Thu bằng chạm cây chín là hái ngay (giữ hành vi sẵn có; chỉ đổi nhánh đang cầm công cụ khác thì vẫn hái). Kéo 🧺 và dụng cụ chăm vẫn chờ mốc ⛏️. "Hái tay" cho Decode ripe phải loại lô do Auto hái. Hiện chỉ là đề xuất sửa tài liệu, code chờ "Đã chốt" và có dòng F-xx. | Có (6) | Có (4) |
| Q6 | Tự chế biến | Giữ hướng lai nhưng sửa lại. Người chơi tự nhận thành phẩm từ đầu, như luật hiện hành. Tự nhận vào kho là nấc 2 của chỉ thị "Tự chế biến" có sẵn, không làm công tắc trạm mới, và mở ở mốc tự động hóa (tạm đề xuất cấp 7, chờ Q4 và sim). Khi mở khóa, nấc này mặc định TẮT. XP không được thấp hơn khi thợ nhận. Bỏ R4 (trạm tự xếp rang). Sân phơi không tự nhận cho tới khi câu Decode dry-wait có đủ cặp mẫu. | Có (6) | Có (4) |
| Q7 | Quán ca tập | Đề xuất chọn bản lai đã sửa cho Q7. Ca tập (chưa có `cafe-intro`) tự mở ngay trong `service.update()`. Ca tập chỉ có 1 khách và khách đó gọi V60. Ca tập không có giờ hết và kết thúc ngay khi bán xong ly đầu, kèm một báo cáo tích cực. Mọi điểm Mở/Đóng (nút 🚪 trên HUD, mục open-cafe ở farm, cửa 3D, Auto) đều khóa trong ca tập. Cửa được dạy qua nút «🚪 Mở ca mới» có sẵn trong báo cáo ca. Tất cả vẫn là đề xuất cho tới khi sếp duyệt, chưa được code. | Có (9) | Không |
| Q8 | Làm mẫu ly V60 đầu | CÓ làm mẫu ly V60 đầu, dùng lại hệ 💡/👀 có sẵn. Ly làm mẫu là ly tự pha, không mang `demo`. Bật theo tutorial id 'v60-guided' (không dùng `made === 0`). Chỉ bước chọn bị kẹp 0,8, bước rót không bị kẹp. Đây là luật mới: ghi Đề xuất ở F-40 và chưa code tới khi sếp duyệt. | Không | Không |
| Q9 | Sự cố nhân viên | Ẩn sự cố nhân viên bằng một miễn trừ do thiết kế đặt, không thêm nút tắt. Ngưỡng là cấp người chơi, gắn vào sự kiện "mở chỗ thợ thứ 2 + 1 cấp" chứ không ghi cứng số 9; sự cố bật dần, không nhảy từ 0 lên đủ xác suất; sự cố đầu luôn là Mải chơi. Chốt hướng ngay; con số chờ Q4 và sim; chỉ ghi thành đề xuất, chưa sửa đặc tả màn. | Có (5) | Có (5) |
| Q10 | Công trình thay nút HUD | Chọn hướng thay nút HUD bằng công trình, nhưng chỉ làm 4 công trình: Cửa quán, Bảng đơn, Sạp ven đường, Nhà thợ. Không dựng Xưởng nâng cấp; nâng cấp nằm trên từng vật thể, còn danh sách tổng để trong ≡. Cổng Hội đồng chuyển sang Q1. Mỗi nút HUD chỉ được gỡ khi công trình tương ứng chạm trúng được ở khung dọc 375×812. Toàn bộ vẫn là đề xuất, vì idea đang ở trạng thái "Đang xem" (chưa Đã chốt). | Có (6) | Có (2) |

## 2. Thứ tự mở khoá thống nhất

- 0. Bấm Chơi → intro (Bỏ qua được từ giây 0) → 02-mini ≤ 5 hộp, hộp 5 là lời tiễn kèm nút Nhận ❧ Túi hạt giống (Q1, Q2) → hoạt cảnh vào cổng → bản đồ VN chọn sẵn, 3 chạm (Q3). Mục tiêu ≤ 60 s chưa đo, cần playtest.
- 1. Farm, Cấp người chơi 1, tutorial ép `farm-intro` (id mới, phải thêm vào TUTORIAL_IDS ở content.js:71 và contracts.md §5): gieo (chạm 1 ô → kéo-gieo 🌱 qua 2 ô), hái bằng chạm cây chín (giữ hành vi sẵn có), phơi rồi nhận tay ở giỏ, rang rồi nhận tay (Q5, Q6). Không có hộp hỏi nào. Cửa hàng hạt / Sạp chỉ mở theo nhu cầu khi hết hạt mà còn ô trống.
- 2. Khi `farm.tutorial.seen` có `farm-intro` và stats.harvested ≥ 1 (kiểm ở cả lúc xong farm-intro lẫn tại game.js:940) → Cổng Hội đồng dựng lên, Thần Nông có mặt (Q1 R5a). Chấm Mới, không ép gặp.
- 3. Sự kiện 'nhiệm vụ harvest' (`when` cafe-play hiện tại, chỉ nơi both) → Cửa quán `cafe-entrance` dựng lên (Q10). Nơi chỉ quán thì vào thẳng quán.
- 4. Vào quán lần đầu và có lô chè rang ≥ liều V60 → ca tập tự mở, 1 khách V60 đứng sẵn, thẻ 3 bước, ly làm mẫu `v60-guided` (Q7, Q8). Nút 🚪, door và open-cafe bị khoá.
- 5. Sự kiện ly đầu (served ≥ 1) → Memory/Quick Taste → báo cáo ca tập kèm nút Mở ca mới (dạy cửa) → Thần Pha Chế có mặt, vật Hội đồng trong quán dựng lên. Nếu V60 ≥ 70 thì câu First Sixth Key 'sẵn sàng'.
- 6. Sự kiện shift_ended đầu tiên của ca thường (ca 2) → Thần Thương Hội có mặt. Phân biệt ca tập: `learning` chỉ là trường của object ca (cafe/service.js:503), không vào save và không có trong payload shift_ended (model.js:650), nên phải thêm `learning` vào choice/payload của act('shift') hoặc đếm số ca thường đã lưu trong save; ghi vào contracts.md.
- 6b. Nơi chỉ trồng: lần bán đầu → Pha Chế; workday_ended tiếp theo → Thương Hội. Nơi chỉ quán: ly đầu → Nông, rồi Pha Chế xếp hàng sau; ca 2 → Thương Hội.
- 7. Theo cấp (pha 1 giữ `when` hiện có; pha 2 theo bảng cấp Q4, mọi số cần sim scripts/balance-sim.mjs): Sạp ven đường thường trực (đề xuất cấp 2, cần sim), mục Nâng cấp trong ≡ (code hiện cấp 2).
- 8. Ruộng 2 kèm mốc ⛏️: kéo 🧺 và dụng cụ chăm (đề xuất cấp 3, cần sim). Nhà thợ / chỗ thợ 1 (code hiện cấp 3). Bảng đơn (đề xuất cấp 4, cần sim). Xây dựng / Trang trí (code hiện cấp 4).
- 9. Mít và ruộng 3 (đề xuất cấp 5, cần sim).
- 10. Thiết bị và món theo cấp, đề xuất 6–12, cần sim. Nơi chỉ quán có thiết bị đặc trưng từ cấp 1.
- 11. Ruộng 4 và Giỏ tự vào kho (nấc 2 Tự chế biến, mặc định tắt), đề xuất cấp 7, cần sim. Tối đa khoảng 2 thứ mỗi cấp.
- 12. Chỗ thợ 2 ở farm và quán (đề xuất cấp 9, cần sim).
- 13. Sự cố nhân viên ở INCIDENTS.minLevel = cấp chỗ thợ 2 + 1 (cần sim), tăng dần M/r, sự cố đầu là Mải chơi, có trần N; số cần sim scripts/balance-sim.mjs.
- Xuyên suốt: Coffee Memory, Quick Taste 6 thuộc tính, Decode (6 câu open), First Sixth Key và V60 có từ cấp 1, không có điều kiện cấp.

## 3. Lát triển khai

| Lát | Bị chặn bởi | Câu hỏi còn mở |
|---|---|---|
| L0 – Tài liệu: ghi 10 quyết định đã vá ở trạng thái Đề xuất vào idea/audit. Thêm các dòng F-xx/D-xx 'Đề xuất' vào GDD mục 0, ghi tiến độ ngày. Đối chiếu PDF founder (Q1 R17, Q2 R10). | Không bị sim chặn. Chỉ ghi Đề xuất, chưa sửa đặc tả màn. | Số F-xx còn trống (F-44 đã có chỗ dành)?; Trang FTUE/thiên đàng nào của PDF founder là căn cứ? |
| L1 – Sửa lỗi độc lập: Pha nhanh trên món mới làm best = 40 (Q8 rule 14). Sửa awakening/rules.js:47 để cặp ripe chỉ gồm player với staff, và thêm cờ `via` trên act (Q4 A10, Q5 R7). | Không chờ sim. Cần sếp duyệt vì đụng hệ Decode (P0). | Sửa code Pha nhanh, hay ghi thành ngoại lệ trong tài liệu? |
| L2 – 02-mini cộng quà seeds cố định 1 chạm, Bỏ qua 1 lần bấm, analytics mode/region_type (Q1 R1–R4, R16; Q2 R1–R4, R6–R9). | Sếp duyệt Q1 và Q2 cùng F-xx. Không chờ sim, trừ Q2 R5. | PDF founder có bắt buộc chọn hành trang không? |
| L3 – Bản đồ chọn sẵn VN: select auto, thẻ thu gọn, world.preselectHint, preselected trong analytics (Q3). | Sếp duyệt. Không chờ sim; độ trễ và camera chỉnh khi playtest. | Sếp có chấp nhận đánh đổi nghiêng về loại 'both' (02b README:17) không? |
| L4 – Hội đồng so le: farm.lessons.met, action lessons/council, chặn hỏi câu chưa gặp (R10), Cổng Hội đồng và vật 3D trong quán, save cũ R15 (Q1 R5–R15). | Sếp duyệt Q1, có định nghĩa `farm-intro` (L5), và vị trí theo cổng CT-11 của L7. Không chờ sim. | Mốc ở nơi chỉ trồng: stats.sold rồi workday_ended, đã đúng chưa?; Hình dạng vật 3D trong quán? |
| L5 – Tutorial ép `farm-intro` cộng kéo-gieo 🌱 từ đầu, chạm cây chín vẫn hái khi đang cầm công cụ khác (chạm không cầm công cụ đã hái ngay, giữ hành vi sẵn có), hoãn offerLesson (Q5 R1–R7, R10–R12, Q1 R11). | Sếp duyệt và có F-xx. Không chờ sim (XP vẫn +6 tới khi xong L9). | Tutorial ép gồm đúng 4 bước gieo/hái/phơi/rang? |
| L6 – Ca tập quán cộng ly V60 làm mẫu (Q7 R1–R10, Q8 rule 2–13), điều kiện có chè rang. | Sếp duyệt và quyết câu Auto. Không chờ sim; lượng chè bù về lâu dài thuộc L9. | Auto có được nhận order V60 của ca tập không?; Lô starter có luôn đủ chè cho ly đầu ở mọi nơi có quán không? |
| L7 – Công trình pha 1: cafe-entrance, Sạp, Bảng đơn, Nhà thợ theo `when` hiện tại, cổng CT-11, vùng cấm xây, Nâng cấp vào ≡ (Q10 CT-1..CT-16). | Sếp duyệt. Không chờ sim; toạ độ chờ playtest 375×812. | Toạ độ trong FARM_BOUNDS cho từng công trình? |
| L8 – Q4 lớp A không có số: tên 'Cấp người chơi', thứ tự kiểm ruộng liền kề → cấp → xu (chưa đặt số cấp), uy tín thôi mở món, cafe.legacyRecipes, XP chỉ cho người chơi. | Sếp duyệt. Phần XP về 0 nên chạy sim trước khi gộp. | Món espresso/matcha thôi khoá có làm quán tăng tốc mà sếp chấp nhận không?; Thợ/trạm 0 XP: là sửa lỗi hay đổi kinh tế?; AGENTS.md dòng mua ruộng do người dùng sửa |
| L9 – Bảng cấp và số: harvestXp, LEVEL_XP, mốc ruộng/giống/thiết bị/công trình (pha 2 của Q10), lượng chè bù, XP bù cho nơi chỉ trồng. | Chặn bởi sim scripts/balance-sim.mjs. | Cần sim scripts/balance-sim.mjs cho 5 hồ sơ (tay, Auto, both, chỉ trồng, chỉ quán) |
| L10 – Giỏ tự vào kho nấc 2 (Q6). | L9 (mốc cấp) và sim scripts/balance-sim.mjs. | Mốc cấp?; Sản lượng ra chợ khi bật? |
| L11 – Ẩn sự cố bằng incidentExempt, tăng dần, Mải chơi trước, có trần N (Q9), gộp cùng D-10 và B-2. | L9 (cấp chỗ thợ 2) và sim scripts/balance-sim.mjs. Riêng khung incidentExempt với minLevel tạm = workers + k cũng cần sim cho k. | minLevel, k, M, r, N |
| L12 – Q2 R5 nâng quán khởi đầu (chỉ khi sim yêu cầu). | Sim scripts/balance-sim.mjs. | Có cần không? N bằng bao nhiêu? Trao theo cấp hay theo số ly? |

## 4. Sếp cần quyết

1. Duyệt cả gói luồng mở đầu: 02-mini ≤ 5 hộp, Hội đồng so le ở trần gian, quà seeds cố định, không có Quà Hội đồng. Nếu PDF founder bắt chọn hành trang thì lùi về 3 thẻ, seeds chọn sẵn.
2. Duyệt chọn sẵn VN ở lần chọn vùng đầu, chấp nhận nghiêng về loại 'both' (02b README:17).
3. Thợ, robot và trạm tự nhận không cho XP: coi là sửa lỗi ngay (Q4 A9), hay là đổi kinh tế phải chờ sim (Q6 rule 13)?
4. Món espresso/matcha thôi khoá, chỉ thiết bị mở theo cấp (Q4 A5), làm quán tăng tốc; có chấp nhận không?
5. Auto có được nhận và pha nhanh order V60 của ca tập không? Đề xuất là không, để ly đầu luôn do người chơi pha tay có làm mẫu.
6. Nếu sim cần Q2 R5 (nâng quán khởi đầu): trao theo cấp, hay thêm ngoại lệ 'theo số ly' vào Q4 A2?
7. Định nghĩa tutorial ép `farm-intro` gồm 4 bước gieo/hái/phơi/rang, cần một F-xx riêng.
8. Mốc chuyên gia ở nơi chỉ trồng (lần bán đầu, rồi workday_ended) và việc xếp hàng chuyên gia ở nơi chỉ quán.
9. Luật chạm công trình chung: mở tại chỗ, không đi bộ, áp cả cho Cổng Hội đồng; chỉ Cửa quán đi bộ.
10. Ngưỡng tỉ lệ preselected=true để xem lại teaser (Q3 P3), và ngưỡng số lần kéo để xét nút 'Thu tất cả' (Q5 R13).
11. Duyệt sửa danh sách miễn trừ của F-18 (Đã chốt/Đã code) theo Q9, xử lý cùng đợt với D-10 và B-2.
12. Người dùng tự sửa dòng mua ruộng trong AGENTS.md (thêm điều kiện đủ cấp) khi Q4 được duyệt.

## 5. Mâu thuẫn giữa các câu đã gỡ

| Giữa | Vấn đề | Cách gỡ |
|---|---|---|
| Q1 R5 ↔ Q4 A7 ↔ Q4 depends_on | Q1 cuối cho chuyên gia xuất hiện so le và không dùng điều kiện cấp: Thần Nông sau lần hái đầu, Pha Chế khi served ≥ 1, Thương Hội sau shift_ended. Q4 A7 lại mở cả Cổng một lúc khi served ≥ 1, còn nơi chỉ trồng thì mở khi stats.sold > 0. Phần depends_on của Q4 vẫn ghi theo bản Q1 cũ ('served ≥ 1 hoặc cấp ≥ 2'). Ở nơi chỉ trồng, Q1 dùng workday_ended còn Q4 dùng stats.sold, tức hai mốc khác nhau. | Lấy Q1 R5 làm nguồn duy nhất cho điều kiện có mặt của chuyên gia. Q4 A7 viết lại thành: 'Awakening và Hội đồng không có điều kiện cấp; mốc theo Q1 R5'. Bỏ câu 'Cổng mở sau ly đầu'. Ở nơi chỉ trồng: Pha Chế có mặt ở lần bán đầu (stats.sold > 0, trường đã có trong HUD_UNLOCKS seed-shop); Thương Hội có mặt ở workday_ended đầu tiên sau đó. Sửa depends_on của Q4 cho khớp. |
| Q1 R5c ↔ Q7 R5 (ca tập kết thúc ở ly đầu) | Ca tập gọi endShift ngay khi bán ly đầu. Lúc đó served ≥ 1 và shift_ended đầu tiên cùng xảy ra, nên Pha Chế và Thương Hội có mặt đồng thời. Điều này trái với 'so le' và trái R7 của Q1. Câu `costs` cũng bị hỏi khi chưa có ca thật nào, đúng lỗi ngữ cảnh mà Q1 đã bác. | Sửa Q1 R5c: Thương Hội có mặt sau shift_ended đầu tiên của ca có shift.learning = false, tức ca 2. Báo cáo ca tập không tính là mốc của Thương Hội. |
| Q1 R5 (nơi chỉ quán / nơi chỉ trồng) ↔ Q1 R5 'mỗi lần chỉ 1 chuyên gia' | Ở nơi chỉ quán, Nông và Pha Chế có mặt cùng lúc. Ở nơi chỉ trồng, Pha Chế và Thương Hội có mặt cùng lúc. Hai trường hợp này trái câu 'mỗi lần chỉ 1 chuyên gia × 2 câu'. | Đổi nghĩa câu luật thành: 'mỗi lượt gặp chỉ 1 chuyên gia × 2 câu'. Khi nhiều chuyên gia có mặt cùng lúc thì xếp hàng theo thứ tự Nông → Pha Chế → Thương Hội. Gặp xong người trước thì chấm 'Mới' mới chuyển sang người sau. Không gộp thành 4 câu một lượt. |
| Q1 R6 ↔ Q10 CT-1/CT-10/CT-11/CT-14 | Phần depends_on của Q1 gọi Cổng Hội đồng là 'công trình thứ 6 trong Q10', trong khi Q10 chỉ có 4 công trình và đẩy Cổng sang Q1. Q1 R6 để cổng 'đóng' từ đầu, còn CT-10 của Q10 quy định Ẩn → Dựng lên. Cổng cũng chưa có vùng cấm xây (CT-14) và chưa qua cổng kiểm 375×812 (CT-11). | Farm có 5 vật chạm được: 4 công trình của Q10 cộng Cổng Hội đồng của Q1. Cổng Hội đồng theo đúng CT-10, CT-11, CT-14: ẩn cho tới khi chuyên gia đầu tiên có mặt, rồi dựng lên kèm hiệu ứng (thay cho trạng thái 'cổng đóng' ở R6). Nó cũng phải chạm trúng được ở portraitView mặc định. Sửa depends_on của Q1 thành 'Q10 cộng 1 vật'. |
| Q1 R8 (nhân vật đi tới vật rồi mới mở) ↔ Q10 CT-3 (chạm công trình mở ngay, không đi bộ) | Hai luật quy định khác nhau cho cùng một loại tương tác là chạm vật 3D có modal hoặc hội thoại. | Áp một luật chung. Vật mở modal hoặc hội thoại tại chỗ (Bảng đơn, Sạp, Nhà thợ, Cổng Hội đồng, vật Hội đồng trong quán) thì mở ngay, nhân vật quay mặt về vật. Vật đổi cảnh (Cửa quán) thì nhân vật đi tới (CT-5). Lối tắt ở Sổ tay theo CT-4 (lia camera rồi mở). Sửa Q1 R8. |
| Q1 R2/R1 ↔ Q2 R1 | Câu quà ở Q2 R1 ('+6 hạt cà phê vối') làm lộ chủ đề cà phê trong 02-mini, trái 02-heaven/gameplay.md bước 9 mà Q1 R1/R2 đã giữ. Q2 cũng có thể thêm hộp thứ 6, vượt trần 5 hộp của Q1. | Hộp quà gộp vào hộp lời tiễn (hộp thứ 5), nút 'Nhận' nằm trong hộp này. Chữ trong mini chỉ ghi icon ❧ và 'Túi hạt giống: +6 hạt giống, 6 túi phân'. Tên giống (vối) chỉ hiện ở log khi vào farm. |
| Q1 rejected_amendments / Q2 R3 / Q3 depends_on ↔ Q2 cuối | Q1 ghi rằng Q2 chọn 'Túi hạt + Quà Hội đồng'. Q2 R3 dẫn 'Q1 R2 đã ghi Không thêm quà Hội đồng', nhưng R2 bản cuối của Q1 không có câu này. Q3 ghi 'đa số nhận quà Hội đồng' và có nhắc 'tools'. Cả ba đều lệch với Q2 cuối: không có Quà Hội đồng, và save mới luôn nhận 'seeds'. | Lấy Q2 cuối làm chuẩn. Thêm vào Q1 R2 câu: 'Cổng Hội đồng chỉ trao mẹo, không có quà'. Xoá dòng nhắc Quà Hội đồng ở Q1 (phần rejected) và ở Q3 depends_on. Q2 R3 sửa chỗ trích dẫn thành Q1 R2 (bản mới). |
| Q1 R18 ↔ Q3 R9 | Thứ tự cắt thời gian ở Q1 dùng 'bản đồ Q3, 1 chạm'. Q3 không nhận phương án 1 chạm và giữ 3 chạm có xác nhận, cộng thêm độ trễ khoá nút (R4c) và camera toàn cảnh rồi mới lướt (R5). | Sửa Q1 R18 bước 2 thành 'bản đồ: VN chọn sẵn, 3 chạm; chỉ được rút độ trễ R4c và thời gian camera R5, không bỏ bước xác nhận'. Tính lại ngân sách ≤ 60 s bằng playtest. |
| Q2 R5 ↔ Q4 A2/A14 | Nếu có sim, phần thưởng 'Quán lên cấp 2' của Q2 được trao theo mốc 'bán N ly'. Q4 A2 cấm mở bất cứ thứ gì theo số lần, ngoại trừ ba ngoại lệ đã liệt kê. Q4 A14 giới hạn khoảng 2 thứ mới mỗi cấp. | Nếu sim yêu cầu R5 thì trao theo 'Cấp người chơi ≥ N' và tính vào ngân sách 2 thứ của cấp đó. Nếu muốn giữ mốc 'N ly' thì thêm ngoại lệ (d) có tên đích danh vào Q4 A2. Sếp chọn một trong hai. |
| Q4 A2(b) 'ly đầu thì mở quán' ↔ code HUD_UNLOCKS cafe-play ↔ Q7/Q10 | Ly đầu chỉ có được trong quán, nên câu 'ly đầu thì mở quán' là vòng lặp. Code hiện mở cafe-play khi claimed 'harvest' hoặc served > 0 (content.js:111). | Sửa A2(b) thành: Cửa quán (Q10 CT-12) dựng lên theo `when` của cafe-play như code hiện tại (xong nhiệm vụ harvest), và chỉ ở nơi 'both'. Ở nơi chỉ quán thì vào thẳng quán. Đây là ngoại lệ theo sự kiện, không phải theo cấp. |
| Q5 R9 ↔ Q4 A9/B2 | Q5 giữ +6 XP mỗi cây và để Q4 quyết. Q4 A9 đổi sang crop.harvestXp, chỉ tính khi người chơi hái. Q4 A9/B2 dùng mục tiêu 'Thu cả ruộng 12 cây đầu', nhưng Q5 không cho Thu cả ruộng ở cấp 1: trước mốc ⛏️ chỉ chạm từng cây, kéo 🧺 cũng phải sau mốc. | Q5 R9 trỏ sang Q4 A9. Sửa Q4: bỏ cụm 'Thu cả ruộng', viết 'mỗi lần xả hàng chờ hái (chạm liên tiếp hoặc kéo 🧺) gộp thành một toast tổng'. Mục tiêu dẫn sim ở B2 viết lại thành '12 cây hái tay đầu tiên ≈ nửa ngưỡng cấp 2 (30 XP)'. Số cụ thể cần sim scripts/balance-sim.mjs. |
| Q5 R4c/R4b (mốc ⛏️ = expand, ≥ 2 ruộng hoặc cấp ≥ 3) ↔ Q4 A2/A4 | Q4 chuyển các mốc theo nhiệm vụ (`claimed.includes('expand')`) sang theo cấp, và ruộng 2 cần cấp (đề xuất 3, chờ sim). Mốc ⛏️ của Q5 vẫn đọc 'expand'. | Mốc ⛏️ đặt bằng cấp mở ruộng 2 (Q4 B1, chờ sim). Save cũ đã có ≥ 2 ruộng hoặc đã claimed 'expand' thì giữ quyền theo A13. Kéo-gieo 🌱 vẫn mở từ save mới như Q5 R4a. |
| Q5 R7 (by='auto' cho Decode) ↔ Q4 A10 (cờ via) ↔ Q1 R5a (Thần Nông sau 'hái tay đầu') | Có hai cờ chồng nhau cho cùng một thông tin: via:'hand'\|'auto' và samples.by='auto'. Nếu 'hái tay' hiểu theo nghĩa Q5 (Auto tắt) thì người luôn bật Auto sẽ không bao giờ gặp Thần Nông. Q5 R11 hoãn offerLesson ripe đúng tại chỗ mà Q1 dùng làm mốc Thần Nông (game.js:940). | Chỉ dùng một nguồn là `via` trên act. Mẫu Decode tính by = via === 'auto' ? 'auto' : owner. XP dùng `via` theo Q4 A10. Mốc Thần Nông là lần hái đầu của nhân vật chính, bất kể via, và đặt sau khoá tutorial ép. Tại game.js:940 chỉ đánh dấu 'Nông có mặt' (dựng Cổng, chấm Mới), không mở hộp. offerLesson ripe chỉ còn dùng cho hỏi lại câu sai, theo Q5 R11 và Q1 R10. |
| Q6 rule 7/13 ↔ Q4 A9 | Q4 A9 coi việc thợ/robot/tự nhận được XP là lỗi và muốn chốt ngay owner === 'player'. Q6 lại hoãn chuyện hạ XP thợ về 0 vì cần sim, giữ +4 và quy định 'trạm bằng thợ'. Q6 còn gọi mốc là 'cấp 7 nông trại', trái tên chuẩn ở Q4 A1. | Giữ luật bất biến 'trạm = thợ' của Q6. Giá trị chung do một quyết định duy nhất (Q4 A9) chốt: thợ = trạm = 0, người chơi bấm (kể cả Auto với via 'auto') = +4. Vì đây là đổi kinh tế nên đưa sếp xác nhận trước khi coi là sửa lỗi. Đổi chữ 'cấp 7 nông trại' thành 'Cấp người chơi 7 (chờ sim)'. |
| Q9 rule 2 ↔ Q4 depends_on ↔ Q10 depends_on | Q4 ghi sự cố mở ở 'cấp 9', Q10 cho Nhà thợ hiện huy hiệu ! 'khi cấp < 9'. Q9 cuối đặt minLevel = cấp chỗ thợ 2 + 1 (≈ 10, chờ Q4) và có phương án tạm 'workers (3) + k'. | Mọi tài liệu chỉ tham chiếu `incidentExempt(ctx)` / INCIDENTS.minLevel, không ghi số. Huy hiệu ! ở Nhà thợ theo incidentExempt. Sửa câu 'cấp 9' ở Q4 và Q10. Lưu ý: levelFor có cấp trên 10 (content.js:120), nên mốc 10+ vẫn hợp lệ. |
| Q7 R1/R2b ↔ Q8 rule 7 ↔ Q4 A8 (nguồn hạt chè cho V60 ở cấp 1) | Ca tập tự mở khi có 'một lô hạt rang ≥ 10 g bất kỳ', và mọi order trước ly đầu đều là V60. Nếu lô chè starter (300 g) đã cạn, hoặc chỉ còn vối, thì bước chọn hạt của ly làm mẫu sáng viền đúng 'chè' mà kho không có. Người chơi bị kẹt, hoặc bị trừ điểm hợp hạt của Quick Taste (P0). | Sửa Q7 R1/R8: điều kiện tự mở ca tập là có lô chè rang ≥ liều V60. Nếu không có thì hiện gợi ý thiếu hạt kèm lối Nhập hạt ngoài / Hạt cứu trợ cho chọn chè (Q4 A8). Q8 rule 7 chỉ sáng viền lô chè đang có. Không đổi cách chấm hợp hạt. Thời điểm cạn và lượng bù cần sim scripts/balance-sim.mjs. |
| Q7 R9 / Q8 rule 13 ↔ Q7 mục tiêu ca tập | Q8 cho Auto toàn game ⚡ Pha nhanh khách V60 đầu. Nếu Auto đang bật ở ca tập thì ly đầu là ly nhanh (best = 40, lỗi ở rule 14), ca tập kết thúc mà người chơi chưa pha tay. Nhịp Memory/Quick Taste sau ly đầu và mốc Pha Chế vẫn chạy. Mục đích dạy của Q7 và Q8 mất. | Sếp quyết. Đề xuất: khi chưa có cafe-intro, Auto không nhận order V60 của ca tập (chỉ dọn và đứng), để ly đầu luôn do người chơi pha tay có làm mẫu. Auto vẫn chỉ dừng bằng ⏸, không tự tắt. Sửa lỗi rule 14 riêng, trước Q8. |
| Q7 R5 ↔ Q8 rule 11 ↔ Q1 R7 (chồng phản hồi sau ly đầu) | Ngay sau ly đầu có thể bật cùng lúc: hộp Memory/Quick Taste, báo cáo ca tập, câu First Sixth Key 'sẵn sàng' (nếu ≥ 70), toast mở Pha nhanh ★★, chấm Pha Chế có mặt và vật Hội đồng trong quán. | Thứ tự cố định: (1) Memory/Quick Taste; (2) báo cáo ca tập tích cực kèm nút Mở ca mới; (3) chỉ hiện chấm, không modal: 📓 Sổ tay (First Key sẵn sàng) và vật Hội đồng 'Mới'. Toast Pha nhanh gộp vào dòng của báo cáo. Hội đồng ở quán chỉ mở khi cửa đóng hoặc ở báo cáo (Q1 R7). |
| Q10 CT-1 id `cafe-door` ↔ Q7 R4c cửa 3D 'door' trong quán | Hai vật dùng tên gần trùng nhau. Cửa quán ngoài farm dùng để vào quán, cửa 'door' trong quán dùng để mở/đóng ca. Luật khoá ca tập của Q7 có thể bị áp nhầm vật. | Đổi id ở farm thành `cafe-entrance`. Luật khoá Mở/Đóng của Q7 R4 chỉ áp cho 'door' trong quán, nút 🚪 HUD và mục open-cafe. Cửa quán ngoài farm luôn cho vào quán. |
| Q1 R11/R5a, Q4 A2(c), Q5 R5, Q6 (bước 3–4) ↔ 'tutorial ép 4 bước' chưa định nghĩa | Bốn câu cùng dựa vào 'tutorial ép 4 bước', nhưng chưa có danh sách bước, chưa có khoá trong farm.tutorial.seen và chưa có F-xx. | Định nghĩa một lần: (1) gieo, theo hai bước con của Q5 R5; (2) hái bằng chạm cây chín; (3) phơi rồi nhận tay ở giỏ; (4) rang rồi nhận tay. Khoá là `id `farm-intro` trong mảng `farm.tutorial.seen``, tức một giá trị mới trong TUTORIAL_IDS, không phải trường mới. Save đã có farm thì coi như xong (Q1 R15). Tạo F-xx riêng ở trạng thái Đề xuất. |
| Q10 CT-12 ↔ Q4 A2 (mốc HUD theo cấp) | Q10 tạm giữ `HUD_UNLOCKS.when`, gồm cả các mốc theo nhiệm vụ. Q4 muốn chuyển hết sang theo cấp. | Chia hai pha. Pha 1 (lát không chờ sim): công trình dùng `when` hiện tại và cờ unlock-<id> để không ẩn lại. Pha 2 (sau sim Q4): thay `when` bằng `level ≥ N`, giữ các nhánh nhu cầu (seed-shop hết hạt, cafe-play sau harvest). |

## 6. Chi tiết từng câu

### Q1 — Luồng mở đầu

**Quyết định:** Chọn B'' (B' có sửa): trước farm chỉ còn thiên đàng mini 1 chạm. Ba chuyên gia không mở cùng lúc thành một bài đố 6 câu mà xuất hiện so le theo ngữ cảnh, tại Cổng Hội đồng trong farm và một vật 3D trong quán. Chỉ gặp được ở lúc không áp lực. Câu chưa gặp chuyên gia không bao giờ bị hỏi lại. Chốt hướng ngay; quà để Q2 quyết, mốc thời gian chờ playtest.

**Luật:**


*CHỐT HƯỚNG NGAY:*

- R1 – Thiên đàng mini (02-mini): Thần Chết và Thần Tiếp Nhận đứng sẵn cạnh nhân vật. Không có bước tự đi, không gợi ý joystick, không có bước nhận hồ sơ hai lựa chọn. Tối đa 5 hộp thoại: Thần Chết 1–2 hộp (kéo nhầm); Thần Tiếp Nhận 2 hộp (dấu 'CHƯA CHẾT · CHỈ NGẤT' và câu móc 'Hội đồng sẽ tìm bạn ở trần gian'); lời tiễn 1 hộp. Lời tiết lộ không còn chờ đủ 3 dấu. Giữ luật không lộ chủ đề cà phê trong mini (02-heaven/gameplay.md bước 9).
- R2 – Quà trong mini tốn tối đa 1 chạm. Nội dung quà (3 thẻ chọn sẵn hay mặc định Túi hạt giống cộng quà Hội đồng) do Q2 quyết, Q1 không quyết. Giữ trường `startingGift` và luật tự đổi quà theo loại nơi (02-heaven/gameplay.md:10). Nếu Q2 giữ thẻ thì mỗi thẻ chỉ có icon và một dòng ngắn, không chữ 'cà phê'.
- R3 – Sau quà: hoạt cảnh tự đi vào cổng (chạm để tua), rồi mở bản đồ thế giới như hiện tại. Thẻ Việt Nam chọn sẵn thuộc Q3. Luật 'chọn vùng xong không đổi' giữ nguyên.
- R4 – Nút 'Bỏ qua ↗' trong mini chỉ cần 1 lần bấm (bỏ xác nhận 2 lần vì không còn câu hỏi để lỡ): lấy quà mặc định rồi tự đi vào cổng như luồng Bỏ qua hiện tại.
- R5 – Chuyên gia xuất hiện so le, mỗi lần chỉ 1 chuyên gia × 2 câu. Chỉ dùng mốc đã có trong code, trừ khoá tutorial ép `farm-intro` là id mới phải thêm vào TUTORIAL_IDS (content.js:71) và contracts.md §5 (nếu không, model.js:27/62 lọc bỏ id lạ khi nạp save). (a) Thần Nông (`ripe`, `water`): có mặt sau lần hái tay đầu xong (đúng chỗ farm/game.js:940 hiện gọi offerLesson(['ripe'])), và nếu tutorial ép có khoá trong `farm.tutorial.seen` thì phải sau khoá đó. (b) Thần Pha Chế (`recipe`, `adjust`): có mặt khi `stats.served ≥ 1`. (c) Thần Thương Hội (`costs`, `customer`): có mặt sau báo cáo cuối ca đầu tiên (`shift_ended`). Nơi chỉ quán: Thần Nông có mặt cùng lúc Thần Pha Chế. Nơi chỉ trồng: Pha Chế và Thương Hội có mặt sau ngày công đầu kết thúc (`workday_ended`); điều này cần đối chiếu code khi viết tài liệu. Không dùng điều kiện 'cấp ≥ 2'.
- R6 – Điểm vào là vật 3D, không dùng thẻ/menu. Farm có Cổng Hội đồng: lúc khoá thì cổng đóng, không nhãn dài; có chuyên gia mới 'có mặt' thì hiện bóng chuyên gia, chấm 'Mới' và hiệu ứng mở một lần. Quán có vật tương ứng (khung chân dung hoặc chuông Hội đồng). Sổ tay cà phê ▸ tab Câu hỏi / Key có nút 'Gặp Hội đồng' làm lối tắt (lia camera tới vật rồi mở). Lối này là lối duy nhất ngoài vật 3D, kể cả ở nơi chỉ quán. Không vào từ Sổ tay thiên đàng.
- R7 – Chỉ gặp Hội đồng ở lúc không áp lực, theo cùng điều kiện với hỏi lại hiện hành: không có modal và không đang làm việc tay. Ở quán thì chỉ khi cửa đóng hoặc ở màn báo cáo cuối ca, không giữa ca. Dòng 'Việc tiếp theo' trỏ tới Hội đồng chỉ hiện ở farm hoặc sau khi đã đóng ca, không kéo người chơi rời ca tập (Q7).
- R8 – Chạm vào thì nhân vật đi tới vật và mở hội thoại đáy màn (`.dialogue` sẵn có). Mỗi câu 3 đáp án, trả lời một lần ở lượt đầu, chấm bằng `EXPERTS` trong heaven/content.js và `answerText`. Khung khoá di chuyển; Auto vẫn chạy phía sau (crew-autoplay §5). Có nút đóng; đóng giữa chừng thì giữ các câu đã trả lời và không gọi `lessons/defer`.
- R9 – Lượt đầu ở Hội đồng là action riêng `('lessons','council')`, không đọc và không ghi `askedDay`/`askedCount`, không tính vào giới hạn '1 câu hỏi lại mỗi ngày công' (onboarding-flow.md:52). Trả lời đúng: cấp mẹo ngay qua `grantLessons` (dựa vào `granted` nên không cấp hai lần). Trả lời sai: hiện giải thích, ghi `asked[id] = ngày công`, và từ đó câu vào cơ chế hỏi lại hiện hành.
- R10 – Câu chưa gặp (questionId không có trong `farm.lessons.met`) thì `pendingLesson`/`askable` KHÔNG trả về ở mọi nơi kích hoạt: hái tay `ripe`, giếng/mưa `water` (farm/game.js:577, 940, 948), báo cáo cuối ca, ly < 70, khách bỏ về. Đây là cách giải BLOCKING #3. Bằng chứng: model.js:246 `askable()` hiện coi mọi câu chưa learned là hỏi được.
- R11 – Mọi lần hỏi lại câu sai đều không hiện khi tutorial ép chưa xong (nếu có khoá tutorial ép).
- R12 – Sổ tay thiên đàng / Hướng dẫn: câu chưa gặp hiện 'Chưa gặp chuyên gia' kèm nút dẫn tới Hội đồng, không có 'Ôn lại'. 6 câu hỏi mở Decode vẫn ở trạng thái `open` từ đầu (decode-awaken.md:125). Không trao Fragment chỉ vì trả lời đúng.
- R13 – Nhãn ở trần gian: bỏ nhãn trung tính, dùng tên lĩnh vực thật vì chủ đề đã lộ. Nội dung câu troll giữ nguyên. Huy hiệu ❧ ♨ ₫ chuyển thành dấu ✓ của từng chuyên gia ở Hội đồng. Hồ sơ trùng sinh và nhiệm vụ 'gặp chuyên gia' của thiên đàng cũ bị bỏ.
- R14 – P0 founder giữ nguyên: V60 vẫn là món hướng dẫn ly đầu (F-40). First Sixth Key mở theo 'V60 ★★ lần đầu' hoặc khi giải câu mở `recipe` (decode-awaken.md:92), không phụ thuộc Hội đồng. Coffee Memory và Quick Taste 6 thuộc tính không đổi.
- R15 – Save cũ. `heaven.completed = true`: vào thẳng farm như hiện tại; `met` suy ra từ questionId có trong `heaven.answers`; save đã có farm coi như đã xong tutorial ép. Save `heaven.skipped` hoặc thiên đàng dở: câu chưa trả lời thành 'chưa gặp' và phải gặp ở Hội đồng (đổi luật 02-heaven bước 8). Save có `introCompleted` mà thiên đàng chưa xong: chạy mini, giữ câu đã trả lời và mẹo.
- R16 – Analytics: `heaven_completed` (app/game.js:112) thêm `mode: 'mini'|'full'`; thêm sự kiện `council_answered {expert, questionId, correct}`. Đo tỉ lệ gặp từng chuyên gia (F-38) khi có nơi nhận dữ liệu.
- R17 – Điều kiện trước khi code: đọc trực tiếp các trang FTUE/thiên đàng của docs/references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf và ghi số trang làm căn cứ. Thêm dòng F-xx 'Luồng mở đầu mini + Hội đồng so le' ở trạng thái 'Đề xuất'. Chỉ sửa F-03/F-04, onboarding-flow, game-flow sau khi sếp duyệt, và sửa cùng commit với code.

*CHỜ ĐO / CHỜ CÂU KHÁC:*

- R18 – Thời gian: mục tiêu chạm đầu ≤ 60 s từ lúc bấm Chơi là mục tiêu chưa chắc đạt, chưa đo. Phép cộng giấy là intro 23,5 s + mini (mục tiêu ≤ 25 s) + bản đồ + farm → hái đầu (mục tiêu ≤ 20 s), tức đã vượt 60 s. Thứ tự cắt khi playtest vượt: (1) intro, bản ngắn hơn (Bỏ qua từ giây 0 đã có sẵn, onboarding-flow.md:26); (2) bản đồ (Q3, 1 chạm); (3) mới tới mini. Độ dài intro mới chưa chốt số, chờ playtest.
- R19 – Độ khó 10–15 phút đầu khi mẹo tới muộn (`recipe`, `costs`, `customer`, `ripe`): không đổi tổng thưởng. Nếu playtest thấy ly đầu khó đạt thì cần sim scripts/balance-sim.mjs.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- R5c: Thương Hội có mặt sau shift_ended đầu tiên của ca có shift.learning = false (ca 2), không tính báo cáo ca tập. `learning` hiện chỉ là trường của object ca (cafe/service.js:503), không vào save và không có trong payload shift_ended (model.js:650: {cups,tier,left,revenue,costs}); ca tập đạt mốc vẫn phát shift_ended (service.js:522-524). Cách phân biệt: thêm `learning` vào choice/payload của act('shift'), hoặc đếm số ca thường đã lưu trong save. Cập nhật contracts.md tương ứng.
- R5 nơi chỉ trồng: Pha Chế có mặt ở lần bán đầu (stats.sold > 0); Thương Hội ở workday_ended đầu tiên sau đó.
- R5 bổ sung: mỗi lượt gặp chỉ 1 chuyên gia. Nhiều chuyên gia có mặt thì xếp hàng Nông → Pha Chế → Thương Hội.
- R5a: Thần Nông có mặt khi `farm.tutorial.seen` có `farm-intro` và stats.harvested ≥ 1 (lần hái của nhân vật chính, via 'hand' hoặc 'auto'); kiểm ở cả lúc xong farm-intro lẫn tại game.js:940. `farm-intro` là id mới, phải thêm vào TUTORIAL_IDS (content.js:71) và contracts.md §5, nếu không model.js:27/62 lọc bỏ khi nạp save. Tại game.js:940 chỉ dựng Cổng và chấm Mới, không mở hộp.
- R6: Cổng Hội đồng theo Q10 CT-10/CT-11/CT-14: ẩn → dựng lên khi chuyên gia đầu có mặt (bỏ trạng thái 'cổng đóng'), phải chạm trúng được ở 375×812, có vùng cấm xây.
- R8: chạm Cổng hoặc vật Hội đồng thì hội thoại mở ngay tại chỗ, không bắt đi bộ (thống nhất với CT-3). Lối tắt Sổ tay lia camera theo CT-4.
- R2: thêm 'Cổng Hội đồng chỉ trao mẹo, không có quà (Q2 R3)'. Hộp quà nằm trong hộp lời tiễn (hộp 5), không dùng chữ 'cà phê'.
- R18 bước 2: 'bản đồ VN chọn sẵn, 3 chạm; chỉ rút độ trễ R4c và thời gian camera của Q3'.
- depends_on: Q4 không còn điều kiện cấp; Q10 có 4 công trình, cộng Cổng Hội đồng của Q1 thành 5 vật.

**Ý phản biện không lấy:**

- Rules (2) 'mở cả Cổng bằng stats.served ≥ 1 (+cấp ≥ 2 khi Q4 chốt)': không lấy. Chọn mẫu so le của player vì gặp 6 câu một lượt chỉ là thiên đàng cũ dời chỗ, và mẹo bị lệch ngữ cảnh (`costs` hỏi trước khi có ca nào). Vẫn giữ tinh thần của rules: chỉ dùng mốc có sẵn trong code, không phụ thuộc Q4.
- Rules (1) 'nơi chỉ quán vào qua Sổ tay cà phê': chỉ lấy làm lối tắt. Điểm vào chính là vật 3D trong quán theo player, vì AGENTS.md ưu tiên thao tác trên đối tượng.
- Rules (7) 'Bỏ qua nổi bật từ giây 0' như một phương án cắt: không lấy làm luật mới vì đã có (onboarding-flow.md:26). Mục tiêu farm → chạm đầu ≤ 10 s cũng không lấy, vì là số mới chưa có căn cứ; giữ ≤ 20 s hiện hành.
- Player (3) 'cho đổi quà một lần ở Thần Thương Hội' và gốc R2 'giữ 3 thẻ chọn sẵn': không quyết trong Q1. Theo rules (8), để Q2 quyết nhằm tránh mâu thuẫn; Q2 cuối chọn seeds cố định, không có Quà Hội đồng.
- Gốc R7 'gặp cả 6 câu liền một lượt' và R11 'vào từ Sổ tay thiên đàng' (quán không có nút Hướng dẫn, decode-awaken.md:131): bỏ.
- Player (2) 'gặp ở màn kết quả ly trong quán': thu hẹp thành chỉ khi cửa đóng hoặc báo cáo cuối ca. Model không dừng (R8), nên đọc giữa ca có thể làm khách bỏ về rồi lại kích hoạt hỏi lại `customer`.
- Gốc dẫn chứng Pocket Camp / Township / GPGP: bỏ vì chưa xác minh (player 4).

**Tham khảo game:**

- Hay Day (đã đối chiếu): dạy từng cơ chế khi nó xuất hiện, không gom bài kiểm tra → chuyên gia so le theo ngữ cảnh
- Stardew Valley (wiki): ít truyện trước farm; khối meta (Community Center) mở sau khi có thứ để dạy
- Pocket Camp, Good Pizza Great Pizza, Township: bảng ý tưởng ghi 'Cần xác minh' (ideas:44) nên không dùng làm căn cứ

**Phụ thuộc:** Q2 – nội dung quà trong mini (seeds cố định, không có Quà Hội đồng) (Q1 chỉ giữ ràng buộc ≤ 1 chạm); Q3 – bản đồ chọn sẵn VN là bước 2 trong thứ tự cắt thời gian; Q7 – ca tập/cafe-intro: Hội đồng ở quán chỉ mở khi cửa đóng; không kéo người chơi rời ca tập; Q10 – Cổng Hội đồng là công trình thứ 6, chỉ làm khi Q1 chốt B; Q1 thêm vật 3D trong quán; Q4 – không còn là điều kiện mở (đã bỏ 'cấp ≥ 2'); chỉ còn ràng buộc ngân sách ≤ 2 thứ mới mỗi cấp/mốc; Q8 – V60 làm mẫu ly đầu không phụ thuộc Hội đồng (kiểm R14); Tutorial ép 4 bước (ý tưởng mobile-first, chưa chốt) – R5a/R11 chỉ áp khi có khoá trong `farm.tutorial.seen`

**Luật đã chốt bị đổi:**

- docs/shared/onboarding-flow.md:3 và mục 3.1 (:36) – 'Thiên đàng là bài học', 'giữ 3 chuyên gia × 2 câu' trong thiên đàng → Hội đồng so le ở trần gian
- docs/shared/onboarding-flow.md:27 – Thiên đàng 23 hộp ≤ 150 s → mini ≤ 5 hộp, mục tiêu ≤ 25 s chưa đo
- docs/shared/onboarding-flow.md:52 – thêm ngoại lệ: lượt đầu của chuyên gia không tính giới hạn 1 câu/ngày công
- docs/screens/02-heaven/gameplay.md:3-13 – luồng 9 bước; bước 2 (nhận hồ sơ), bước 5 (tiết lộ sau 3 dấu), bước 8 (Bỏ qua 2 lần bấm; câu chưa trả lời hỏi lại như câu sai), bước 9 (nhãn trung tính, huy hiệu, Hồ sơ trùng sinh)
- docs/screens/02-heaven/gameplay.md:23 – mục tiêu 23 hộp / ≤ 150 s
- docs/design/godbean-gdd.md:85-86 – F-03/F-04 'Đã chốt'
- docs/design/godbean-gdd.md:263 và docs/game-flow.md – '00→01→02→02b→03/04 là đường một chiều'
- docs/design/godbean-gdd.md:273 – bảng màn 'Thiên đàng ≤ 150 s'

**Chờ sim:**

- Kinh tế đầu game khi save mới chỉ nhận seeds cố định, không có Quà Hội đồng (thuộc Q2): cần sim scripts/balance-sim.mjs
- Độ khó đầu game khi mẹo recipe/costs/customer/ripe tới muộn: chỉ cần sim scripts/balance-sim.mjs nếu playtest thấy ly đầu khó đạt
- Mốc thời gian (≤ 60 s, ≤ 25 s, độ dài intro mới) là đo bằng playtest, không phải sim

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/screens/02-heaven/gameplay.md` | Viết lại luồng thành 02-mini (R1–R4). Thêm mục Hội đồng so le (R5–R13). Thêm luật save cũ (R15). Bỏ 23 hộp / ≤ 150 s. Ghi rõ bước 5, 8, 9 cũ bị thay. |
| `docs/screens/02-heaven/README.md` | Bảng vào/ra: 02-mini → 02b; lối vào thứ hai là Hội đồng, vào từ farm hoặc quán và ra về chỗ cũ. |
| `docs/shared/onboarding-flow.md` | Dòng 3, mục 2 (mốc thời gian + thứ tự cắt R18), 3.1 (Hội đồng là bài học, so le), 3.3 (thứ tự mở), :52 (ngoại lệ lượt đầu), không hỏi câu chưa gặp (R10), không hỏi lại trong tutorial ép (R11), checklist. |
| `docs/screens/03-farm/gameplay.md` | Công trình Cổng Hội đồng: khoá/có mặt từng chuyên gia, mốc R5, chấm Mới, Việc tiếp theo (R7). |
| `docs/screens/04-cafe/gameplay.md` | Vật 3D Hội đồng trong quán; chỉ mở khi cửa đóng hoặc ở báo cáo cuối ca; nơi chỉ quán theo R5/R6. |
| `docs/shared/contracts.md` | Thêm `heaven.mode`, `farm.lessons.met: [questionId]`, action `('lessons','council')` (không đụng askedDay/askedCount), `pendingLesson` loại câu chưa gặp, sự kiện `council_answered`, `heaven_completed.mode`, id tutorial ép `farm-intro` mới trong TUTORIAL_IDS (content.js:71) ở §5. Không đổi `version`. |
| `docs/shared/decode-awaken.md` | Mục 7 (:125) và mục 8 (:131): 'Chưa gặp chuyên gia' kèm nút tới Hội đồng; lối tắt ở Sổ tay cà phê ▸ Câu hỏi/Key; First Sixth Key không phụ thuộc Hội đồng. |
| `docs/game-flow.md` | Sơ đồ 02-mini → 02b → 03/04; 03/04 ↔ Hội đồng; bỏ 'đường một chiều' cho phần Hội đồng. |
| `docs/design/godbean-gdd.md` | Mục 0: thêm F-xx 'Đề xuất'. Sau khi duyệt thì sửa F-03/F-04, §4.1, §4.2, §5.3, §9. |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md và docs/design/audits/2026-11-05-review-luong-mobile-first.md (mục 9 câu 1)` | Ghi Q1 = B'' chờ sếp duyệt; sửa dòng 17/53/90 'cấp 2 hoặc sau ly đầu' thành mốc so le. |
| `docs/design/progress/2026-11-05-<người>.md` | Một dòng ghi quyết định Q1. |

**Save / contracts:** Chỉ thêm trường, không đổi `version` (godbean-progress, farm v3). (a) `heaven.mode: 'mini'|'full'`; save thiếu trường thì coi là 'full'. (b) `farm.lessons.met: string[]` chứa questionId (không dùng expertId). Save thiếu trường thì suy ra từ questionId có trong `heaven.answers`. Chuyên gia có ✓ khi cả 2 câu đã ở `met`. (c) Action `('lessons','council')` chỉ nhận câu chưa có trong `met`, ghi vào `met`, dùng `grantLessons`/`granted`, không đọc/ghi `askedDay`/`askedCount`; câu sai thì ghi `asked[id]`. Đóng giữa chừng không gọi `defer`. (d) Save đã có farm coi như đã xong tutorial ép. Save skipped hoặc dở: câu chưa trả lời không vào `met`. (e) Giữ nguyên `startingGift`, `heaven.gift`, `heaven.answers`, `awakening.questions` (6 câu `open`). Save `heaven.completed` vào thẳng farm (app/game.js:237-240). (f) `farm-intro` là id mới trong `farm.tutorial.seen`, phải thêm vào TUTORIAL_IDS (content.js:71) và contracts.md §5; nếu không, model.js:27/62 lọc bỏ id này khi nạp save.

**Kiểm chứng khi playtest:** Điện thoại thật 375×812 và desktop, ít nhất 3 người mới, bấm giờ. (1) Chơi → chạm đầu ở farm: ghi riêng intro, mini, bản đồ, tải farm; mini ≤ 5 hộp, ghi số giây; nếu vượt 60 s thì cắt theo thứ tự R18. (2) Trong tutorial ép và lần hái tay đầu, mưa/giếng: không bật hộp hỏi nào. (3) Thần Nông có mặt sau lần hái đầu (tay hoặc Auto) khi đã xong farm-intro, Pha Chế sau ly đầu, Thương Hội sau shift_ended của ca 2; mỗi lần chỉ 2 câu, không bị chặn 'đã hỏi hôm nay'. (4) Sau ly đầu không bị kéo về farm; Hội đồng ở quán chỉ mở ở báo cáo hoặc khi cửa đóng. (5) Câu sai về sau được hỏi lại tối đa 1 câu mỗi ngày công; lượt Hội đồng không ăn mất suất đó. (6) Sổ tay hiện 'Chưa gặp chuyên gia'; câu mở Decode vẫn `open`; đạt V60 ★★ khi chưa gặp Hội đồng vẫn mở First Sixth Key. (7) Save cũ: completed (✓ đúng theo câu); dở 1/2 câu một chuyên gia (câu còn lại vẫn gặp được, không cấp mẹo hai lần); skipped; chưa có save. (8) Nơi chỉ quán và nơi chỉ trồng đều gặp đủ 3 chuyên gia. (9) Sau 5 phút hỏi 'Bạn đang làm gì, tại sao?' để kiểm tra lời tiết lộ 'chỉ ngất' và việc Hội đồng xuất hiện ở trần gian có dễ hiểu không. (10) Đếm tỉ lệ gặp từng chuyên gia.

### Q2 — Quà khởi đầu

**Quyết định:** Bỏ thẻ chọn 3 hành trang ở 02-mini: mọi người chơi mới nhận cố định Túi hạt giống ('seeds') bằng 1 chạm "Nhận". Không lập "Quà Hội đồng" có lựa chọn, và không thêm lần trao quà nào khi chưa sim. Việc nâng quán khởi đầu theo mốc quán chỉ là phương án dự phòng, chờ sim. Tất cả ở trạng thái Đề xuất, đi cùng Q1 = B', chờ sếp duyệt và đối chiếu PDF founder.

**Luật:**

- R1 (CHỐT HƯỚNG, 02-mini): Không còn bước chọn 1 trong 3. Ở lời tiễn của Thần Tiếp Nhận có MỘT hộp thoại báo quà kèm nút "Nhận" (1 chạm, khớp Q1 R2): '❧ Túi hạt giống: +6 hạt cà phê vối và 6 túi phân bón'. Bấm Nhận thì gọi chooseGift('seeds') (heaven/journey.js:58 pha 'gift'), journey ghi heaven.gift = 'seeds' và startingGift = 'seeds'. Pha 'gift' giữ lại trong code để save cũ dở thiên đàng vẫn đi tiếp được.
- R2 (CHỐT HƯỚNG, áp quà): Giữ nguyên khối áp quà ở createFarm (farm/model.js:194-201): áp một lần qua cờ giftApplied, giữ luật đổi theo nơi (:197-198), tức seeds ở nơi chỉ quán và tools ở nơi chỉ trồng (save cũ) đổi thành capital +150 xu. Chỉ đổi chữ log khi seeds đổi thành capital ở save mới: không dùng farmRules.log.giftSwapped ('{gift} không dùng được ở đây, đã đổi thành 150 xu.', farm-rules.js:453) mà dùng câu mới 'Nơi này chỉ có quán: nhận Túi vốn nhỏ +150 xu thay túi hạt'. Save cũ có heaven.gift khác 'seeds' vẫn dùng log cũ.
- R3 (CHỐT HƯỚNG, không có Quà Hội đồng): Cổng Hội đồng (Q1 R5–R7, R11) chỉ giữ thưởng mẹo hiện hành, không thêm modal chọn quà. Lý do: bảng mở khoá cấp 2 ở audit (review-luong-mobile-first.md:129) đã có 5 thứ mới, vượt nguyên tắc tối đa khoảng 2 thứ. Q1 R2 cũng đã ghi 'Không thêm quà Hội đồng'. Không thêm trường farm.councilGift.
- R4 (CHỐT HƯỚNG, kinh tế): Tổng quà khởi đầu của save mới không vượt bản hiện hành, nghĩa là đúng MỘT món. Gói mở rộng quán ('tools') và Túi vốn nhỏ ('capital') thôi là lựa chọn của người chơi mới. 'capital' chỉ còn là quà thay thế theo nơi. Kiểu dữ liệu startingGift / heaven.gift vẫn là 'seeds'|'tools'|'capital' để save cũ hợp lệ; createFarm không đổi chữ ký.
- R5 (CHỜ SIM, nâng quán khởi đầu): Chỉ khi sim cho thấy bỏ lựa chọn 'tools' làm quán đầu game chậm rõ rệt thì mới thêm phần thưởng cố định 'Quán lên cấp 2: mở sẵn 4 bàn'. Điều kiện trao: mốc 'bán N ly' ở mọi nơi có quán, kể cả nơi chỉ quán, không phụ thuộc Cổng Hội đồng, và chỉ khi upgrades.cafe < 2. N cần sim scripts/balance-sim.mjs. Nếu làm thì dùng cờ farm.cafeStarterUpgrade: 'locked'|'done', ghi 'done' TRƯỚC khi nâng quán theo mẫu robotGift (model.js:153-163); giá trị lạ tính là 'done'. Save mới: createFarm ghi 'locked' ngay trong lần áp seeds. Save cũ (saved khác null và thiếu trường): tính 'done', xét từ `saved` trước khối áp quà, không dùng heaven.gift làm tiêu chí. Không tăng farm.version. Chưa sim thì không code R5.
- R6 (CHỐT HƯỚNG, Bỏ qua): Nút Bỏ qua ở 02-mini vẫn cho 'seeds' như gameplay.md mục 8; Bỏ qua 1 lần bấm theo Q1 R4.
- R7 (CHỐT HƯỚNG, Chơi lại chương): Chơi lại thiên đàng có đặt lại heaven.gift rồi ghi lại 'seeds', nhưng farm không áp quà lần nữa vì giftApplied = true đã được giữ. Ghi rõ điều này ở 02-heaven/gameplay.md:64.
- R8 (CHỐT HƯỚNG, save cũ): Không migrate, không tăng version. Save cũ giữ startingGift / heaven.gift đã chọn, giftApplied giữ nguyên, không nhận thêm gì. Save đang dở ở pha 'gift' của bản cũ thì hiện 1 hộp Nhận seeds như save mới (không hiện lại 3 thẻ).
- R9 (CHỐT HƯỚNG, analytics): heaven_completed (app/game.js:112) giữ thuộc tính gift để không gãy schema; với save mới giá trị luôn là 'seeds'. Thêm thuộc tính mode ('mini'|'full', theo Q1) và region_type để tách dữ liệu trước/sau. Không thêm council_gift_claimed. Nếu làm R5 thì thêm sự kiện cafe_starter_upgrade {level, region}.
- R10 (điều kiện chặn): Quyết định ở trạng thái 'Đề xuất, chờ sếp duyệt + chờ đối chiếu PDF founder'. Nếu PDF founder quy định chọn hành trang ở thiên đàng thì lùi về phương án (ii): giữ 3 thẻ trong 02-mini, trong đó seeds được chọn sẵn. Chỉ code khi GDD có dòng F-xx Đã chốt (số F cụ thể do người cập nhật GDD cấp; F-44 đã có chỗ dành, nên kiểm số còn trống). Hệ P0 founder (Coffee Memory, Quick Taste 6 thuộc tính, Decode/First Sixth Key, V60 đầu) không bị đụng.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- R1: chữ hộp quà trong 02-mini là '❧ Túi hạt giống: +6 hạt giống, 6 túi phân'. Tên giống vối chỉ hiện ở log farm. Hộp này chính là hộp lời tiễn, không thêm hộp.
- R3: sửa trích dẫn thành Q1 R2 (bản đã sửa).
- R5: nếu sim yêu cầu thì trao theo 'Cấp người chơi ≥ N' và tính vào ngân sách 2 thứ mỗi cấp của Q4 A14, hoặc sếp duyệt thêm ngoại lệ đích danh ở Q4 A2.

**Ý phản biện không lấy:**

- Không lấy hướng của phản biện rules (giữ Quà Hội đồng chọn 1 trong 2, sửa Q-6 bằng điều kiện 'saved thiếu councilGift'). Lý do: hai phản biện mâu thuẫn nhau, và tôi chọn player vì 4 điểm. (a) Theo Q1 R2 đã vá (:148): Cổng chỉ trao mẹo. (b) Cấp 2 đã có 5 thứ mở (audit :129), vượt nguyên tắc ~2 thứ mới mỗi cấp. (c) Nơi chỉ quán không có Cổng trong farm, nên phải đặt thêm điểm nhận. (d) Thêm một trường save, một modal và analytics chỉ để giữ một lựa chọn mà người mới chưa đủ dữ liệu để quyết. Các sửa đúng của rules vẫn được lấy: tiêu chí save cũ xét từ `saved` trước khối áp quà và không dùng heaven.gift (dùng cho R5), chặn capital hai lần ở nơi chỉ quán, bổ sung analytics.md:45, contracts.md:285, 02-heaven :37/:40/:64, IMPLEMENTATION-STATUS.md:49, cùng điều kiện PDF founder.
- Không chốt ngay phần 'tools thành phần thưởng cố định ở mốc ly đầu' của phản biện player. Phần này vẫn làm tăng ròng giá trị đầu game: người chơi có seeds và còn được quán cấp 2, trong khi trước đây chỉ được một món. Điều này đi ngược Q1 'không đổi kinh tế khi chưa sim', nên hạ xuống R5 chờ sim.
- Không lấy Q-1 gốc 'hộp thoại thường, không có nút': theo Q1 R2 quà dùng 1 chạm 'Nhận' để người chơi thấy rõ mình nhận gì. Không lấy Q-9 gốc (sự kiện council_gift_claimed) vì không còn Quà Hội đồng.
- Không làm theo đề xuất 'bỏ thuộc tính gift khỏi heaven_completed': giữ lại để không gãy schema, chỉ thêm mode và region_type.

**Tham khảo game:**

- Hay Day / Township / FarmVille 3: không cho chọn quà mở đầu, quà gắn mốc cấp và trao cố định.
- Stardew Valley: mọi người chơi nhận cùng một túi hạt khởi đầu, dùng được ngay.
- Animal Crossing Pocket Camp: trước khi vào chơi chỉ còn một lựa chọn, và lựa chọn đó đã được chọn sẵn.
- Slay the Spire (Neow): không áp dụng. Đó là lựa chọn mỗi lượt của roguelike chơi lại nhiều lần, còn Godbean là save dài hạn.

**Phụ thuộc:** Q1: Q2 chỉ đứng được khi Q1 = B' (02-mini có 1 hộp quà, 'không thêm quà Hội đồng' ở Q1 R2, Bỏ qua 1 lần bấm ở R4, thuộc tính mode ở analytics). Nếu Q1 giữ thiên đàng đầy đủ thì R1 vẫn áp được cho thiên đàng cũ: bỏ 3 thẻ, chỉ 1 hộp Nhận.; Q4: mốc 'cây chè + quà giống' và các thứ mở ở cấp 2 trong bảng mở khoá. R3 dựa vào nguyên tắc tối đa ~2 thứ mới mỗi cấp; R5 (nếu làm) phải xếp vào trục cấp/xu của Q4 để không dồn quà ở cấp 2.; Q7: mốc 'bán ly đầu / N ly' trong ca tập là điểm trao R5 nếu sim yêu cầu.; Q10: số bàn và công trình quán (Cửa quán, Bảng đơn...) ảnh hưởng giá trị của 'Quán lên cấp 2: 4 bàn' ở R5.

**Luật đã chốt bị đổi:**

- docs/screens/02-heaven/gameplay.md:10 (mục 6 'Chọn một hành trang')
- docs/screens/02-heaven/gameplay.md:25 (Thẻ quà ghi số thật: chỉ còn 1 dòng seeds)
- docs/screens/02-heaven/gameplay.md:37,40 (gợi ý/luật nhập khi 'đang có câu hỏi/quà': quà thành nút Nhận, không còn phím 1–3)
- docs/screens/02-heaven/gameplay.md:64 (Chơi lại đặt lại hành trang)
- docs/shared/onboarding-flow.md:3 và :36 ('quà chọn một lần', luồng đã chốt toàn bộ 03/11)
- docs/shared/onboarding-flow.md:61 (bảng chọn quà ghi số thật)
- docs/screens/03-farm/rules.md:170 ('Thẻ chọn quà phải ghi đúng các số này')
- docs/design/godbean-gdd.md:85 (F-03 'Thiên đàng: hỏi đáp, dấu, hành trang' Đã chốt/Đã code), :310, :315, :793-799
- docs/game-flow.md:17,39,50 ('chọn hành trang' ở nút 02)

**Chờ sim:**

- Kinh tế đầu game khi mọi save mới chỉ có 'seeds': xu, số ly và thời gian tới cấp 2–4, so với 3 hồ sơ cũ (seeds / tools / capital) ở các kiểu nơi 'both' và 'cafe'. Cần sim scripts/balance-sim.mjs.
- Nơi chỉ quán: seeds đổi thành capital +150 xu (số giữ nguyên, trạng thái Đang chỉnh). Kiểm 150 xu so với vốn đầu 200 xu bằng sim scripts/balance-sim.mjs.
- R5: có cần nâng quán khởi đầu không, và nếu cần thì mốc N ly bao nhiêu. Chưa có số, cần sim scripts/balance-sim.mjs.

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/screens/02-heaven/gameplay.md` | Mục 6: 02-mini tự trao seeds bằng 1 hộp Nhận. :25 chỉ còn dòng số của seeds; ghi tools/capital là quà save cũ và quà thay theo nơi. :37/:40: quà dùng nút Nhận. Mục 8: Bỏ qua lấy seeds. :57-59 và :64: heaven.gift luôn 'seeds' với save mới; Chơi lại không áp quà lần nữa nhờ giftApplied. |
| `docs/screens/02-heaven/README.md` | Dữ liệu ghi/truyền: startingGift cố định 'seeds' với save mới; kiểu dữ liệu giữ nguyên. |
| `docs/screens/03-farm/rules.md` | Mục 9 (:170): quà khởi đầu = seeds; đổi thành capital ở nơi chỉ quán; tools/capital chỉ còn ở save cũ. Đổi 'Thẻ chọn quà phải ghi đúng số' thành 'Dòng báo quà phải ghi đúng số'. Thêm log mới. Thêm một dòng vào nhật ký thay đổi. |
| `docs/shared/contracts.md` | Dòng startingGift (:23) và createFarm (:161): save mới mặc định 'seeds', kiểu giữ nguyên. Ledger 'gift' (:285): ghi rõ 'quà khởi đầu đổi thành 150 xu theo nơi'. Chỉ thêm farm.cafeStarterUpgrade khi R5 được duyệt sau sim. |
| `docs/shared/analytics.md` | :45 heaven_completed: gift luôn 'seeds' với save mới, thêm mode và region_type. Sự kiện cafe_starter_upgrade chỉ thêm khi làm R5. |
| `docs/shared/onboarding-flow.md` | :3, :36, :61 thay 'quà chọn một lần' bằng 'quà khởi đầu cố định Túi hạt giống'. Sửa ca kiểm thử #27 (:337): 02-mini có 1 hộp Nhận, không có thẻ. |
| `docs/game-flow.md` | :17, :39, :50: bỏ 'chọn hành trang'; cạnh 02→03 truyền 'seeds'. |
| `docs/design/godbean-gdd.md` | §0 thêm dòng F-xx 'Quà khởi đầu cố định' ở trạng thái Đề xuất, ghi chú đụng F-03 và chờ duyệt cùng Q1. Sửa §5.3 :310-315, §A.2 :793-799, §10 nguồn xu :536 (cần sim), §15 câu mở về PDF founder. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Mục 2.2 và mục 9 câu 2: ghi quyết định (bỏ thẻ, seeds cố định, không có Quà Hội đồng), đang chờ sếp. Bảng :129 ghi rõ cấp 2 không thêm quà. |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | :214: không cần migrate vì startingGift giữ kiểu và không có trường mới (trừ khi làm R5). |
| `docs/reports/IMPLEMENTATION-STATUS.md` | :49 chuỗi analytics QA: thuộc tính gift/mode của heaven_completed. |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một dòng ghi thay đổi tài liệu Q2 (theo AGENTS.md). |

**Save / contracts:** Không migrate, không tăng farm.version, không thêm trường mới (trừ khi R5 được duyệt sau sim). startingGift / heaven.gift giữ kiểu 'seeds'|'tools'|'capital'; save mới luôn 'seeds', save cũ giữ giá trị đã chọn. createFarm giữ chữ ký và cờ giftApplied, áp một lần, luật đổi theo nơi giữ nguyên. Save dở ở pha 'gift' của bản cũ thì hiện hộp Nhận seeds. Nếu làm R5: thêm farm.cafeStarterUpgrade 'locked'|'done', giá trị lạ là 'done'. createFarm ghi 'locked' cho farm mới cùng lúc áp seeds. Save cũ thiếu trường thì tính 'done', xét từ `saved` trước khối áp quà, không dựa vào heaven.gift. Ghi 'done' trước khi nâng quán. Sửa contracts.md cùng lúc với code.

**Kiểm chứng khi playtest:** Trên điện thoại thật 375×812, cho 5 người chơi mới. (1) Đo thời gian từ lúc bấm Chơi tới lần chạm ruộng đầu tiên và so với bản có 3 thẻ. Mục tiêu theo Q1 là ≤ 60 s; chưa có số đo. (2) Sau buổi chơi hỏi 'Bạn nhận được gì khi tới nông trại?'. Đạt khi người chơi nói ra túi hạt và đã dùng hạt quà để trồng ô trống trong lần chơi đầu. (3) Tải lại farm 2 lần, rồi chơi lại chương thiên đàng: số hạt, phân và xu không tăng thêm, giftApplied giữ nguyên. (4) Nơi chỉ quán: thấy log 'Nơi này chỉ có quán: nhận Túi vốn nhỏ +150 xu thay túi hạt', không có câu '{gift} không dùng được ở đây, đã đổi thành 150 xu.', và chỉ nhận đúng +150 xu một lần. (5) Save cũ có tools/capital: vào farm không nhận gì thêm. Save cũ dở ở pha quà: thấy 1 hộp Nhận seeds. (6) Ở Cổng Hội đồng không hiện modal quà. (7) Đối chiếu xu và số ly tại mốc cấp 2–4 với kết quả sim scripts/balance-sim.mjs trước khi ghi Kiểm chứng trong GDD.

### Q3 — Bản đồ chọn sẵn Việt Nam

**Quyết định:** CÓ, theo phương án lai. Lần chọn vùng đầu tiên (save chưa có `startingRegion`), bản đồ mở toàn cảnh rồi tự chọn sẵn Việt Nam, dùng thẻ thu gọn không có nhãn xếp hạng. Không lưu gì trước khi bấm «Trùng sinh ở đây». Giữ đủ ba luật F-28: ẩn loại nơi, cảnh báo «không đổi được», khóa vĩnh viễn. Đây là đánh đổi với mục đích của 02b README:17, nên sếp phải duyệt trước khi code.

**Luật:**

- CHỐT HƯỚNG NGAY (sau khi sếp duyệt; idea 2026-11-05 đang ở trạng thái Đang xem (chưa Đã chốt) nên chưa được code):
- R1. Điều kiện chọn sẵn: mở bản đồ khi save chưa có `startingRegion` và trong phiên chưa có `region`. Khi đó bản đồ tự chọn `DEFAULT_REGION` (`vn`, content.js:28): cờ VN có `is-selected`, khối VN trồi lên theo lò xo, thẻ đáy hiện thẻ trước khi chốt của VN.
- R1b. Chọn sẵn chỉ dành cho lần chọn vùng đầu tiên. Hiện chưa có cơ chế xóa `startingRegion`. Nếu sau này có trùng sinh lại hoặc chu kỳ mới (README:70 nhắc «lần trùng sinh sau»), mặc định KHÔNG chọn sẵn và quay về hint gốc `world.hint`; muốn khác thì sếp quyết riêng. Không thêm trường save để theo dõi việc này.
- R2. Chọn sẵn KHÔNG lưu gì: không gọi `onPick`/`saveRegion`, không gửi `region_selected`. Chỉ bấm «Trùng sinh ở đây» mới lưu (`reveal` → `onPick`, scene.js:167-169), như luật hiện tại.
- R3. Thẻ chọn sẵn không có nhãn xếp hạng hay gợi lợi ích nào («khuyên dùng», «dễ nhất», «người mới», «đủ cả hai», «quê nhà»), không có icon hay chữ nào lộ loại nơi. Bác phần «ghi khuyên dùng lần đầu» ở idea dòng 171.
- R4. Chọn sẵn dùng nhánh riêng, ví dụ `select(id, { auto: true })`, khác với chạm cờ: (a) không phát `sfx('ui.open')`; (b) không gọi `focus()` lên nút «Chọn nơi này» (scene.js:133-134), focus đặt vào thẻ (role=status) hoặc vùng bản đồ; (c) nút «Chọn nơi này» chỉ nhận chạm/Enter sau một khoảng ngắn kể từ khi bản đồ mở, để chạm hoặc Enter còn sót từ thiên đàng/«Bỏ qua» không vào nhầm bước cảnh báo. Độ trễ: chỉnh khi playtest, chưa có số.
- R5. Camera: mở ở toàn cảnh mặc định (`view` x 2, z -1,5, distance 20) để thấy cả thế giới, rồi lướt vào VN bằng `focusOn`. Thời lượng giữ toàn cảnh và thời gian lướt: chỉnh khi playtest, chưa có số. Bỏ cách «lướt ngay» ở R1 gốc.
- R6. Thẻ thu gọn khi đang chọn sẵn (người chơi chưa chạm cờ nào): tên, nơi chốn, teaser, dòng `world.preselectHint`, nút «Chọn nơi này». Năm dòng địa lý (`facts`) tạm ẩn và hiện khi người chơi chạm bất kỳ cờ nào (kể cả cờ VN) hoặc chạm «Xem thêm». Mục đích: trên màn 375×812 vẫn thấy các cờ khác.
- R7. Khóa i18n mới `world.preselectHint`, có cả bản vi và en (world-map.js có hai locale). Câu này phải giữ vế báo loại nơi bị ẩn của `world.hint`. Ví dụ vi: «Kéo bản đồ hoặc chạm cờ khác để xem nơi khác · nơi đó có gì chỉ lộ ra sau khi chọn.» Chỉ hiện khi đang chọn sẵn; ẩn ở bước `confirming` và khi đã chạm cờ khác. Không thêm nút hay link «Chọn vùng khác» riêng.
- R8. Chạm cờ khác thì lựa chọn chuyển như hiện tại (`select(id)` thường, có sfx và thẻ đầy đủ) và không tự quay lại VN. Nút ✕/Esc đứng lại trước cổng như cũ. Mở lại bản đồ khi vẫn chưa chốt thì VN lại được chọn sẵn, vì chưa lưu gì.
- R9. Giữ đủ các bước: «Chọn nơi này» → cảnh báo «không đổi được, chỉ khi đó mới biết» → «Trùng sinh ở đây» → lộ loại → «Bắt đầu». Đường nhanh nhất cho người mới là 3 chạm, không cần kéo bản đồ hay tìm cờ. Không có nút «Bắt đầu ở Việt Nam» 1 chạm bỏ qua xác nhận (02b README:34).
- R10. Mặc định là VN cho mọi ngôn ngữ, khớp `DEFAULT_REGION` và fallback save cũ (README:35). Không chọn sẵn theo locale hay vùng thiết bị.
- R11. Đã có `startingRegion` thì giữ luật cũ: mở thẳng thẻ kết quả của nơi đó, không chọn sẵn, không đổi được (src/app/game.js:134 `chosen`).
- R12. Analytics: `region_selected` thêm thuộc tính `preselected` (boolean, true khi nơi chốt là nơi chọn sẵn và người chơi chưa chạm cờ khác). scene.js tự theo dõi cờ «đã chạm nơi khác» và gọi `onPick(id, { preselected })`; `pick` ở src/app/game.js:133 đưa giá trị vào `track`. Đây là đổi chữ ký giữa scene.js và src/app/game.js. `sanitizeProps` (src/shared/analytics/index.js:20) đã giữ boolean (analytics/index.js:25). Sửa docs/shared/analytics.md:46. Không phải trường save nên contracts.md giữ nguyên.
- R13. Ghi rõ trong 02b README cạnh dòng 17: chọn sẵn VN chấp nhận hiệu ứng mặc định nghiêng về loại `both`, đổi lấy việc người mới vào nhanh. Sếp duyệt đánh đổi này.

*CHỜ PLAYTEST/SIM (không ghi số khi chưa đo):*

- P1. Độ trễ khóa nút «Chọn nơi này» (R4c), thời gian giữ toàn cảnh và thời gian lướt camera (R5): chỉnh khi playtest.
- P2. Mục tiêu từ lúc mở bản đồ tới lúc bấm «Bắt đầu» ≤ 10 s (ideas dòng 195, docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md:195): đo thật trên điện thoại dọc.
- P3. Tỷ lệ `preselected=true`: sếp đặt ngưỡng xem lại, không tự bịa số. Nếu vượt ngưỡng thì cân nhắc làm teaser các nơi khác hấp dẫn hơn; không quay lại cách gắn nhãn.
- P4. Cân bằng thưởng giữa các vùng (F-43) không đổi theo Q3; vẫn cần sim scripts/balance-sim.mjs như việc tồn đọng.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- depends_on Q2: bỏ câu 'quà Hội đồng' và 'tools'. Save mới luôn nhận seeds, nơi chỉ quán đổi thành capital +150 xu.
- Ghi chú cho Q1: bước cắt 2 là 3 chạm, không có phương án 1 chạm.

**Ý phản biện không lấy:**

- Bác nút «Bắt đầu ở Việt Nam» 1 chạm bỏ qua xác nhận (audit dòng 48; thứ tự cắt trong Q1): trái 02b README:34 «thẻ xác nhận nói rõ», mà chốt là vĩnh viễn.
- Bác nhãn «khuyên dùng lần đầu» (idea dòng 171): gián tiếp lộ loại `both`, trái README:17.
- Mâu thuẫn giữa hai phản biện về lần chọn sau: rules đề xuất giữ chọn sẵn rồi bỏ ở lần trùng sinh thứ hai trở đi nếu tỷ lệ cao (theo ngưỡng của sếp); player đề xuất chỉ chọn sẵn ở lần đầu. Lấy bản player (R1b) vì không cần đợi số liệu, giữ được «Có lý do quay lại» và «Học thật», và hiện chưa có cơ chế trùng sinh lại nên không tốn code. Phần ngưỡng của bản rules chuyển thành P3, chỉ dùng để xem lại teaser.
- Camera: rules để ngỏ («lướt ngay» hoặc «toàn cảnh rồi lướt»), player chọn toàn cảnh rồi lướt. Lấy toàn cảnh rồi lướt vì giữ được cảm giác «cả thế giới», cho người chơi thấy có 8 nơi để chọn, đồng thời giảm cảm giác game «muốn» mình chọn VN.
- Không thêm trường save «đã từng chốt vùng» cho R1b: chưa có cơ chế trùng sinh lại nên chưa cần; thêm sớm sẽ phải sửa contracts.md mà không có lợi gì.
- Không tự gắn số cho độ trễ khóa nút, thời gian camera hay ngưỡng `preselected`: chưa có dữ liệu, để playtest đo hoặc sếp đặt.

**Tham khảo game:**

- Stardew Valley (loại farm Standard chọn sẵn) và Civilization VI (thiết lập mặc định): mẫu «mặc định đổi được trước khi chốt».
- Pokémon (chọn starter) và Animal Crossing: New Horizons (bán cầu, layout đảo): mẫu «khóa sau một bước xác nhận», người chơi chấp nhận dù không biết hết hệ quả. Hai game này không có lựa chọn sẵn.
- Hay Day không có bước chọn vùng. Giữ bản đồ vì F-28 đã chốt, không phải vì «gần Hay Day».

**Phụ thuộc:** Q1: Q3 nằm ngay sau thiên đàng mini của Q1 (R3: hoạt cảnh tự đi vào cổng rồi mở bản đồ). Ngân sách thời gian tới chạm đầu (≤ 60 s) của Q1 tính cả bản đồ. Ở thứ tự cắt, Q1 nêu «bản đồ (Q3, thẻ chọn sẵn 1 chạm)»; Q3 không nhận phương án 1 chạm, nên Q1 phải sửa thành «chọn sẵn, 3 chạm» và tính lại ngân sách. Q1 cũng thêm nguy cơ chạm còn sót từ cảnh trước, đó là lý do có R4c.; Q2: quà khởi đầu mặc định 'seeds' ở thiên đàng mini là bước ngay trước bản đồ. Quà 'tools' (mở rộng quán) chỉ có ý nghĩa ở nơi có quán; vì chọn sẵn VN (`both`), đa số người chơi nhận được quà Hội đồng ở nơi có đủ hai bên.; Q4: trục Cấp/XP phụ thuộc loại nơi (nơi chỉ trồng hoặc chỉ quán mất một nguồn XP). Chọn sẵn VN làm phần lớn người chơi rơi vào `both`, nên sim Q4 vẫn phải chạy riêng cho farm-only và cafe-only.; Q7, Q8: quán ca 1 và làm mẫu ly đầu chỉ có ở nơi có quán. Q3 giữ VN `both` làm đường mặc định, nên các luồng này giả định người chơi có quán. Nơi chỉ trồng (không có quán) cần nhánh riêng.

**Luật đã chốt bị đổi:**

- docs/screens/02b-world-map/README.md:17 — giữ câu chữ nhưng đổi mục đích: chọn sẵn VN (`both`) đi ngược lý do «lộ loại thì ai cũng chọn cả hai». Đây là đánh đổi phải ghi rõ để sếp duyệt (bản phản biện rules đã sửa conflicts_locked_rule thành true)
- docs/screens/02b-world-map/README.md:80 — thẻ trước khi chốt thêm trạng thái thu gọn (tạm ẩn facts) và dòng `world.preselectHint`
- docs/screens/02b-world-map/README.md:82 — «Lúc mở: thẻ đáy là gợi ý thao tác» tách thành hai nhánh: chưa chốt thì VN chọn sẵn, kể cả khi mở lại sau ✕; đã chốt thì thẻ kết quả
- docs/shared/analytics.md:46 — `region_selected` thêm `preselected`
- docs/design/godbean-gdd.md:113 — F-28 (Đã chốt, Đã code) thêm ghi chú thay đổi chờ duyệt

**Chờ sim:**

- Không có số kinh tế mới do Q3 tạo ra.
- Cân bằng thưởng nhiệm vụ giữa các vùng (F-43) vẫn tồn đọng: cần sim scripts/balance-sim.mjs, không do Q3 thay đổi.
- Các số thời gian (độ trễ khóa nút, thời gian giữ toàn cảnh và lướt camera, ≤ 10 s tới «Bắt đầu») lấy từ playtest, không lấy từ sim.

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/screens/02b-world-map/README.md` | Mục Địa điểm (sau dòng 34–36): thêm R1–R13. Cạnh dòng 17: ghi đánh đổi hiệu ứng mặc định. Dòng 80: thẻ thu gọn khi chọn sẵn và `world.preselectHint`. Dòng 82: tách hai nhánh «Lúc mở». Ghi ngày 05/11, trạng thái chờ sếp duyệt. |
| `docs/shared/analytics.md` | Dòng 46 `region_selected`: thêm `preselected` (boolean); ghi `onPick(id, { preselected })`. |
| `docs/design/godbean-gdd.md` | Bảng 0.3 dòng F-28 (113): ghi chú «05/11: chọn sẵn VN ở lần chọn vùng đầu, vẫn ẩn loại, vẫn xác nhận 3 chạm; chờ sếp duyệt, chưa code». Không ghi Kiểm chứng. |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Bảng dòng 171 (F-28): bỏ «ghi khuyên dùng lần đầu»; ghi chọn sẵn VN, không nhãn, 3 chạm, thay link «Chọn vùng khác» bằng dòng gợi chạm cờ khác. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Chỉ sửa dòng 48 («1 chạm Bắt đầu, link Chọn vùng khác» → 3 chạm, không link riêng) và ghi kết luận Q3 ở mục 9 câu 3 (dòng 248). Dòng 75 đã khớp nên giữ nguyên. |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một gạch đầu dòng cho quyết định Q3 và các tài liệu đã sửa. |
| `Quyết định Q1 (tài liệu gộp)` | Thứ tự cắt thời gian: đổi «bản đồ (Q3, thẻ chọn sẵn 1 chạm)» thành «bản đồ (Q3, chọn sẵn VN, 3 chạm)». |

**Save / contracts:** Không đổi save và không thêm trường. `startingRegion` vẫn chỉ ghi khi bấm «Trùng sinh ở đây» (`saveRegion`, src/state/progress.js:43-46; src/app/game.js:133). Save cũ chưa có `startingRegion` thì thấy VN chọn sẵn và vẫn đổi được; save đã có thì mở thẳng thẻ kết quả. Fallback `vn` giữ nguyên. R1b không cần trường «đã từng chốt»: hiện chưa có đường nào xóa `startingRegion`, khi có cơ chế trùng sinh lại thì cơ chế đó tự định nghĩa. `preselected` chỉ là thuộc tính analytics, không vào localStorage, nên docs/shared/contracts.md giữ nguyên.

**Kiểm chứng khi playtest:** 1) Người mới, save trống, điện thoại dọc 375×812: đo từ lúc bản đồ mở tới lúc bấm «Bắt đầu», mục tiêu ≤ 10 s, ghi số thật. 2) Ngay khi bản đồ mở, chạm/Enter liên tục: không được vào bước cảnh báo, không có sfx `ui.open`, focus không nằm trên «Chọn nơi này». 3) Khi VN đang chọn sẵn trên 375×812: đếm số cờ khác còn thấy; thẻ thu gọn, chưa hiện facts. 4) Thẻ chọn sẵn không có chữ hay icon nào lộ loại nơi hoặc nhãn khuyên dùng; hint ở cả vi và en có vế «chỉ lộ ra sau khi chọn». 5) Chạm cờ Ý → thẻ đầy đủ của Ý, VN hạ xuống, hint biến mất. Bấm ✕ rồi vào lại → VN chọn sẵn lại, localStorage chưa có `startingRegion`. 6) Chốt VN → tải lại trang → mở thẳng thẻ kết quả VN. Save cũ có `startingRegion: 'ke'` → không bị VN đè. 7) `region_selected` có `preselected` đúng: true nếu giữ VN, false nếu đã chạm cờ khác rồi chốt. 8) Sau 5–10 người chơi thử: báo tỷ lệ `preselected=true` và hỏi «Bạn có nhận ra mình chọn được nơi khác không?». Nếu đa số không nhận ra thì viết lại `world.preselectHint`.

### Q4 — Trục Cấp

**Quyết định:** Q4 chỉ chốt HƯỚNG "Cấp mở, xu trả, uy tín đo sức khoẻ quán, Awakening theo sự kiện", còn XP thợ/robot/tự nhận = 0 thì chờ sếp quyết là sửa lỗi hay đổi kinh tế (mục 4 câu 3). Mọi mốc cấp, harvestXp và LEVEL_XP đều chờ sim scripts/balance-sim.mjs. Thêm luật chống kẹt mềm, luật giữ quyền save cũ có trường lưu, nguồn hạt chè cho V60 ở cấp 1, xử lý riêng theo loại nơi (chỉ trồng / chỉ quán), và cờ nguồn hành động cho Auto. Chưa được code khi sếp chưa duyệt, GDD chưa có dòng F-xx và AGENTS.md chưa được người dùng sửa.

**Luật:**

- LỚP A, CHỐT HƯỚNG NGAY (chờ sếp duyệt F-xx rồi mới code)
- A1. Tên chuẩn: 'Cấp người chơi' = levelFor(progress.xp) (src/features/farm/content.js:120-121). Ghi tên này vào contracts.md để phân biệt với cấp nhân viên (workerLevel), cấp công trình và 'quán cấp 10' trong progression.md:46. Không dùng chữ 'cấp nông trại', vì nơi chỉ quán không có nông trại.
- A2. Trục mở khoá: giống, công trình, thiết bị quán, món đang khoá theo uy tín, chỗ thợ/nhân viên, ruộng và chế độ (vd tự nhận mẻ) mở bằng điều kiện `Cấp người chơi ≥ N`. Không thứ gì mở bằng uy tín, xu hay số lần mua. Chỉ có ba ngoại lệ, được liệt kê đích danh: (a) Awakening theo sự kiện (A7). (b) Mở theo nhu cầu để chống kẹt mềm: đang hết hạt và có ô trống thì Cửa hàng hạt mở ngay, giữ đúng nhánh `seed-shop` ở content.js:112. Ly đầu thì mở quán (`cafe-play`). Nơi chỉ quán hết hạt thì vẫn có Hạt cứu trợ / Nhập hạt ngoài. (c) 4 bước tutorial ép ở cấp 1. Các mốc HUD còn mở theo nhiệm vụ (`claimed.includes('expand'/'weed')`, `reached(p,'ship')`) chuyển sang theo cấp theo bảng công trình của Q10. Ghi rõ trong onboarding-flow.md 3.3.
- A3. Xu chỉ trả cho thứ cấp đã mở. Shop/modal vẫn hiện thứ chưa mở ở dạng xám, kèm nhãn 'Mở ở cấp N'. Không mua được XP, Fragment hay Key (giữ progression.md mục 1).
- A4. Ruộng 2/3/4 cần đủ cả ba điều kiện: liền kề, đủ cấp, đủ xu (giá 120/180/300 giữ nguyên). Luồng theo AGENTS: ô hoặc biển khoá sáng viền và hiện ngay huy hiệu 'Cấp N' trên biển 3D trước khi nhân vật đi. Nhân vật tới biển rồi mới kiểm theo thứ tự liền kề → cấp → xu. Thiếu cấp thì báo 'Cần cấp N (còn X XP)' kèm một gợi ý việc cho XP nhanh nhất theo loại nơi, không mở xác nhận. Thiếu xu thì báo số xu thiếu. Đủ cả ba mới mở xác nhận, và chỉ trừ xu khi bấm xác nhận. Dòng mua ruộng trong AGENTS.md cần NGƯỜI DÙNG sửa; agent không tự sửa.
- A5. Món chia hai nhóm. Nhóm đang khoá theo uy tín (Bạc xỉu, Phin mít, Trứng, Muối, Matcha Latte, Dirty; recipes.js:204,208,222,228,248,251) chuyển sang `recipe.level` + `gear`. Nhóm hiện có `reputation: 0` và chỉ cần thiết bị (Espresso, Americano, Cappuccino, Latte, Matcha; recipes.js:210-218,246) KHÔNG khoá món: mua được thiết bị là pha được, và chỉ thiết bị mở theo cấp. Đây là thay đổi tốc độ quán, phải báo sếp duyệt riêng. lockInfo đổi lý do khoá thành 'Cần cấp N' hoặc 'Cần <thiết bị>', bỏ 'Cần uy tín'. V60, Phin đen và Nâu đá có từ cấp 1.
- A6. Theo loại nơi: nơi chỉ quán (it/jp/us) có thiết bị đặc trưng mở mua được từ cấp 1 (Ý: máy espresso; Nhật: V60/chasen; Mỹ: máy espresso cho Americano), vì nhiệm vụ đầu của Ý là 'Pha 10 ly espresso' (docs/screens/02b-world-map/README.md:28). Bảng cấp chỉ áp cho phần còn lại. Nơi chỉ trồng (co/ke/id) không được để ngưỡng ruộng chặn điều kiện Economic Victory 'đủ 4 ruộng' (progression.md:46). XP ở nơi này phải có nguồn bù (nhận mẻ do người chơi bấm, đơn/xuất khẩu, chợ).
- A7. Awakening theo sự kiện, không có điều kiện cấp. Cổng Hội đồng mở theo sự kiện 'ly đầu' (`stats.served ≥ 1`) ở nơi có quán, và theo 'lần bán đầu' (`stats.sold > 0`) ở nơi chỉ trồng, sau 4 bước tutorial ép. Bỏ chữ 'cấp 2 HOẶC'. Sổ tay Decode mở khi câu đầu 'Sẵn sàng giải mã'. Key không cộng kinh tế (decode-awaken.md:105). Coffee Memory, Quick Taste 6 thuộc tính và V60 có từ cấp 1.
- A8. V60 ở cấp 1 phải có nguồn hạt chè (arabica) hợp lệ trước khi trồng được chè. Giữ 300 g chè rang trong lô `starter` (04-cafe/gameplay.md:139), và từ cấp 1 Nhập hạt ngoài / Hạt cứu trợ phải cho chọn chè. Không đổi cách chấm 'hợp hạt' của Quick Taste (P0). Lượng bù và thời điểm cạn: cần sim scripts/balance-sim.mjs.
- A9. XP thợ/robot/tự nhận = 0 (chờ sếp quyết là sửa lỗi hay đổi kinh tế, mục 4 câu 3). Hái chỉ cộng XP khi `owner==='player'` (model.js:728 hiện cộng +6 cho mọi owner). Nhận mẻ chỉ cộng XP khi người chơi bấm (model.js:753 hiện cộng +4/mẻ cho mọi người nhận). Thợ, robot và Tự nhận mẻ (mở ở cấp 7, theo Q6) không cho XP. XP hái chuyển từ hằng +6 sang `crop.harvestXp` theo giống. Mỗi lượt Thu cả ruộng chỉ có một toast tổng '+N XP' kèm hiệu ứng sao XP bay. Bỏ XP mua ruộng (F-36).
- A10. Thêm cờ nguồn hành động `via: 'hand'|'auto'` trên act của nhân vật chính để luật và sim tách được Auto với chơi tay. Tạm thời Auto cho XP như chơi tay, vì Auto đã bị giới hạn bởi `farm.autoplay` {runs 0–3, leftMs ≤ 600000} (contracts.md:268). Nếu sim cho thấy Auto lên cấp nhanh hơn chơi tay thì hạ XP theo `via:'auto'`.
- A11. XP dồn vào vòng lõi, giữ các nguồn hiện có: ly tự pha 1 + số sao (model.js:595), đơn (`order.xp`), nhiệm vụ, ★★/★★★ +15/+30, Memory (trần 30/ngày công), giải mã +20, chợ (trần 40/ngày công). ★ món chỉ là độ thành thạo (pha theo trí nhớ, barista tự pha), không mở món mới. Như vậy ý 'Mastery mở món theo luyện' trong progression.md mục 1 bị bỏ hẳn, phải ghi rõ khi sửa tài liệu.
- A12. Uy tín (0–100) chỉ là sức khoẻ quán: hạng sao cafeRank (recipes.js:267), nhịp khách, mốc ca, tiền boa. Uy tín không mở món, thiết bị, ruộng hay tính năng, và không cho XP. Phải có ít nhất một hệ quả người chơi thấy được khi uy tín tụt; cơ chế giảm theo ca xấu hiện đã có (−1 khi dưới nửa mốc Đồng, ly 0★). Nếu sim xác nhận uy tín bão hoà sớm thì đề xuất cơ chế giảm/duy trì trong một đề xuất riêng của 04-cafe.
- A13. Save cũ không mất quyền. Khi nạp lần đầu sau thay đổi, chụp MỘT lần vào trường mới `cafe.legacyRecipes` (mảng recipeId; có mảng này tức là đã chuyển) các món thoả một trong ba: đã qua ngưỡng uy tín cũ, đã có `mastery[recipeId]`, hoặc đã đủ `gear`. Sau đó không bao giờ kiểm uy tín nữa. Ruộng trong `owned`, thiết bị đã mua và XP giữ nguyên; không tính lại cấp ngược. Save đã qua nhiều mốc thì thấy mọi thứ mở ngay, không bắn chuỗi toast.
- A14. Nhịp mở: mỗi cấp mở tối đa khoảng 2 thứ mới. Mỗi lần lên cấp có toast ⭐ liệt kê thứ vừa mở và hướng dẫn đúng lúc. Bảng audit mục 4 chỉ dùng làm THỨ TỰ mở, chưa phải số cấp.
- LỚP B, CHỜ SIM scripts/balance-sim.mjs (ghi nhãn 'đề xuất, chờ sim' trong mọi tài liệu)
- B1. Mốc cấp ruộng 2/3/4 (đề xuất 3/5/7), giống mít (đề xuất dời từ cấp 3 sang 5), mốc thiết bị và món (đề xuất 6–12), mốc công trình (theo Q10).
- B2. Giá trị `crop.harvestXp`. Khởi điểm để sim: vối/chè/mít gần tỉ lệ growMs 90/120/150 s (content.js:5-7), không phải 1/2/3. Mục tiêu dẫn sim: lần Thu cả ruộng 12 cây đầu đưa thanh XP tới khoảng nửa ngưỡng cấp 2 và không nhảy cấp.
- B3. LEVEL_XP=[0,30,90,190,350,600,950,1400,2000,2800] giữ nguyên tới khi sim cho bảng mới.
- B4. Lượng hạt chè bù cho V60 ở cấp 1 (A8), XP bù cho nơi chỉ trồng (A6), và hệ số XP cho `via:'auto'` nếu cần (A10).

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- A2(b): Cửa quán dựng theo `when` cafe-play hiện tại (sau harvest, chỉ nơi 'both'); nơi chỉ quán vào thẳng quán. Bỏ câu 'ly đầu thì mở quán'.
- A2(c): tutorial ép = khoá `farm-intro` (gieo, hái, phơi nhận tay, rang nhận tay). `farm-intro` là id mới, phải thêm vào TUTORIAL_IDS (content.js:71) và contracts.md §5; nếu không, model.js:27/62 lọc bỏ khi nạp save.
- A7: 'Awakening và Hội đồng không có điều kiện cấp; mốc chuyên gia theo Q1 R5'. Bỏ câu 'Cổng mở sau ly đầu / lần bán đầu'.
- A9: đổi 'Thu cả ruộng' thành 'mỗi lần xả hàng chờ hái gộp một toast'. Thợ = trạm = 0 XP khi nhận mẻ, chờ sếp xác nhận vì là đổi kinh tế.
- A10: `via` là nguồn duy nhất. samples.by của Decode suy ra từ via (Q5 R7).
- B2: mục tiêu dẫn sim là '12 cây hái tay đầu ≈ nửa ngưỡng cấp 2'; số cần sim scripts/balance-sim.mjs.
- A8: thêm 'ca tập Q7 chỉ tự mở khi có lô chè rang ≥ liều V60'.
- depends_on Q9: thay 'cấp 9' bằng INCIDENTS.minLevel.

**Ý phản biện không lấy:**

- Player (2), phương án 'V60 nhận vối mà không trừ điểm hợp hạt': không lấy, vì đổi cách chấm của Quick Taste (P0 founder). Player cũng nói ly V60 đầu 'dùng sai hạt'. Nhận định này sai, vì lô starter đã có 300 g chè rang (04-cafe/gameplay.md:139). Lấy cách đặt vấn đề của rules lens (cạn hạt trước khi trồng được chè) và giải bằng nguồn hạt chè ở cấp 1 (A8).
- Player (2), phương án 'đưa chè lên cấp 1': chưa lấy, vì thêm một giống ở cấp 1 làm tăng tải cho người mới. Chỉ xét lại nếu sim cho thấy nguồn bù qua Nhập hạt/Cứu trợ không đủ.
- Player (3) REGION_STARTER_RECIPES và rules (2) 'nhóm reputation 0 chỉ khoá thiết bị' mâu thuẫn về cách làm. Chọn rules (2) làm luật chung (A5): món không khoá, chỉ thiết bị mở theo cấp. Thêm ý của player dưới dạng thiết bị đặc trưng mở ở cấp 1 cho nơi chỉ quán (A6), không cần bảng món riêng theo vùng.
- Player (9), 'Auto cho một nửa XP ngay': không lấy. Auto đã bị giới hạn bởi farm.autoplay (3 lượt, mỗi lượt tối đa 600000 ms; contracts.md:268), và con số một nửa chưa có đo. Lấy rules (6): thêm cờ `via` để sim đo trước, rồi mới hạ nếu cần (A10).
- Player (5b), XP cố định theo lượt ruộng có trần: không lấy làm luật. Giữ harvestXp theo cây (dễ hiểu với gieo/hái từng ô theo Q5), cộng một toast tổng. Mục tiêu 'nửa ngưỡng cấp 2' của player được dùng làm mục tiêu dẫn sim.
- Bản gốc R8 'vối 1, chè 2, mít 3': không lấy, vì không tỉ lệ với growMs 90/120/150 và quá ít phản hồi. Số chốt sau sim (B2).
- Rules (1), 'cấp 2 làm lưới an toàn cho nơi chỉ trồng': không lấy. Chọn đúng amendment của chính rules lens và player (6): thay bằng sự kiện 'lần bán đầu', để Awakening không còn điều kiện cấp nào.
- Player (8), thêm cơ chế giảm uy tín theo ngày công ngay trong Q4: không lấy vào Q4. Hiện đã có giảm theo ca xấu và ly 0★. Chỉ giữ yêu cầu 'phải có hệ quả thấy được' (A12); cơ chế giảm mới để một đề xuất riêng của 04-cafe sau sim.
- Bản gốc R3/R4 chốt số cấp 3/5/7 và 6–12: hạ xuống Lớp B (chờ sim) theo cả hai phản biện.
- Lý do dựa trên Township/Cooking Fever/My Café trong rationale gốc: bỏ theo rules (10), vì chưa có nguồn xác minh trong repo.

**Tham khảo game:**

- Hay Day (đã có trong bảng xác minh của file ý tưởng): cấp mở, xu trả; cây đầu game ít XP, cây lâu nhiều XP hơn; sao XP bay mỗi lần thu. Áp lệch ngữ cảnh nếu chép nguyên, vì cây Godbean chỉ 90–150 s, nên chỉ lấy mẫu, còn số phải sim.
- Township, Cooking Fever, My Café (chuỗi cấp → thiết bị → món, thước đo phụ không mở tính năng): CHƯA xác minh trong repo. Không dùng làm lý do chính cho tới khi được thêm vào bảng xác minh.

**Phụ thuộc:** Q1: điều kiện mở Cổng Hội đồng. Q1 đang ghi 'served ≥ 1 hoặc cấp ≥ 2'; Q4 A7 bỏ 'cấp 2' và thêm 'lần bán đầu' cho nơi chỉ trồng, nên Q1 phải sửa theo.; Q2: câu 'quán đã ở cấp ≥ 2' trong Q2 phải đọc theo Cấp người chơi.; Q5: R9 của Q5 giữ +6/cây và để Q4 quyết. Q4 A9/B2 thay bằng harvestXp, chỉ tính khi người chơi hái.; Q6: tự nhận mẻ là phần thưởng cấp 7 và không cho XP (A9). Mốc 7 chờ sim (B1).; Q7, Q8: ly V60 đầu (ca tập, Gợi ý/Xem mẫu tính là ly tự pha) là nguồn XP 1 + số sao và là mốc Thần Pha Chế có mặt (Q1 R5). Cần nguồn hạt chè (A8).; Q9: sự cố nhân viên mở ở INCIDENTS.minLevel (cấp người chơi), nên phụ thuộc nhịp cấp mới (B3) và tên chuẩn 'Cấp người chơi' (A1).; Q10: 4 công trình của Q10 (+ Cổng Q1); mốc cấp theo pha 2 sau sim, pha 1 dùng HUD_UNLOCKS.when. Đây là nơi đặt mốc HUD theo cấp ở A2.; Q3: loại nơi (both/farm/cafe) quyết nhánh A6; VN mặc định là 'both'.

**Luật đã chốt bị đổi:**

- docs/screens/04-cafe/gameplay.md:26 (F-14: uy tín mở món) và bảng công thức :34-41, :110 (món mở ở uy tín 40/50/55/60/65)
- docs/design/godbean-gdd.md:321-322 (F-05: ruộng 2–4 chỉ cần giá + liền kề)
- docs/shared/progression.md:13-17 (bảng ba trục: Wealth 'mở' mua ruộng, Mastery 'món mở theo luyện') và :24-36 (nguồn XP 'Hái cây +6 Giữ')
- docs/design/godbean-gdd.md:484-489 (9.1: mít cấp 3, hái một cây +6)
- AGENTS.md dòng 'Tới nơi chỉ mở xác nhận mua ruộng nếu đủ tiền và liền kề' (thêm điều kiện đủ cấp; người dùng tự sửa)
- src/features/farm/content.js:110-119 HUD_UNLOCKS (mốc theo nhiệm vụ chuyển sang theo cấp, giữ nhánh nhu cầu của seed-shop)

**Chờ sim:**

- Phút đạt Cấp người chơi 2/3/5/7/9/10 cho năm hồ sơ: chơi tay, Auto (`via:'auto'`), cả hai (VN), chỉ trồng (co/ke/id), chỉ quán (it/jp/us)
- Giá trị crop.harvestXp vối/chè/mít (khởi điểm gần tỉ lệ growMs 90/120/150 s); mục tiêu: 12 cây hái tay đầu tới khoảng nửa ngưỡng cấp 2
- LEVEL_XP mới, hoặc xác nhận giữ [0,30,90,190,350,600,950,1400,2000,2800]
- Mốc cấp ruộng 2/3/4 (đề xuất 3/5/7) và việc nơi chỉ trồng vẫn đạt 4 ruộng cho Economic Victory
- Mốc cấp thiết bị/món (đề xuất 6–12) và mít cấp 5
- Phút cạn 300 g hạt chè rang trong lô starter khi pha V60, và lượng hạt chè cần bù trước khi trồng được chè
- Lượng XP bù cho nơi chỉ trồng (nhận mẻ, đơn xuất khẩu, chợ)
- Auto có lên cấp nhanh hơn chơi tay không, và hệ số hạ XP nếu có
- Uy tín có còn chạm 100 trong khoảng 1 giờ khi không còn mở món không (GDD:609)

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/shared/progression.md` | Mục 1: Cấp người chơi là cổng mở chính; Wealth chỉ trả cho thứ đã mở; uy tín không thuộc trục mở; bỏ ý 'Mastery mở món theo luyện' và ghi lý do. Mục 2: hái XP theo crop.harvestXp, chỉ khi người chơi làm; nhận mẻ chỉ khi người chơi bấm; thợ/robot/tự nhận không có XP; cờ `via`. Mục 3: Economic Victory nơi chỉ trồng không bị khoá cấp chặn. Luật save cũ A13. Ghi nhãn 'đề xuất, chờ sim' cho mọi mốc. |
| `docs/shared/contracts.md` | Mục 8: định nghĩa 'Cấp người chơi = levelFor(progress.xp)'; trường save mới `cafe.legacyRecipes` (chụp một lần); dữ liệu nội dung `CROPS[].harvestXp`, `FIELDS[].level`, `RECIPES[].level` (chỉ nhóm khoá uy tín cũ), `GEAR[].level` (theo loại nơi); cờ act `via:'hand'\|'auto'`. Sửa câu 'không cần trường save mới'. |
| `docs/screens/04-cafe/gameplay.md` | Dòng 26: uy tín chỉ còn sao/nhịp khách/mốc ca/boa. Bảng công thức: cột 'Mở khi' đổi thành 'Cấp N + thiết bị' cho nhóm khoá uy tín cũ; nhóm espresso/matcha chỉ cần thiết bị, thiết bị mở theo cấp; thiết bị đặc trưng mở ở cấp 1 cho nơi chỉ quán. Nguồn hạt chè cho V60 ở cấp 1 (Nhập hạt ngoài/Hạt cứu trợ cho chọn chè). Lý do khoá 'Cần cấp N'/'Cần <thiết bị>'. |
| `docs/screens/04-cafe/README.md` | Ghi `recipe.level`, lockInfo kiểm cấp + thiết bị, `cafe.legacyRecipes`. |
| `docs/screens/03-farm/rules.md` | Ruộng 2/3/4 cần cấp (chờ sim), thứ tự kiểm liền kề → cấp → xu; XP hái theo giống và chỉ khi người chơi làm; thợ/robot/tự nhận mẻ không cho XP. |
| `docs/screens/03-farm/gameplay.md` | Huy hiệu 'Cấp N' trên biển/ô khi viền sáng; thông báo 'Cần cấp N (còn X XP)' kèm gợi ý XP nhanh nhất; mỗi lần xả hàng chờ hái gộp một toast tổng XP. |
| `docs/screens/03-farm/README.md` | Thêm `CROPS[].harvestXp`, `FIELDS[].level`. |
| `docs/screens/02b-world-map/README.md` | Mục 'Luật theo loại': nơi chỉ quán có thiết bị đặc trưng mở mua từ cấp 1; nơi chỉ trồng có nguồn XP bù. |
| `docs/shared/onboarding-flow.md` | Mục 3.3 HUD_UNLOCKS: chuyển mốc theo nhiệm vụ sang theo cấp (theo bảng Q10), giữ ngoại lệ mở theo nhu cầu (hết hạt thì mở Cửa hàng hạt); Cửa quán dựng theo `when` cafe-play hiện tại. |
| `docs/shared/decode-awaken.md` | Gần dòng 105: Awakening không khoá theo cấp; mốc chuyên gia theo Q1 R5 đã vá. |
| `docs/shared/crew-autoplay.md` | Ghi cờ `via:'auto'` và luật XP của Auto (bằng chơi tay tới khi sim). |
| `docs/design/godbean-gdd.md` | Mục 0: thêm F-xx trạng thái Đề xuất (chờ sếp duyệt, số chờ sim); cập nhật F-05, F-14, F-19, F-36. Sửa 6.1 (ruộng cần cấp), 7.4/A.3/A.4 (món theo cấp + thiết bị), 9.1 (nguồn XP, mít đề xuất cấp 5). Không ghi 'Kiểm chứng'. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Mục 4: ghi rõ bảng chỉ là thứ tự mở; bỏ 'cấp 2 hoặc' / 'Cấp 2 /' ở Cổng Hội đồng (:17, :53, :90). Mục 9 câu 4: ghi quyết định và trỏ tới tài liệu màn. |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Mục Quyết định: mốc chuyên gia theo Q1 R5 đã vá (cụm 'cấp 2 hoặc' nằm ở audit :17/:53/:90, không ở file ý tưởng). Nếu muốn trích Township/Cooking Fever/My Café thì phải thêm vào bảng xác minh trước. |
| `AGENTS.md` | NGƯỜI DÙNG tự sửa dòng mua ruộng: tới biển chỉ mở xác nhận khi liền kề, đủ cấp và đủ tiền; thiếu cấp thì báo cấp và XP còn thiếu. Agent không sửa. |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một dòng ghi quyết định Q4. |

**Save / contracts:** Thêm một trường save: `cafe.legacyRecipes: string[]` (recipeId). Trường này được ghi một lần lúc nạp save cũ, gồm các món đã qua ngưỡng uy tín cũ, đã có `cafe.mastery[recipeId]` hoặc đã đủ `gear`. Có mảng này tức là save đã chuyển, sau đó không kiểm uy tín nữa. Save mới tạo mảng rỗng. Không đổi `progress.xp`: cấp vẫn là levelFor(xp), không trừ và không tính lại. `cafe.reputation` giữ nguyên ý nghĩa, chỉ đổi vai trò. Ruộng trong `owned` và thiết bị trong `cafe.gear` giữ nguyên dù chưa đủ cấp mới. Phần dữ liệu nội dung (không nằm trong save) đổi như sau: `CROPS[].harvestXp`, `FIELDS[].level`, `RECIPES[].level` cho nhóm khoá uy tín cũ, `GEAR[].level` theo loại nơi. Cờ act `via:'hand'|'auto'` không lưu vào save. Id tutorial `farm-intro` (A2(c)) là giá trị mới phải thêm vào TUTORIAL_IDS (content.js:71) và contracts.md §5, nếu không model.js:27/62 lọc bỏ khi nạp save. Mọi trường mới phải ghi vào contracts.md mục 8 trong cùng thay đổi.

**Kiểm chứng khi playtest:** Trước khi code, chạy sim scripts/balance-sim.mjs với XP mới (harvestXp, chỉ người chơi, cờ via) cho năm hồ sơ: tay, Auto, cả hai, chỉ trồng, chỉ quán. Ghi phút đạt cấp 2/3/5/7/9/10 vào GDD 9.1 kèm nhãn 'Sim'.  Sau đó playtest trên mobile 375×812, chơi từ save mới: (a) 12 cây hái tay đầu không nhảy cấp và chỉ hiện một toast '+N XP' có sao bay. (b) Ly V60 đầu pha bằng hạt chè starter. Pha tiếp tới khi chè cạn thì vẫn có đường lấy chè ở cấp 1. (c) Chạm biển ruộng 2 khi thiếu cấp: thấy huy hiệu 'Cấp N' ngay khi viền sáng. Nhân vật tới biển thì báo 'Cần cấp N (còn X XP)' kèm gợi ý, không trừ xu, không mở xác nhận. Đủ cấp mà thiếu xu thì báo số xu thiếu. Đủ cả hai mới có xác nhận, và xu chỉ trừ khi bấm. (d) Trong quán không còn chữ 'Cần uy tín'. Hạ uy tín xuống 20 không làm mất món nào. Mua máy espresso thì pha được Espresso ngay. (e) Thợ hái một ruộng và tự nhận mẻ không làm XP tăng. (f) Cổng dựng khi Nông có mặt (Q1 R5a), không cần cấp; ở Colombia Pha Chế có mặt ở lần bán đầu. (g) Chọn Ý: pha được espresso trong 10 phút đầu. (h) Hết hạt khi có ô trống thì Cửa hàng hạt mở dù đang cấp 1. (i) Nạp save cũ có ruộng 3 ở cấp thấp, đã bán Bạc xỉu và đã mua máy espresso nhưng chưa pha ly nào: giữ ruộng, Bạc xỉu và Espresso. `cafe.legacyRecipes` được ghi một lần. (j) Sau 15 phút hỏi người chơi 'cấp tới mở gì?'. Đạt khi phần lớn trả lời được.

### Q5 — Gieo / thu theo ruộng

**Quyết định:** Giữ lõi: không có nút, chạm giữ hay cử chỉ nào "Gieo/Thu cả ruộng" một lần. Gieo bằng chạm 1 ô, hoặc chạm ô rồi kéo túi hạt qua nhiều ô (kéo-gieo mở từ save mới). Thu bằng chạm cây chín là hái ngay (giữ hành vi sẵn có; chỉ đổi nhánh đang cầm công cụ khác thì vẫn hái). Kéo 🧺 và dụng cụ chăm vẫn chờ mốc ⛏️. "Hái tay" cho Decode ripe phải loại lô do Auto hái. Hiện chỉ là đề xuất sửa tài liệu, code chờ "Đã chốt" và có dòng F-xx.

**Luật:**

- R1 [CHỐT HƯỚNG] Gieo: chạm một ô trống thì gieo đúng 1 ô. Kéo túi hạt từ dải giống lướt qua các ô trống thì gieo nhiều ô trong một lần vuốt. Không có nút, chạm giữ hay lựa chọn nào gieo cả ruộng một lần. Luật AGENTS.md (dải icon, sáng viền từng ô) giữ nguyên nghĩa.
- R2 [CHỐT HƯỚNG] Phản hồi khi kéo: ô ngón tay đi qua sáng viền ngay và giữ sáng tới khi làm xong hoặc bị hủy. Bóng kéo hiện 'n/giới hạn'. Kéo ngược về ô trước thì bỏ ô vừa thêm. Thả về dải thì hủy và không trừ gì (gameplay.md:116, 134).
- R3 [CHỐT HƯỚNG] Giới hạn kéo-gieo = số hạt đang có của giống đó (toolCapacity, tools.js:3). Hạt chỉ bị trừ khi nhân vật gieo xong từng ô.
- R4 [CHỐT HƯỚNG] Chia ba nhóm. (a) Kéo-gieo 🌱 mở từ save mới, tức là bỏ noDrag:!tools cho mục giống (game.js:224). (b) Kéo 🧺 vẫn sau mốc ⛏️ (game.js:226-230). Trước mốc này, thu bằng chạm từng cây chín. (c) Dụng cụ chăm 💧 🪴 🌿 ✂️ ⛏️ và nút #farm-tools-prompt giữ mốc ⛏️ (expand, hoặc ≥ 2 ruộng, hoặc cấp ≥ 3). Tài liệu không được hứa 'Thu cả ruộng' ở cấp 1.
- R5 [CHỐT HƯỚNG] Bài gieo đầu của tutorial có hai bước. Bước 1: chạm một ô trống, ô sáng viền, dải giống hiện. Bước 2: bàn tay chỉ kéo túi hạt từ dải qua thêm 2 ô liền kề. Người chơi chạm từng ô cũng được tính là xong. Không dạy kéo trước chạm.
- R6 [CHỐT HƯỚNG] Chạm cây chín khi không cầm công cụ đã là hái ngay trong code hiện tại (game.js:553-562, 928: nhân vật tới ô rồi interact() gọi begin(id, 'harvest')); giữ hành vi sẵn có. Thay đổi duy nhất: khi đang cầm công cụ khác 🧺, chạm cây chín hiện bị từ chối (ui.rejectDrop, game.js:861-862); đổi thành vẫn hái. ✂️ không áp được lên cây chín (tools.js:12). Nếu hái không được (kho đầy: harvestStorage; thợ đang giữ ô: staffBusy, model.js:408, 724) thì hiện toast lý do có số theo onboarding 3.6, không im lặng và không mở menu. Cây chín luôn ưu tiên hái trước việc chăm khác.
- R7 [CHỐT HƯỚNG, BẮT BUỘC TRƯỚC KHI CODE R6] 'Hái tay' cho Decode ripe là lô do nhân vật người chơi hái khi Auto TẮT, bằng chạm hoặc kéo. Lô hái lúc Auto bật ghi by='auto'. Câu ripe chỉ nhận cặp player với staff (thợ hoặc robot) trong cùng ngày công và cùng giống. 'auto' không đứng được ở bên nào của cặp, nên phải sửa điều kiện x.by !== y.by ở awakening/rules.js:47, vì nếu để nguyên thì cặp player với auto cũng lọt qua. Trong Auto, phần +5 chất lượng của mẹo ripe và stats.harvested giữ như cũ (model.js:726, 728).
- R8 [CHỐT HƯỚNG] Không có nút chăm cả ruộng miễn phí. Chăm hàng loạt chỉ có hai đường: kéo dụng cụ (sau mốc ⛏️), hoặc tự động hoá mua được hay thợ/Auto. Tưới tự động chỉ code khi ý tưởng đó 'Đã chốt' và có dòng F-xx.
- R9 [CHỜ SIM] XP giữ +6 mỗi cây hái (model.js:728). Q5 không đổi số. Trục cấp và XP do Q4/F-36 và BLOCKING #2 của audit quyết, cần sim scripts/balance-sim.mjs.
- R10 [CHỐT HƯỚNG] Giới hạn kéo 🧺 = min(số cây chín ở ô đã mở, số cây còn vừa kho xét lần lượt theo readyYield), không dùng plots.length (tools.js:3). Bóng kéo hiện con số này.
- R11 [CHỐT HƯỚNG] Không gọi offerLesson(['ripe']) (game.js:940) khi hàng chờ hái còn việc hoặc khi tutorial ép bước chưa xong. Dồn lại thành một lần hỏi sau khi hàng chờ trống, khớp BLOCKING #3 của audit.
- R12 [CHỐT HƯỚNG] Phản hồi hàng đợi: ô đã chọn mà nhân vật chưa làm thì sáng nhạt, kèm số thứ tự hoặc số còn lại, để người chơi hiểu vì sao kéo xong mà nhân vật vẫn đi (workQueue, khác Hay Day).
- R13 [CHỜ PLAYTEST] Khi kéo, camera đang bị đóng băng (dragStart, game.js:631-632). Cho cuộn camera khi ngón tay chạm mép màn để một lần kéo phủ được nhiều ruộng trên màn 375×812. Nếu chưa làm được thì playtest phải đo số lần kéo để thu hết 48 ô sau 4 giờ. Nút 'Thu tất cả' chỉ được xét lại nếu số đo vượt ngưỡng nhóm đặt ra (chưa có ngưỡng). Nếu mở lại thì nút chỉ cho cây chín, ghi by='player', vẫn qua workQueue, và cần sim XP.
- R14 [THỦ TỤC] R4, R6, R7, R10, R11, R12, R13 là thay đổi luật và code. Chỉ triển khai khi ý tưởng mobile-first 'Đã chốt' và có dòng F-xx trong GDD. Hiện giờ chỉ sửa tài liệu ở trạng thái đề xuất, chờ sếp duyệt.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- R4c/R4b: mốc ⛏️ = cấp mở ruộng 2 (Q4 B1, chờ sim). Save cũ có ≥ 2 ruộng hoặc claimed 'expand' thì giữ quyền (Q4 A13).
- R7: by = 'auto' suy ra từ act.via === 'auto' (Q4 A10). Không thêm cờ thứ hai.
- R9: trỏ sang Q4 A9 (harvestXp, chỉ khi người chơi hái).
- R11: tại game.js:940 chỉ đánh dấu Thần Nông có mặt. offerLesson ripe chỉ dùng cho hỏi lại câu sai, sau khi hàng chờ trống và đã có `farm-intro`.

**Ý phản biện không lấy:**

- Rules (1a), mở kéo 🧺 từ đầu: không lấy, chọn (1b) của rules, trùng với amendment (3) của player. Lý do: 1 ruộng 12 ô chạm từng cây vẫn chấp nhận được; mở sớm làm BLOCKING #2 về XP nặng hơn và phải sim; không phải hứa 'Thu cả ruộng' ở cấp 1. Vì vậy amendment (2) của rules (đường mở dải 🧺 khi không có ô trống, trước mốc) không cần. Sau mốc thì đã có #farm-tools-prompt
- Rules (4), Auto không được +5 chất lượng của mẹo ripe: không lấy. Bớt chất lượng của lô Auto là đổi số kinh tế (giá theo marketQualityFactor) và cần sim. crew-autoplay.md:71 đã chốt 'Auto tính như bạn tự làm'. R7 chỉ tách mẫu Decode, vừa đủ giữ hệ P0 mà đụng luật ít nhất
- Bản gốc R5 'kéo túi hạt qua 3 ô là cử chỉ đầu tiên': bác theo player (2). Trong code, dải chỉ mở sau khi chạm ô (game.js:469-471), nên dạy kéo trước chạm là sai luồng
- Bản gốc R6 'kể cả khi đang ở công cụ Tự chọn': bác, rules (6) chỉ ra câu này viết ngược nghĩa. Thay bằng 'chạm cây chín luôn là hái, dù đang chọn công cụ nào'
- Bản gốc 'kéo 🧺 thu cả ruộng (đã có)' và save_impact 'contracts.md không cần sửa': bác. 🧺 nằm sau if(!tools) (game.js:226), và R7 thêm giá trị by nên phải sửa contracts.md
- Player (5), mở lại nút 'Thu tất cả' nếu đo vượt ngưỡng: không đưa vào luật lúc này, chỉ giữ làm cổng điều kiện sau playtest và sim (R13), vì chưa có ngưỡng và chưa có số XP
- Hai bản phản biện đều đặt số R10 cho hai nội dung khác nhau (cuộn camera và hoãn offerLesson): lấy cả hai, đánh số lại thành R13 và R11

**Tham khảo game:**

- Hay Day: kéo-lướt để gieo và thu, nhưng chưa xác minh cử chỉ vuốt trồng (ideas:63). Bản 10/2026 có 'nhấn giữ làm tất cả' (ideas:60), là bằng chứng ngược. Bác cho gieo vì cần giữ quyết định giống trên từng ô; để ngỏ cho thu sau playtest
- Township: kéo-lướt qua ô, độ chắc 'khá chắc' (ideas:39), không phải 'đã xác minh'
- Stardew Valley: gieo là việc tay; việc chăm lặp lại tự động hoá bằng sprinkler mua được, ứng với R8
- Khác biệt của Godbean: nhân vật đi tới từng ô (workQueue) nên kéo xong chưa xong ngay. Cần phản hồi hàng đợi (R12), không chép cảm giác làm xong tức thì của Hay Day

**Phụ thuộc:** Q1: thứ tự tutorial và bài gieo đầu (R5) phải khớp luồng mở đầu B' (thiên đàng mini, vào farm nhanh); Q2: quà mặc định Túi hạt giống quyết định số hạt lúc đầu, tức giới hạn kéo-gieo (R3) và độ dài bài R5; Q4: mốc ⛏️ = cấp mở ruộng 2 (Q4 B1, chờ sim); pha 1 (chưa sim) vẫn dùng `when` hiện tại, pha 2 dùng cấp mở ruộng 2; save cũ có ≥ 2 ruộng hoặc claimed 'expand' giữ quyền (Q4 A13). Kéo 🧺 (R4b) đi theo mốc này. XP mỗi cây hái (R9) cũng do Q4/F-36 quyết; Q10 (yếu): nếu công trình thay nút HUD thì phải giữ #farm-tools-prompt và dải dưới không bị che

**Luật đã chốt bị đổi:**

- docs/screens/03-farm/rules.md:27: dải ⛏️ (chọn/kéo nhiều ô) chỉ mở từ ruộng 2. Sửa: kéo-gieo 🌱 mở từ đầu; 🧺 và dụng cụ chăm giữ mốc
- docs/shared/onboarding-flow.md:83 (bảng 3.3, dòng ⛏️ và ghi chú 'Trước mốc này chạm cây luôn là Tự chọn'): ghi rõ chạm cây chín là hái ngay (giữ hành vi sẵn có), kéo-gieo không chờ mốc
- docs/shared/onboarding-flow.md:146 (3.6): 'Trước mốc ⛏️ … không có kéo nhiều ô'. Sửa: trừ kéo-gieo; bài gieo đầu hai bước (R5)
- docs/shared/crew-autoplay.md:71 (đã chốt 04/11): Auto đi đúng luồng của người chơi nên 'mọi luật/nhiệm vụ tính như bạn tự làm'. Thêm ngoại lệ duy nhất: mẫu hái cho Decode ghi by='auto' (R7)
- docs/shared/decode-awaken.md:51 (câu ripe): 'bạn hái tay' định nghĩa lại là người chơi hái khi Auto tắt; cặp chỉ gồm player với thợ/robot
- src/features/farm/game.js:861-862: đang cầm công cụ khác 🧺 mà chạm cây chín thì bị từ chối (rejectDrop). Đổi thành vẫn hái (R6), chỉ khi đã có F-xx. Chạm cây chín khi không cầm công cụ đã hái ngay (game.js:553-562, 928), giữ nguyên

**Chờ sim:**

- XP mỗi cây hái +6 khi thu hàng loạt (BLOCKING #2 audit, 72 XP một lượt): cần sim scripts/balance-sim.mjs, quyết ở Q4/F-36, Q5 không đổi số
- Nhịp tiêu hạt và xu đầu game khi kéo-gieo mở từ save mới: chưa có số, cần sim scripts/balance-sim.mjs nếu playtest thấy lệch
- Nếu sau này mở kéo 🧺 trước mốc ⛏️ hoặc thêm nút 'Thu tất cả' (R13): cần sim scripts/balance-sim.mjs trước khi đổi luật
- Ngưỡng số lần kéo chấp nhận được để thu 48 ô (R13): chưa có số, cần đo bằng playtest, không phải sim

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/screens/03-farm/rules.md` | Dòng 27: tách ba nhóm theo R4. Thêm R1, R3, R6, R10. Ghi ngày đề xuất ở mục lịch sử, trạng thái chờ duyệt. |
| `docs/screens/03-farm/gameplay.md` | Mục 'Kho, kéo công cụ và bố cục cuối' (112-134): thêm 'chạm = 1 ô, kéo = nhiều ô, không gieo cả ruộng một chạm', chạm cây chín hái ngay (giữ hành vi sẵn có; đang cầm công cụ khác vẫn hái) kèm toast lỗi có số, giới hạn 🧺 theo R10, hàng đợi sáng nhạt (R12), cuộn camera ở mép (R13). |
| `docs/shared/onboarding-flow.md` | Bảng 3.3 dòng 83 và mục 3.6 (146-150): kéo-gieo mở từ đầu, 🧺 và dụng cụ chăm giữ mốc ⛏️, bài gieo đầu hai bước (R5), hoãn offerLesson ripe (R11). Tách cờ toast mở khóa kéo-gieo khỏi cờ ⛏️. |
| `docs/shared/decode-awaken.md` | 4.1 dòng 51: hái tay = người chơi hái khi Auto tắt; cặp ripe chỉ gồm player với staff; 'auto' không tính (R7). |
| `docs/shared/crew-autoplay.md` | Mục 5 dòng 71: thêm ngoại lệ là mẫu hái Decode trong Auto ghi by='auto'; phần còn lại vẫn 'tính như bạn tự làm'. |
| `docs/shared/contracts.md` | Dòng 302 (awakening.samples.harvests): ghi các giá trị by gồm 'player' \| 'staff' \| 'auto'. Save cũ giữ nguyên, không tăng version. |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Dòng 23, 143, 222, 239: ghi quyết định Q5 (bác nút Gieo/Thu cả ruộng, giữ kéo-lướt). Sửa độ chắc của bằng chứng: Township 'khá chắc', vuốt trồng Hay Day 'chưa xác minh'. Ghi bằng chứng ngược (Hay Day 10/2026 có 'nhấn giữ làm tất cả') và lý do vẫn bác. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Mục 9 câu 5 (250), bảng 76/215, lộ trình cấp 1/3 (128-130): đánh dấu Q5 đã quyết, chờ sếp duyệt. Bỏ 'Thu cả ruộng' ở cấp 1. Đổi 'Thu/Chăm cả ruộng' thành 'kéo 🧺 sau mốc ⛏️' và 'kéo dụng cụ / tự động hoá'. |
| `docs/design/godbean-gdd.md` | Mục 0: ghi Q5 ở trạng thái đề xuất, chờ duyệt. Khi chốt thì thêm dòng F-xx 'kéo-gieo từ đầu + chạm cây chín vẫn hái khi đang cầm công cụ khác + by=auto cho Decode'. Không ghi Kiểm chứng. |
| `AGENTS.md` | Tùy chọn, không đổi nghĩa: thêm câu 'Kéo hạt từ dải giống lướt qua nhiều ô để gieo liền; mỗi ô vẫn sáng viền; không có gieo cả ruộng một chạm.' |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một gạch đầu dòng: quyết định Q5 và các tài liệu đã sửa. |

**Save / contracts:** Không tăng version save. Mốc ⛏️ = cấp mở ruộng 2 (Q4 B1, chờ sim): pha 1 (chưa sim) vẫn dùng `when` hiện tại, pha 2 dùng cấp mở ruộng 2; các cờ cũ (≥ 2 ruộng, claimed 'expand') chỉ giữ quyền cho save cũ (Q4 A13). Kéo-gieo chỉ bỏ điều kiện ở UI (noDrag). awakening.samples.harvests[].by vẫn là chuỗi (HARVEST_SCHEMA by:'s', rules.js:31), chỉ thêm giá trị 'auto', nên phải sửa contracts.md dòng 302 cùng lúc. Save cũ: các mẫu cũ giữ nguyên, kể cả lô Auto từng ghi 'player'. Không đổi ngược được nên chấp nhận; mẫu chỉ giữ tối đa 20 nên tự trôi đi. Nếu toast mở khóa dùng cờ unlock-<id> trong farm.tutorial.seen thì cờ kéo-gieo tách khỏi cờ ⛏️. Save cũ đã qua mốc thì đánh dấu đã báo, không hiện toast (onboarding-flow.md:93).

**Kiểm chứng khi playtest:** 3–5 người mới, save mới, chơi trên điện thoại 360×800 và 375×812 và trên desktop. (1) Bài gieo hai bước: đo số giây tới khi người chơi tự kéo hạt qua ≥ 2 ô thêm, ghi bao nhiêu người cần bàn tay chỉ. (2) Khi kéo: ô sáng viền, bóng kéo đếm n/số hạt, kéo ngược bỏ được ô, thả về dải thì hủy và không trừ hạt. (3) Đếm số lần nhầm kéo map với kéo-gieo (ngưỡng 8 px, gameplay.md:56). (4) Chạm cây chín: không cầm công cụ thì hái ngay như hiện tại; đang cầm công cụ khác 🧺 vẫn hái (hành vi mới theo R6, code hiện `rejectDrop`). Làm kho đầy rồi chạm: phải có toast kèm số. (5) Sau mốc ⛏️: kéo 🧺 qua 12 ô chín, bóng kéo hiện đúng min(cây chín, vừa kho), mỗi cây có hiệu ứng riêng, modal hỏi lại ripe chỉ hiện một lần sau khi hàng chờ trống. (6) Có 4 ruộng, 48 ô chín: đếm số lần kéo và thời gian để thu hết (R13). (7) Decode: cùng ngày, người chơi hái tay một lô và thợ hái một lô cùng giống thì ripe sang ready. Lặp lại với Auto bật và thợ hái: ripe KHÔNG được sang ready. (8) Save cũ đã qua mốc ⛏️: không có toast mở khóa mới, dải đủ. (9) Hỏi sau phiên: có muốn nút 'Thu tất cả' không.

### Q6 — Tự chế biến

**Quyết định:** Giữ hướng lai nhưng sửa lại. Người chơi tự nhận thành phẩm từ đầu, như luật hiện hành. Tự nhận vào kho là nấc 2 của chỉ thị "Tự chế biến" có sẵn, không làm công tắc trạm mới, và mở ở mốc tự động hóa (tạm đề xuất cấp 7, chờ Q4 và sim). Khi mở khóa, nấc này mặc định TẮT. XP không được thấp hơn khi thợ nhận. Bỏ R4 (trạm tự xếp rang). Sân phơi không tự nhận cho tới khi câu Decode dry-wait có đủ cặp mẫu.

**Luật:**


*CHỐT HƯỚNG NGAY:*

- 1. (Giữ luật hiện hành, rules.md:85 (48 mẻ), 94,96,98,100; GDD 6.3.) Mỗi trạm chạy lần lượt các mẻ trong hàng chờ, tối đa 48 mẻ, tính cả mẻ đã xong mà chưa nhận. Mẻ xong nằm ở giỏ trên trạm. Người chơi nhận bằng cách bấm giỏ (nhận mọi mẻ còn vừa kho, đi tới trạm trước) hoặc bấm Nhận/Nhận tất cả trong modal. Kho đầy thì hàng giữ ở trạm, không mất gram nào.
- 2. Không làm công tắc trạm riêng. Mở rộng chỉ thị 'Tự chế biến' (modal Quản lý, rules.md:39) thành 2 nấc. Nấc 1 giữ như hiện tại: thợ phơi hết quả chín, chỉ rang tới đơn đang mở cộng phần quán thiếu. Nấc 2 mở ở mốc tự động hóa: 'Giỏ tự vào kho', bật/tắt riêng cho Sân phơi và Lò rang. Tên trên giao diện phải khác hẳn chữ 'Auto'. Modal trạm hiện dòng trạng thái ngắn cho biết nấc nào đang bật.
- 3. Lúc mở khóa nấc 2 thì mặc định TẮT. Game chỉ hiện toast gợi ý bật, một lần, theo id 'unlock-auto-collect' trong mảng `farm.tutorial.seen` (act('tutorial','seen','unlock-auto-collect')). Không tự bật, kể cả với save cũ đã qua mốc. Dưới mốc, nấc 2 hiện khóa kèm dòng 'Mở ở cấp N'.
- 4. Khi nấc 2 bật ở một trạm, mỗi tick mẻ xong của trạm đó tự vào kho, xong trước vào trước, chỉ lấy phần còn vừa kho (cùng logic Nhận tất cả). Phần không vừa nằm lại ở giỏ, giỏ vẫn hiện, và Cần xử lý báo 'Kho đầy, x mẻ chờ ở trạm'.
- 5. Thứ tự giành mẻ: người chơi bấm, rồi thợ hoặc Auto đã giữ chỗ trong `farm.reserve`, rồi trạm tự nhận (owner 'station', ưu tiên thấp nhất). Trạm không lấy mẻ đã có người giữ, để thợ hoặc Auto không đi tới giỏ rỗng (batchNotReady/staleMachine, crew.js:240). Đường tự nhận đi chung nhánh collect, nên ghi `samples.batches` và gọi awakenRun('check') như model.js:797.
- 6. Trạm không tự xếp mẻ rang. Bỏ R4 gốc. Đưa nhân sạch sang rang vẫn là việc của người chơi, hoặc của thợ có chỉ thị Tự chế biến nấc 1. Muốn trạm tự xếp thì phải mở câu hỏi hoặc dòng F-xx riêng, có sim.
- 7. XP: cấm phần thưởng mà người chơi có lợi khi TẮT nó. Mẻ trạm tự nhận cho XP ĐÚNG BẰNG mẻ thợ nhận. Code hiện tại cho +4 mỗi mẻ bất kể owner (model.js:753). Mẻ trạm tự nhận không cộng vào `stats` và không tính nhiệm vụ dry/roast, giống thợ (owner khác 'player'). Vẫn cộng vào `today.processed`. Người chơi tự bấm nhận (kể cả qua Auto, owner 'player') vẫn được +4 mỗi mẻ.
- 8. Bảo vệ Decode (P0). Khi câu 'dry-wait' (awakening/rules.js:88) chưa có cặp mẫu, gồm một mẻ phơi nhận trong ≤ 10 s và một mẻ để ≥ 1 ngày công, Sân phơi KHÔNG tự nhận dù nấc 2 đang bật. Giỏ và tab Chờ nhận ghi dòng gợi ý: giữ lại một mẻ phơi để so nhận ngay với để lâu. Lò rang không bị chặn, vì 'roast-quality' và 'variety' không dùng delayMs.
- 9. Vắng mặt. Nấc 2 chỉ chạy khi game đang chạy. Lúc quay lại, tick đầu nhận một lượt các mẻ đã xong theo readyAt (trường trong code, vd. crew.js:80), áp luật 4, 5 và 8, không tự xếp thêm mẻ nào. Sau đó hiện bảng gom nhỏ ('Đã nhận x mẻ, y g nhân sạch, z g hạt rang; k mẻ chờ do kho đầy') có nút Đóng. Hàng chờ có chạy khi offline hay không vẫn theo luật thời gian hiện có.
- 10. Không đổi: bỏ hoặc hủy mẻ chưa chạy, hiển thị hàng chờ, và dấu trạng thái trên map (ưu tiên số mẻ xong chưa nhận). Tab Chờ nhận chỉ còn các mẻ không vừa kho hoặc các mẻ bị giữ theo luật 8.
- 11. Từ cấp 1 tới trước mốc, trên mobile không đổi luật, chỉ sửa UI: tăng vùng chạm của giỏ trên map và đặt 'Nhận tất cả' trong tầm ngón cái.

*CHỜ SIM / CHỜ DUYỆT:*

- 12. Mốc mở nấc 2 tạm ghi là cấp 7 nông trại. Mốc chỉ được chốt sau khi Q4 (trục Cấp và XP) được duyệt và có kết quả sim scripts/balance-sim.mjs về thời gian tới mốc và sản lượng mỗi phút sau mốc. Không dùng 'thợ đa nhiệm cấp 7' (đó là cấp của thợ, rules.md:33) hay 'Mương tưới/Ruộng 4 cấp 7' (ý tưởng còn trạng thái Đang xem (chưa Đã chốt)) làm căn cứ.
- 13. Giá trị XP chung cho mọi lần nhận không do người chơi bấm (thợ và trạm): giữ +4, hoặc hạ cả hai về 0 bằng cách sửa model.js:753 thành chỉ cộng khi owner==='player'. Cái này gắn với Q4 và cần sim đường cấp. Dù chọn cách nào, luật 7 vẫn đúng: trạm bằng thợ.
- 14. Lượng hàng dồn ra chợ khi nấc 2 bật (giá sàn 30%, GDD:552) và tỉ lệ 'Đã nhận x mẻ' khi quay lại: cần sim scripts/balance-sim.mjs với hồ sơ 'quản lý ruộng'.
- 15. Trạng thái: thêm dòng F-xx 'Giỏ tự vào kho (nấc 2 Tự chế biến)' vào GDD mục 0, ở trạng thái Đề xuất. Chỉ code khi sếp duyệt và đã có kết quả sim (AGENTS.md).

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- Rule 12: 'Cấp người chơi 7 (tạm, chờ Q4 B1 và sim)', bỏ chữ 'nông trại'.
- Rule 13: giá trị chung lấy theo Q4 A9 (thợ = trạm = 0, người chơi bấm +4) sau khi sếp xác nhận. Rule 7 'trạm = thợ' giữ nguyên.
- Nấc 2 'Giỏ tự vào kho' nằm trong tab Chỉ thị của Nhà thợ (Q10 CT-8). Huy hiệu giỏ ưu tiên hơn ⬆ trên cùng một máy.

**Ý phản biện không lấy:**

- Công tắc riêng trên từng trạm (bản gốc R2, rules lens giữ ý này): không lấy. Chọn theo player lens, gộp vào chỉ thị Tự chế biến thành nấc 2, vì ngân sách chú ý đã vượt (audit mục 7) và một chỗ bật/tắt thì ít khái niệm hơn. Lo ngại trùng tên của rules lens được xử lý bằng tên 'Giỏ tự vào kho' và dòng trạng thái trong modal trạm.
- Gắn `auto: true` vào samples.batches và lọc ở rules.js:88 (rules lens): không lấy. Luật 8 (Sân phơi không tự nhận khi dry-wait chưa có cặp mẫu) chỉ ngăn trạm tự nhận, và không phải đổi BATCH_SCHEMA hay viết migrate; mẻ thợ hoặc Auto nhận vẫn vào samples.batches và tính cho dry-wait như hiện nay (model.js:752 không lọc owner, rules.js:88 không lọc người nhận). Nếu muốn dữ liệu chỉ do người chơi tạo thì phải xét lại phương án gắn cờ. Các câu Transformation khác không dùng delayMs.
- Lựa chọn XP (a) của rules lens, 'Auto của người chơi cũng 0 XP': không lấy trong Q6. Auto dùng owner 'player', tức người chơi đã chủ động bật, và phạm vi này thuộc Q4/crew-autoplay. Q6 chỉ chốt luật 'trạm bằng thợ'.
- Hạ ngay XP của thợ về 0 bằng cách sửa model.js:753 (player lens (4)): chưa lấy dạng chốt. Đây là thay đổi kinh tế cần Q4 và sim, nên chuyển sang phần chờ sim (luật 13).
- R2 gốc 'tự bật khi mở khóa và tự bật cho save cũ cấp ≥ 7': bác. Cả hai lens đều phản đối vì làm mất móc quay lại và đổi XP/Decode của người chơi mà họ không hay biết.
- R4 gốc 'trạm tự xếp rang': bác. Cả hai lens đều phản đối, vì nó biến việc của thợ thành việc của trạm và chiếm chỗ trong 48 mẻ hàng chờ.
- R5 gốc 'chỉ riêng công tắc 0 XP': bác, vì tạo động cơ tắt phần thưởng.
- Cờ `farm.autoCollectIntroduced` (R8 gốc): bác. Dùng mẫu sẵn có id `unlock-<id>` trong mảng `tutorial.seen` (`act('tutorial','seen',id)`).
- Căn cứ 'trùng nhịp thợ đa nhiệm cấp 7 / Mương tưới / Ruộng 4' trong rationale gốc: bỏ. Cấp 7 ở rules.md:33 là cấp thợ, còn hai cái kia thuộc ý tưởng trạng thái Đang xem (chưa Đã chốt).

**Tham khảo game:**

- Hay Day / Township: máy tự chạy hàng chờ, người chơi phải bấm nhận ở mọi cấp. Bấm nhận là móc quay lại, nên mặc định tắt.
- Stardew Auto-Grabber: tự lấy hàng là phần thưởng mở muộn và đánh đổi XP. Áp vào Godbean chỉ một nửa: không được để XP của trạm thấp hơn thợ.
- AdVenture Capitalist Manager: tự động hóa mua bằng tiến độ. Khác thể loại, chỉ học nhịp mở muộn.
- Cats & Soup: bảng gom khi quay lại, giữ cảm giác thu hoạch mà không bắt bấm từng mẻ.

**Phụ thuộc:** Q4: trục Cấp/XP quyết định mốc cấp N, luật XP chung cho thợ và trạm (luật 13), và nhịp phần thưởng tự động hóa; Q9: cùng lớp 'ẩn hệ phức tạp tới cấp cao', cần xếp nhịp mở khóa chung để toast nấc 2 không trùng các mở khóa khác; Q10: nếu Nhà thợ hoặc Xưởng là công trình chạm được thay nút, chỗ đặt modal Quản lý/chỉ thị (nơi bật nấc 2) phải khớp; Q1/Q2: tutorial dry/roast ở bước 3–4 phải giữ nhận tay; Q6 không được đụng luồng mở đầu

**Luật đã chốt bị đổi:**

- docs/screens/03-farm/rules.md:39: chỉ thị Tự chế biến thêm nấc 2 'Giỏ tự vào kho' (từ mốc N)
- docs/screens/03-farm/rules.md:94,96,98 (Nhận tất cả, kho đầy, bấm giỏ): ngoại lệ, nếu nấc 2 bật thì trạm tự đưa mẻ vừa kho vào kho; kho đầy vẫn giữ ở trạm
- docs/design/godbean-gdd.md:354 (6.3 'phải bấm tới nhận'): thêm ngoại lệ từ mốc N khi nấc 2 bật
- docs/design/godbean-gdd.md:487 (9.1 nhận mẻ +4): ghi rõ mẻ trạm tự nhận cho XP bằng thợ; giá trị chung chờ Q4
- docs/shared/decode-awaken.md:65 (dry-wait): thêm luật Sân phơi không tự nhận khi câu chưa có cặp mẫu
- docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md:144,161 (ý tưởng trạng thái Đang xem (chưa Đã chốt), chưa phải luật chốt): bác 'Tự chế biến mặc định' và 'tự nhận có XP từ đầu'

**Chờ sim:**

- Thời gian người chơi đạt mốc mở nấc 2 (tạm cấp 7, LEVEL_XP content.js:9) sau khi Q4 tính lại XP: cần sim scripts/balance-sim.mjs
- Sản lượng mỗi phút và lượng hàng ra chợ (sàn 30%) khi nấc 2 bật so với khi tắt: cần sim scripts/balance-sim.mjs
- Đường cấp nếu XP của thợ/trạm khi nhận là 0 so với +4 mỗi mẻ: cần sim scripts/balance-sim.mjs
- Số mẻ trung bình nhận gộp khi quay lại sau một lần vắng mặt: cần sim scripts/balance-sim.mjs

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/screens/03-farm/rules.md` | Mục 3 dòng 39: thêm nấc 2 'Giỏ tự vào kho' (bật riêng Sân phơi/Lò rang, mở ở mốc N, mặc định tắt). Mục chế biến dòng 94-100: thêm luật 4, 5, 8, 9 và ngoại lệ dòng 98/100. Ghi rõ trạm không tự xếp rang. |
| `docs/screens/03-farm/gameplay.md` | Luồng chế biến hai giai đoạn: nhận tay trước mốc, nấc 2 sau mốc. Bảng gom khi quay lại. Dòng gợi ý giữ mẻ phơi cho Decode. |
| `docs/design/godbean-gdd.md` | 6.3: ngoại lệ nấc 2. 9.1: XP trạm tự nhận bằng thợ, giá trị chung chờ Q4. Bảng mở khóa: mốc N tạm 7. Mục 0: thêm F-xx 'Giỏ tự vào kho', trạng thái Đề xuất. |
| `docs/shared/contracts.md` | Thêm `farm.directives` (hiện chưa có trong contracts, code ở model.js:87) kèm trường mới `directives.autoCollect: { drying: false, roasting: false }`. Thêm id 'unlock-auto-collect' vào mảng `farm.tutorial.seen` (act('tutorial','seen','unlock-auto-collect')). Owner 'station' trong `farm.reserve`. Không tăng version. |
| `docs/shared/crew-autoplay.md` | Mục giữ chỗ (khoảng dòng 36): thêm owner 'station' ưu tiên thấp nhất. Tự nhận không lấy mẻ đã có người giữ. |
| `docs/shared/decode-awaken.md` | Câu dry-wait (dòng ~65): Sân phơi không tự nhận khi câu chưa có cặp mẫu. Có dòng gợi ý ở giỏ. |
| `docs/shared/progression.md` | Thêm phần thưởng 'Giỏ tự vào kho' ở mốc N (tạm 7). Ghi luật XP: trạm bằng thợ. |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Dòng 144, 161, 228: đổi thành 'nhận tay mặc định; tự nhận là nấc 2 của Tự chế biến, mặc định tắt' và trỏ tới Q6. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Mục 9 câu 6: ghi câu trả lời và trạng thái chờ sếp duyệt và chờ sim. |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một dòng ghi quyết định Q6. |

**Save / contracts:** Thêm `farm.directives.autoCollect: { drying: boolean, roasting: boolean }`. Save cũ thiếu trường này thì mặc định { drying: false, roasting: false }, kể cả khi cấp đã ≥ mốc (không tự bật). Bộ đọc nằm cạnh model.js:87. Toast mở khóa dùng id 'unlock-auto-collect' trong mảng `farm.tutorial.seen`, ghi qua act('tutorial','seen','unlock-auto-collect') (mẫu unlock-<id>, content.js:70), không thêm cờ `autoCollectIntroduced`. `farm.reserve` nhận thêm owner 'station' (giá trị runtime, không lưu nếu reserve đang không được lưu). `samples.batches` giữ nguyên BATCH_SCHEMA, không thêm `auto`. Không tăng `version`. `processing jobs` và `plots[]` giữ nguyên. Ghi `farm.directives` vào docs/shared/contracts.md trong cùng thay đổi.

**Kiểm chứng khi playtest:** 1) Save mới, trước mốc: mẻ xong nằm ở giỏ. Nhiệm vụ dry/roast hoàn thành khi người chơi bấm nhận. Mỗi mẻ nhận tay +4 XP. Nấc 2 hiện khóa 'Mở ở cấp N'. 2) Qua mốc: có toast gợi ý một lần, nấc 2 vẫn TẮT, giỏ vẫn hiện. 3) Bật nấc 2 ở Lò rang: mẻ xong tự vào kho. XP mỗi mẻ bằng đúng mức thợ nhận (so trên cùng save). stats và nhiệm vụ không đổi. 4) Thợ hoặc Auto đã giữ chỗ một mẻ: trạm không lấy mẻ đó, thợ không đi rỗng. 5) Kho gần đầy: chỉ mẻ vừa kho được nhận, phần còn lại ở giỏ, Cần xử lý báo. Tổng gram trước và sau bằng nhau. 6) Chưa giải dry-wait, bật nấc 2 ở Sân phơi: Sân phơi vẫn giữ mẻ ở giỏ kèm dòng gợi ý. Sau khi có cặp mẫu thì Sân phơi bắt đầu tự nhận. 7) Không có mẻ rang nào tự được xếp khi nấc 2 bật mà không có thợ. 8) Ẩn tab vài phút rồi quay lại: bảng gom hiện, số mẻ khớp hàng chờ trước khi rời. 9) Tải save cũ ở cấp ≥ mốc và < mốc: autoCollect là false, không lỗi. 10) Hỏi người chơi thử: có phân biệt được nấc 1 (thợ) với nấc 2 (giỏ) và với Auto không. Đếm số lần bấm nhận mỗi 10 phút trước và sau mốc. Mọi con số kinh tế lấy từ scripts/balance-sim.mjs.

### Q7 — Quán ca tập

**Quyết định:** Đề xuất chọn bản lai đã sửa cho Q7. Ca tập (chưa có `cafe-intro`) tự mở ngay trong `service.update()`. Ca tập chỉ có 1 khách và khách đó gọi V60. Ca tập không có giờ hết và kết thúc ngay khi bán xong ly đầu, kèm một báo cáo tích cực. Mọi điểm Mở/Đóng (nút 🚪 trên HUD, mục open-cafe ở farm, cửa 3D, Auto) đều khóa trong ca tập. Cửa được dạy qua nút «🚪 Mở ca mới» có sẵn trong báo cáo ca. Tất cả vẫn là đề xuất cho tới khi sếp duyệt, chưa được code.

**Luật:**

- R0. Trạng thái: chỉ là đề xuất. Idea mobile-first đang ở trạng thái 'Đang xem' (chưa Đã chốt) (ideas/2026-11-05-mobile-first-don-gian-hoa.md:7). Theo AGENTS.md, chưa được code cho tới khi idea được 'Đã chốt' và GDD có một dòng F-xx riêng cho Q7 (trạng thái 'Đề xuất'). Các bảng đã chốt ở onboarding-flow.md, 04-cafe/gameplay.md và contracts.md chỉ được sửa sau khi sếp duyệt.
- R1. Tự mở ca tập (đặt trong service.update(), có tính lũy đẳng): ở mỗi khung hình, nếu `!seen('cafe-intro') && !cafe.open && !shift` và kho quán có một lô hạt rang ≥ 10 g thì gọi đúng một lần `service.toggleOpen()`. Đây là đường mở duy nhất, đã gồm fx cửa, syncAgents và startShift (service.js:559-563). Không gọi `act('toggle')` hay `startShift` riêng, và không gắn vào luồng vào màn, resume hay visibilitychange. Vì điều kiện đòi quán đang đóng nên cùng một lệnh không thể đóng ngược quán. Biển cửa đổi sang Mở, có tiếng cửa, không có toast 'Quán đã mở'.
- R2. Khách đầu đứng sẵn: khi ca tập vừa mở, khách đầu được tạo ở phase 'queue', đứng ngay `registerFront(0)`, không đi bộ từ cổng và không qua kiosk kể cả khi save có kiosk (rẽ sang kiosk ở service.js:584-587; spawn() ở service.js:169-174). Đây là logic mới trong service, không phải dùng lại code cũ.
- R2a. Mỗi lúc ca tập chỉ có tối đa 1 khách chưa được phục vụ. Nếu khách đó bỏ về vì hết kiên nhẫn thì spawn khách thay theo nhịp retry hiện có. Lý do: ca tập kết thúc ngay ở ly đầu (R5), nên khách thứ 2 chỉ bị đẩy về. Vì `learning()` chỉ đúng trong ca tập, LEARN_GUESTS = 2 sẽ không còn tác dụng. Tài liệu ghi rõ điều này; giữ hằng số, không thêm số mới.
- R2b. V60 bắt buộc trước ly đầu (bản sửa F-40, P0): mọi order khi `stats.served = 0` đều là Pour-over V60. Thay `!ordersPlaced++` (service.js:190) bằng điều kiện `!snap.stats.served`, vì bộ đếm `ordersPlaced` không reset theo ca nên khách thay sau khi khách V60 bỏ về sẽ gọi món ngẫu nhiên. Câu F-40 trong GDD và gameplay sửa lại cho khớp.
- R3. Thẻ quán 3 bước (cờ `cafe-intro`), bước tính từ state đang có, không thêm trường lưu. (1) Chưa có ticket: 'Đứng ở quầy thu ngân để nhận order của khách'. (2) Có ticket, chưa cầm ly và kệ trống: 'Tới quầy pha để pha Pour-over V60'. (3) Đang cầm ly, hoặc ly nằm trên kệ (shelf): 'Cầm ly, bấm đúng bàn của khách (mang đi thì bấm quầy thu ngân)'. Khi ly nằm trên kệ, mũi chỉ trỏ về kệ chứ không trả step 0 như cafe/ui.js:175 hiện nay. Bỏ hẳn bước 'Mở cửa' và điều kiện `!cafe.open`. Gợi ý thiếu hạt (beanHint) vẫn thắng mọi bước. Mũi chỉ 3D lần lượt trỏ: quầy thu ngân → quầy pha → bàn hoặc quầy thu ngân (hoặc kệ).
- R4. Khóa mọi điểm Mở/Đóng trong ca tập, tức khi chưa có `cafe-intro` hoặc khi ca hiện tại có `learning = true`. (a) Nút 🚪 trên nav HUD quán ẩn bằng visibility, vẫn giữ chỗ để bố cục 375px không nhảy (cafe/ui.js:130-133). (b) Mục 'open-cafe' trong menu farm (farm/game.js:447) bị ẩn. (c) Chạm cửa 3D 'door' (cafe/game.js:623) không gọi toggleOpen: khi quán mở, cửa chỉ báo 'Quán đang mở ca tập'; khi R8 chặn, cửa hiện gợi ý thiếu hạt. Bỏ ui-attention ở step 1. Không có dòng chữ gợi ý 'Hết ca này, chạm cửa…'.
- R5. Ca tập không có giờ hết: không có `endsAt` (hoặc `endsAt = ∞`), không đồng hồ đếm ngược, không mốc Đồng/Bạc/Vàng. Ca kết thúc ngay khi `shift.learning && shift.served ≥ 1`, bằng `endShift` hiện có (điều kiện dùng số đếm của ca, không dùng `stats.served` toàn save). Ca tập không đi qua nhánh `learnShiftMiss` (service.js:524; chữ 'Ca tập đầu tiên chưa đạt mục tiêu' ở cafe-recipes.js:860), mà hiện một báo cáo ngắn mang giọng tích cực, ví dụ 'Ly đầu tiên đã bán!', không có goal hay mốc. Nút «🚪 Mở ca mới» có sẵn (cafe/ui.js:497) là cách dạy cửa. Báo cáo chỉ mở sau khi hộp Coffee Memory / Quick Taste của ly đầu đã đóng, để giữ nhịp 📓 Ghi sổ (P0, coffee-memory.md:28).
- R6. Kiên nhẫn và hình phạt giữ đúng code hiện tại, không thêm số. 3 ly đầu của save có kiên nhẫn ×3 (`learner()`, service.js:100). Khách đang được pha mất kiên nhẫn ở tốc độ ×0,25 (service.js:597). Khách bỏ về và ca tập không trừ uy tín (`learning()`, service.js:103). Kiên nhẫn vô hạn: không làm.
- R7. Rời quán giữa ca tập: quán tạm dừng theo luật `resume` hiện có, `cafe.open` vẫn là true, lần sau vào tiếp bước đang dở (bước tính lại từ state). Tải lại trang khi `cafe.open = true`: `update()` tự mở ca mới (service.js:567). Ca này vẫn là ca tập, và nếu chưa có khách thì áp lại R2. Nếu quán đóng mà chưa có `cafe-intro` (ví dụ do R8) thì R1 sẽ tự mở khi đủ hạt.
- R8. Thiếu hạt (lô hạt rang < 10 g): không tự mở ca. Gợi ý 'Quán chưa có hạt rang…' đã chốt được ưu tiên trước mọi bước, và không có đường nào khác để mở quán (R4c, R9).
- R9. Auto: khi `cafe-intro` chưa xong, autoPick không bao giờ trả 'door', dù quán đóng hay mở. Từ khi có `cafe-intro`, giữ luật cafe/game.js:664.
- R10. Robot gift và lương crew: không đổi luật. Robot gift vẫn chuyển 'ready' → 'active' khi quán mở lần đầu (model.js:334), giống trường hợp mở bằng tay. Tài liệu ghi rõ rằng việc tự mở có thể làm robot gift chuyển 'active' ngay khi vào quán lần đầu.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- R1/R8: tự mở ca tập khi có lô chè rang ≥ liều V60, không dùng 'bất kỳ lô ≥ 10 g'. Nếu thiếu thì hiện gợi ý kèm Nhập hạt ngoài / Cứu trợ chè (Q4 A8).
- R4: chỉ khoá 'door' trong quán, nút 🚪 HUD và open-cafe. Cửa quán ngoài farm (`cafe-entrance`) luôn cho vào.
- R5: thứ tự sau ly đầu là Memory/Quick Taste → báo cáo ca tập → chỉ hiện chấm (Sổ tay, vật Hội đồng). Toast Pha nhanh gộp vào báo cáo.
- R5 bổ sung: ca tập không tính là shift_ended cho Thần Thương Hội.
- R9 (chờ sếp): khi chưa có cafe-intro, Auto không nhận order V60 của ca tập.

**Ý phản biện không lấy:**

- Mâu thuẫn ở R5. Rules (F) đưa hai cách: kết thúc ca khi ly đầu bán sau endsAt, hoặc để ca chạy tiếp tới khi người chơi tự đóng. Player (A) đề xuất bỏ endsAt và kết thúc ngay ở ly đầu. Chọn Player (A). Lý do: không có đồng hồ thì người chơi không đoán được lúc ca bị cắt. Cách 'chạy tiếp tới khi tự đóng' lại cần nút 🚪 hiện giữa ca, đúng thứ R4 muốn tránh. Kết thúc ở ly đầu cho một khoảnh khắc thành công rõ ràng và dạy cửa bằng nút Mở ca mới có sẵn.
- Mâu thuẫn về số khách. Rules (E) giữ LEARN_GUESTS = 2 và bỏ luật spawn mới. Player (C) muốn chỉ 1 khách tới khi bán ly đầu. Chọn Player. Lý do: ca tập kết thúc ở ly đầu nên khách thứ 2 chỉ bị đẩy về 👋, và 2 vé trên rail làm người mới quá tải. Đây là hệ quả cấu trúc, không phải số cân bằng mới.
- Rules (A) dùng cờ phiên `autoOpened` để R1 không chạy lại: không lấy. Điều kiện `!cafe.open && !shift` đã lũy đẳng, còn cờ phiên sẽ chặn tự mở lại khi hạt về trong cùng phiên. Khi đó cửa đang bị khóa (R4c), nên người chơi bị kẹt. Đặt R1 trong service.update() theo Player (D), không đặt ở luồng vào màn.
- R4 bản gốc (nút 🚪 hiện ngay sau ly đầu, giữa ca 1, kèm dòng gợi ý chữ): không lấy, theo Player (B). Nút mới chen vào nav 375px và mời người chơi đóng giữa ca; dòng chữ thì thừa vì báo cáo ca đã có nút Mở ca mới.
- R5 bản gốc dùng `stats.served = 0` toàn save làm điều kiện treo ca: không lấy cho điều kiện kết thúc ca, mà dùng `shift.served` theo Player. `stats.served` chỉ giữ cho điều kiện order V60 (R2b), vì đó đúng là luật 'trước ly đầu của save'.
- Rules (I) chặn robot gift 'ready' → 'active' trong ca tập: không lấy. Đây là hành vi sẵn có khi mở quán bằng tay, chặn sẽ thêm luật mới. Chỉ ghi chú ở R10; nếu playtest thấy vấn đề thì xử lý ở câu robot-staff.
- Kiên nhẫn vô hạn trong ca tập: không lấy. Không có số đo, và ×3 + ×0,25 hiện có đã đủ; cần playtest trước khi bàn thêm.
- docs_to_change bản gốc sửa ngay các bảng đã chốt: không lấy, theo Rules (H). Ghi đề xuất ở idea/audit/GDD trước, chỉ sửa onboarding-flow, gameplay và contracts sau khi sếp duyệt.

**Tham khảo game:**

- Good Pizza Great Pizza / Overcooked / Diner Dash: vào thẳng ca, khách đã có mặt, order đầu chính là bài hướng dẫn. Đúng ngữ cảnh ca dịch vụ.
- Hay Day: chỉ mượn ý 'nút chỉ xuất hiện khi thật sự có lựa chọn'. Không dùng làm bằng chứng cho ca tự mở, vì quầy bán Hay Day không phải ca dịch vụ có giờ.
- Mẫu chung: không dạy thao tác quản trị (mở cửa) trước thao tác cốt lõi (pha, bưng). Chỉ dạy cửa ở cuối vòng lặp đầu, bằng một nút hành động (Mở ca mới).

**Phụ thuộc:** Q8: bước 2 'pha V60' dùng Làm mẫu/💡 Gợi ý của ly V60 đầu. Thời gian ly đầu và nhịp Memory/Quick Taste sau ly đầu (R5) phụ thuộc Q8.; Q10: Cửa quán thành công trình chạm được ở farm, nên điểm vào quán và mục 'open-cafe' (R4b) sẽ được thay. Luật khóa Mở/Đóng trong ca tập chỉ áp cho 'door' trong quán; Cửa quán ngoài farm (`cafe-entrance`) luôn vào được.; Q4: món mở theo Cấp. V60 phải luôn mở được ở cấp 1, nếu không `lockReason(v60)` sẽ làm R2b rơi về món ngẫu nhiên. Audit:185 nêu V60 cần hạt chè, mà cây chè mở ở cấp 2.; Q2: nếu 'Gói mở rộng quán' (tools) cho kiosk sớm thì R2 phải bỏ qua kiosk trong ca tập (đã ghi trong R2).; Q1: luồng mở đầu quyết định lúc người chơi vào quán lần đầu và mục tiêu tổng ≤ 5 phút tới ly đầu (idea:199).

**Luật đã chốt bị đổi:**

- docs/shared/onboarding-flow.md:164-171: bảng 4 bước, bước 1 'Bấm «Mở cửa»', đổi thành 3 bước; bước không còn tính từ 'quán mở chưa'.
- docs/shared/onboarding-flow.md:175: luật 04/11 'bước 3 … Pour-over V60' đổi thành bước 2.
- docs/shared/onboarding-flow.md:173: câu 'Đóng quán hoặc rời quán giữa chừng… bước dẫn xuất từ state' bỏ 'quán mở chưa' khỏi nguồn dẫn xuất bước.
- docs/shared/onboarding-flow.md:300: kịch bản 2 'thẻ quán bước 1–4' và 'rời quán ở bước 3 → khách bỏ về (uy tín −1)' đổi thành 3 bước; rời quán chỉ tạm dừng ca, không trừ uy tín.
- docs/screens/04-cafe/gameplay.md:7: vòng chơi mở đầu bằng 'Mở cửa'.
- docs/screens/04-cafe/gameplay.md:20: thẻ 4 bước.
- docs/screens/04-cafe/gameplay.md:99-101: 'Mỗi lần mở cửa là một ca 4 phút', thêm ngoại lệ cho ca tập (không có giờ hết, kết thúc ở ly đầu).
- docs/screens/04-cafe/gameplay.md:138: 'bước 3' đổi thành bước 2.
- docs/shared/contracts.md:170: bước hướng dẫn quán bỏ `cafe.open`.
- F-40 (GDD và 04-cafe/gameplay): 'order đầu tiên của save là V60' đổi thành 'mọi order khi stats.served = 0 là V60'.

**Chờ sim:**

- Không

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Làm ngay (dạng đề xuất): hàng 7 bảng phút đầu (dòng 199) ghi 'Quán: ca tập tự mở, 1 khách V60 đứng sẵn: nhận order → pha (Làm mẫu) → bưng; ca tập xong ở ly đầu'. Ghi luật R1-R10 của Q7. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Làm ngay: mục 9 câu 7 và bảng 2.3 hàng 04 Quán (dòng 77) ghi câu trả lời Q7. Sửa 'nút Mở/Đóng từ ca 2' thành 'dạy cửa qua nút Mở ca mới trong báo cáo ca tập'. |
| `docs/design/godbean-gdd.md` | Làm ngay: thêm một dòng F-xx riêng cho 'Ca tập quán tự mở' với trạng thái 'Đề xuất, chờ sếp duyệt', liên kết onboarding-flow 3.7. Ghi chú sửa F-40 (V60 khi served = 0). Không ghi 'Kiểm chứng'. |
| `docs/shared/onboarding-flow.md` | Sau khi sếp duyệt: mục 3.7 (164-175) đổi thành bảng 3 bước theo R3, thêm R1, R2, R2a, R4, R5, R7, R8. Dòng 175 đổi 'bước 3' thành bước 2. Dòng 173 bỏ 'quán mở chưa' khỏi nguồn dẫn xuất bước. Dòng 300 viết lại kịch bản 2. |
| `docs/screens/04-cafe/gameplay.md` | Sau khi sếp duyệt: dòng 7 'Mở cửa (từ ca 2; ca tập tự mở)'. Dòng 20 viết lại 3 bước. Mục ca (99-101) thêm ngoại lệ ca tập R5 và báo cáo tích cực. Dòng 138 đổi thành bước 2. F-40 dùng điều kiện served = 0. Ghi rằng LEARN_GUESTS không còn tác dụng. |
| `docs/shared/contracts.md` | Sau khi sếp duyệt: dòng 170 đổi thành 'Bước hướng dẫn quán: từ tickets, hand/shelf, stats.served; ca tập tự mở khi chưa có cafe-intro'. Không thêm trường lưu mới. |
| `docs/screens/04-cafe/README.md` | Sau khi sếp duyệt: phần vào/ra và code ghi rằng service.update tự mở ca tập; ca tập khóa nút 🚪 HUD, cửa 3D, Auto 'door' và mục open-cafe (farm/game.js:447). |
| `docs/shared/crew-autoplay.md` | Sau khi sếp duyệt: Auto không nhắm 'door' khi chưa có cafe-intro (R9). |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một dòng ghi quyết định Q7 và các tài liệu đã sửa. |

**Save / contracts:** Không thêm trường lưu và không đổi `version`. Logic chỉ đọc các trường đã có: `tutorial.seen` ('cafe-intro'), `stats.served`, `cafe.open`, kho hạt rang. `shift`, khách và việc spawn chỉ sống trong phiên, nên R2, R2a, R5 chỉ áp dụng lúc chạy. Save cũ có `stats.served > 0` đã được migration đánh dấu `cafe-intro` (model.js:219), nên không bị ảnh hưởng và vẫn thấy 🚪 như cũ. Save đang dở intro: nếu quán đóng thì R1 tự mở; nếu quán mở thì `update()` mở ca tập, và bước được tính lại theo 3 bước.

**Kiểm chứng khi playtest:** Chưa chạy. Dùng save mới, test trên mobile 375×812 và desktop. (1) Vào quán lần đầu: cửa đang Mở, đúng 1 khách đứng ở đầu hàng quầy thu ngân (không qua kiosk), thẻ hiện Bước 1/3 với mũi chỉ trên quầy thu ngân. Ô 🚪 ẩn nhưng nav không nhảy; chạm cửa 3D chỉ hiện thông báo. (2) Order là Pour-over V60. Cho khách bỏ về rồi xem khách thay: vẫn gọi V60. (3) Pha chậm có chủ ý hơn 4 phút: ca không kết thúc. (4) Đặt ly lên kệ: thẻ vẫn ở bước 3 và mũi chỉ trỏ về kệ. (5) Bán ly đầu: Memory/Quick Taste hiện trước. Đóng hộp đó xong mới hiện báo cáo tích cực, không có chữ 'chưa đạt mục tiêu', có nút Mở ca mới. Ca 2 có đồng hồ và mốc, 🚪 hiện trên nav và trong menu farm. (6) Về farm rồi vào lại giữa bước 2, và tải lại trang giữa intro: quán vẫn mở, ca tập chạy tiếp, không quay về bước Mở cửa. (7) Save không có lô chè rang ≥ liều V60 (kể cả khi còn vối): không tự mở, chỉ thấy gợi ý thiếu hạt; cửa 3D và Auto không mở được quán. (8) Bật Auto trong ca tập: Auto không đi tới cửa. (9) Save cũ đã bán ly: quán đóng và có 🚪 như cũ. Đo thời gian từ lúc vào quán tới khi bán ly đầu (mục tiêu tổng ≤ 5 phút theo idea:199) và ghi vào báo cáo playtest. Chưa có số đo.

### Q8 — Làm mẫu ly V60 đầu

**Quyết định:** CÓ làm mẫu ly V60 đầu, dùng lại hệ 💡/👀 có sẵn. Ly làm mẫu là ly tự pha, không mang `demo`. Bật theo tutorial id 'v60-guided' (không dùng `made === 0`). Chỉ bước chọn bị kẹp 0,8, bước rót không bị kẹp. Đây là luật mới: ghi Đề xuất ở F-40 và chưa code tới khi sếp duyệt.

**Luật:**

- 1. Thuật ngữ (làm rõ câu chữ, không đổi luật, làm được ngay). 'Gợi ý/Làm mẫu' nghĩa là người chơi tự bấm, tự giữ rót, game chỉ sáng viền hoặc giải thích. '🤖 Auto pha' nghĩa là máy tự bấm, tự rót. Chỉ Auto pha gửi `demo: true` vào `farm.act('cafe','brew')` (bench.js:371). `gauge.demo` là trạng thái UI của 👀 Xem mẫu, khác cờ save `demo`.
- 2. Ly có 💡 Gợi ý, 👀 Xem mẫu hoặc làm mẫu tự bật đều tính là ly tự pha. Ly này tăng `cafe.mastery[id].best`/`made` (model.js:581), được ×2 giá, được tính vào TB ★ ly tự pha, và được ghi Coffee Memory `kind:'game'`, dùng được làm ly A/B/C của Decode. Không thêm nhãn hay cờ save.
- 3. Điểm ly vẫn là floor(trung bình bước × 100). Bước nào người chơi tự bấm 💡 hoặc 👀 thì giữ luật hiện hành: điểm bước = min(thực, 0,8) (bench.js:216).
- 4. Kích hoạt làm mẫu: mở bàn pha tay món V60 khi `tutorial.seen` chưa có id 'v60-guided', và không ở chế độ trí nhớ, không phải ⚡ Pha nhanh, không phải 🤖 Auto pha. Không dùng `made === 0`, vì `made++` chạy cả với ly `demo` và ly Pha nhanh (model.js:581): chỉ cần Auto toàn game pha nhanh khách V60 đầu là mất bước hướng dẫn. Không dùng `best < 70`, vì như vậy làm mẫu lặp mãi với người pha kém.
- 5. Đánh dấu 'v60-guided' bằng `farm.act('tutorial','seen','v60-guided')` khi `finish` của ly V60 pha tay đầu tiên chạy xong (không auto/quick/memory). Bỏ dở giữa ly thì lần sau làm mẫu lại bật. Ly Auto pha và Pha nhanh không đánh dấu id này. Phải thêm id vào `TUTORIAL_IDS` (farm/content.js) và contracts.md §5. Đây là một giá trị mới trong danh sách đã có, không phải trường mới.
- 6. Save cũ: lúc normalize, nếu `cafe.mastery.v60.best ≥ 70` thì tự thêm 'v60-guided' vào seen để người cũ không bị làm phiền. Save cũ có `best < 70` sẽ thấy làm mẫu một lần, chấp nhận được. Lưu ý: khối migrate ở model.js:215 chỉ chạy với save không có mảng `tutorial.seen`, nên cần một kiểm tra riêng.
- 7. Bước chọn (bean, grind, filter, time) của ly làm mẫu: ngay khi bước mở, sáng viền đáp án đúng và hiện lý do (`why`/`learn`) cùng lúc. Đặt cờ runtime `state.guided` cho bước đó trước khi người chơi bấm. Điểm bước = min(thực, 0,8).
- 8. Bước rót (dose, temp, bloom, main, pour) của ly làm mẫu không thêm trợ giúp ngoài vạch xanh và chữ mục tiêu vốn đã hiện (bench.js band/goal). Không tự rót, không đặt cờ, không kẹp. Người chơi vẫn được bấm 👀 Xem mẫu, và nếu bấm thì luật 3 áp dụng.
- 9. Hệ quả tính từ recipes.js (V60 có 4 bước chọn, 5 bước rót): ly làm mẫu rót hoàn hảo đạt tối đa floor((4×0,8+5×1)/9×100) = 91, tức ★★★. Mức này giống hệt ly có 💡 ở 4 bước chọn trong code hiện tại, nên không đổi luật đã chốt ('★★★ phải tự pha đạt 90', ly làm mẫu là tự pha). Câu 'ly có gợi ý không bao giờ đạt ★★★' trong quyết định gốc là sai so với code, phải bỏ.
- 10. Chữ hiển thị. Bước chọn được làm mẫu ghi note bằng chuỗi riêng (vd. 'Ly làm mẫu: bước chọn tối đa 80%'), không dùng hintCap 'Lần sau tự làm…'. Thẻ kết quả gộp thành một dòng chung cho cả ly, không lặp từng bước, để vừa màn 375 px. Dòng 'Sửa bước này trước' (bench.js:373-375) phải tính trên điểm thực trước khi kẹp, hoặc bỏ qua bước chỉ mất điểm do làm mẫu, để không báo sai 'Hạt'.
- 11. First Sixth Key: 'V60 ★★ lần đầu' = `cafe.mastery.v60.best ≥ 70` (awakening/rules.js:12-13,199). Ly làm mẫu hoặc ly có gợi ý đạt ≥ 70 thì thỏa. Ly Auto pha (`demo`) thì không. Thỏa điều kiện chỉ làm câu hỏi chuyển sang 'sẵn sàng'. Key of Curiosity vẫn phải qua đủ Decode A/B/C (decode-awaken.md §5).
- 12. ⚡ Pha nhanh và mốc trí nhớ giữ nguyên: sàn lấy từ `best` (quickScore 40–90). Ly làm mẫu 70–89 mở Pha nhanh ★★. Ly ≥ 90 mở ★★★ và chế độ trí nhớ như mọi ly tự pha.
- 13. Auto toàn game: khi khách V60 đầu tới trong lúc chưa có 'v60-guided', Auto vẫn ⚡ Pha nhanh như luật hiện hành và không đánh dấu id. Lần đầu người chơi tự mở bàn pha V60 vẫn có làm mẫu.
- 14. Lỗi riêng, không gộp vào Q8: ⚡ Pha nhanh trên món mới gửi score = quickScore(0) = 40 mà không mang `demo`, làm `best` lên 40 (recipes.js:262 + model.js:581). Điều này lệch câu 'Pha nhanh không nâng điểm thành thạo' (gameplay.md:118) và contracts.md:50. Ghi vào audit thành mục riêng, sửa code hoặc ghi ngoại lệ trong tài liệu.
- 15. Chốt hướng ngay, gồm 2 phần. (a) Luật 1–2 là làm rõ câu chữ, có thể sửa docs ngay. (b) Hướng của luật 3–13 ghi 'Đề xuất, chờ duyệt' ở F-40, chưa code, vì ý tưởng mobile-first đang ở trạng thái 'Đang xem' (chưa Đã chốt). Phần chờ dữ liệu là playtest: thời gian ly đầu (giả thuyết, chưa giải rủi ro '9 bước vượt 5 phút' ở gameplay.md:144), điểm ly đầu, tỉ lệ đạt ≥ 70. Không có số cân bằng mới nên không cần sim.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- Rule 7: chỉ sáng viền lô chè đang có trong kho. Q7 R1 bảo đảm có chè trước khi ca tập mở.
- Rule 13: phụ thuộc quyết định Q7 R9. Nếu Auto không nhận order V60 của ca tập thì rule 13 chỉ áp từ ca 2.
- Rule 14 (lỗi Pha nhanh best = 40): tách thành việc sửa lỗi riêng, làm trước Q8.

**Ý phản biện không lấy:**

- Bác điều kiện `best < 70` của bản rules: làm mẫu sẽ lặp mãi với người chơi pha kém, ép họ phải dùng gợi ý. Chọn tutorial id 'v60-guided' của bản player, vì nó theo mẫu `bench-intro` đã có, bật đúng một lần, và Auto/Pha nhanh không đốt mất được.
- Bác cách kẹp 0,8 mọi bước, kể cả bước rót (quyết định gốc và bản rules): ở bước rót, vạch xanh và chữ mục tiêu vốn đã hiện, người chơi tự giữ và tự thả, nên kẹp là phạt khi không có trợ giúp thật. Lấy lập luận của bản player, đồng thời bỏ câu 'dừng ở khoảng {amount}' để bước rót không còn trợ giúp nào phải kẹp.
- Bác câu của bản player 'trần ly đầu không cố định 80, cần sim scripts/balance-sim.mjs': không cần sim. Trần tính thẳng từ recipes.js (4 chọn, 5 rót) = 91 (★★★), giống ly 💡 ở bước chọn hiện nay. Không thêm trần cả ly 89, vì đó là luật mới ngoài phạm vi Q8 và lệch với 💡 hiện hành.
- Bác câu 'không cần thêm hệ mới' và câu 'không thêm cờ guided' của quyết định gốc: chế độ làm mẫu cần cờ runtime `state.guided` (không lưu), vì `state.hinted` hiện bị reset sau mỗi bước, còn `gauge.demo` thì tự rót.
- Bác rủi ro số 3 của quyết định gốc ('made===0 vẫn đúng khi Auto/Pha nhanh là hành vi mong muốn'): rủi ro này đọc sai model.js:581.
- Bác lý do 'đã giải rủi ro 9 bước vượt 5 phút': làm mẫu không bớt bước hay thời gian chờ. Đó chỉ là giả thuyết, cần playtest.

**Tham khảo game:**

- Good Pizza Great Pizza / Hay Day: bước hướng dẫn bắt buộc không phạt người chơi và vẫn tính tiến trình thật. Học được: ly làm mẫu tính thành thạo, không phạt bước rót mà người chơi tự làm.
- Cooking Mama: chủ động nhờ trợ giúp thì giảm trần điểm. Học được: chỉ kẹp ở bước game lộ đáp án (bước chọn) hoặc khi người chơi tự bấm 💡/👀.
- Overcooked: màn hướng dẫn là màn thật. Học được: không dùng mẫu Practice 'không tính' như Rhythm Heaven, vì ly đầu nằm trên lối bắt buộc tới First Key.

**Phụ thuộc:** Q7: ca tập tự mở, khách V60 đầu đứng sẵn, `cafe-intro` xong khi bán ly đầu. Làm mẫu là bước 2 'pha V60' của thẻ 3 bước. Thời gian ly đầu đo chung với Q7.; Q1: thiên đàng mini trước farm và mục tiêu onboarding 'ly đầu ≤ 5 phút'. Q8 chỉ là giả thuyết giảm thời gian cho mục tiêu này.; Q6/Auto toàn game (luật hiện hành gameplay.md:118): thứ tự giữa Auto pha nhanh khách V60 đầu và làm mẫu (luật 13).

**Luật đã chốt bị đổi:**

- Không

**Chờ sim:**

- Không

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/screens/04-cafe/gameplay.md` | Dòng 113 (Auto pha): đổi 'tính như dùng Làm mẫu' thành 'mỗi bước kẹp 0,8 như bước có gợi ý; ly mang cờ `demo` nên không tăng thành thạo'. Đây là làm rõ, làm được ngay. |
| `docs/screens/04-cafe/gameplay.md` | Dòng 144 (Rủi ro): thêm mục 'Đề xuất, chờ duyệt' cho làm mẫu ly V60 đầu (id 'v60-guided', viền và lý do ở bước chọn, trần 0,8 chỉ ở bước chọn, rót không kẹp, tối đa 91). Không chèn vào mục 'chốt 04/11'. Giữ thời gian ly đầu ở dạng giả thuyết cần playtest. |
| `docs/shared/contracts.md` | §5 dòng 144: thêm 'v60-guided' vào danh sách TUTORIAL_IDS (đánh dấu ở bench khi ly V60 pha tay đầu xong) và thêm migrate 'best ≥ 70 → seen'. Dòng 50/67: ghi chú `demo` chỉ dành cho Auto pha, ly có gợi ý không gửi `demo`, `made` tăng cả với ly demo/quick. Ghi lệch Pha nhanh món mới làm `best` = 40. Ghi khi được duyệt. |
| `docs/shared/decode-awaken.md` | §5 dòng 92: ghi 'V60 ★★' = `cafe.mastery.v60.best ≥ 70`; ly gợi ý/làm mẫu được tính, Auto pha thì không; chỉ mở câu hỏi, Key vẫn phải qua Decode A/B/C. |
| `docs/shared/ui-audio-vfx.md` | Dòng 332: chú thích `gauge.demo` là trạng thái UI của Xem mẫu, khác cờ save `demo`. Nếu được duyệt thì thêm `state.guided` (cờ runtime của ly làm mẫu) và chuỗi note riêng, gộp một dòng. |
| `docs/shared/onboarding-flow.md` | Mục 2: thêm bước 'ly V60 đầu có làm mẫu ở bước chọn' (Đề xuất). Ghi số cần đo khi playtest. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | #13 và câu hỏi 8: ghi quyết định Q8 cuối. Thêm mục lỗi riêng: Pha nhanh món mới làm `best` = 40 và `made` tăng với demo/quick. |
| `docs/design/godbean-gdd.md` | Mục 0, dòng F-40: 'Làm mẫu ly V60 đầu (tutorial id v60-guided)', trạng thái Đề xuất, chờ duyệt. Không ghi Kiểm chứng. |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một gạch đầu dòng ghi quyết định Q8 và các tài liệu đã sửa. |

**Save / contracts:** Không thêm trường save. Thêm giá trị 'v60-guided' vào danh sách `TUTORIAL_IDS` sẵn có (`farm.tutorial.seen`, contracts.md §5). Migrate khi normalize: nếu `cafe.mastery.v60.best ≥ 70` thì đánh dấu seen. Việc này cần kiểm tra riêng ngoài khối model.js:215, vì khối đó chỉ chạy với save thiếu mảng seen. Ly làm mẫu ghi `best`/`made` như ly tự pha. `demo` chỉ dành cho Auto pha. `state.guided` là cờ runtime, không lưu.

**Kiểm chứng khi playtest:** Dùng save mới và ít nhất 5 người chơi mới, trong đó có 1 ca bật Auto toàn game trước khi tự pha. (1) Khách V60 đầu (ca tập Q7), mở bàn pha tay: 4 bước chọn tự sáng viền kèm lý do, 5 bước rót không có trợ giúp thêm, không bị kẹp, kim chỉ chạy khi tự giữ. (2) Thẻ kết quả chỉ có 1 dòng 'ly làm mẫu', không có 9 dòng hintCap, và 'Sửa bước này trước' không trỏ sai vào 'Hạt'. Điểm ≤ 91. Nếu ≥ 70: `best` = điểm, `made` = 1, ×2 giá, Sổ tay báo câu hỏi First Key sẵn sàng, Pha nhanh V60 ★★. (3) Ly V60 thứ hai không tự bật làm mẫu, 💡 vẫn dùng được. (4) Bật Auto toàn game trên save mới: Auto pha nhanh khách V60 không đánh dấu 'v60-guided', lần đầu tự mở bàn pha vẫn có làm mẫu. 🤖 Auto pha 2 xu không đổi `best` và không mở First Key. (5) Bỏ dở giữa ly rồi mở lại thì làm mẫu bật lại. (6) Save cũ có v60.best ≥ 70 không thấy làm mẫu. Ghi cho mỗi người: thời gian ly đầu (mục tiêu ≤ 5 phút, onboarding-flow mục 2), điểm ly đầu, có đạt ≥ 70 không. Chỉ đổi GDD sang 'Kiểm chứng' khi đã có số đo.

### Q9 — Sự cố nhân viên

**Quyết định:** Ẩn sự cố nhân viên bằng một miễn trừ do thiết kế đặt, không thêm nút tắt. Ngưỡng là cấp người chơi, gắn vào sự kiện "mở chỗ thợ thứ 2 + 1 cấp" chứ không ghi cứng số 9; sự cố bật dần, không nhảy từ 0 lên đủ xác suất; sự cố đầu luôn là Mải chơi. Chốt hướng ngay; con số chờ Q4 và sim; chỉ ghi thành đề xuất, chưa sửa đặc tả màn.

**Luật:**

- CHỐT HƯỚNG NGAY 1. Thêm miễn trừ 7 cho cả farm và quán: không có sự cố người khi levelFor(progress.xp) < INCIDENTS.minLevel. 'Cấp' là cấp người chơi, không phải cấp thợ: thợ tối đa cấp 10 (rules.md:41), và xác suất đã giảm theo cấp thợ (rules.md:48). Giữ câu 'Không có tùy chọn tắt sự cố' (rules.md:49), vì đây là miễn trừ do thiết kế đặt, cùng loại với grace 2 và minRep 30 (farm/rules.js:97).
- CHỐT HƯỚNG NGAY 2. Ngưỡng gắn vào sự kiện, không gắn vào con số: minLevel = (cấp mở chỗ thợ thứ 2, lấy từ cùng nguồn với bảng mở khóa) + 1. Theo bảng đề xuất ở audit dòng 136 (chỗ thứ 2 ở cấp 9), minLevel = 10. Như vậy người chơi có trọn một cấp để quen quản 2 người, và cấp 9 không phải mở 4–5 thứ cùng lúc (trái quy tắc 'mỗi cấp tối đa khoảng 2 thứ mới', audit:124).
- CHỜ Q4 3. Khi bảng cấp của Q4 chưa chốt hoặc chưa vào code, dùng phương án tạm theo code hiện hành: minLevel = (cấp mở HUD 'workers', hiện là 3, theo farm/content.js:115) + k. Giá trị k: cần sim scripts/balance-sim.mjs. Không được áp minLevel = 9 vào code hiện tại, vì code đang cho thuê người từ cấp 3 hoặc sớm hơn (khi claimed 'expand'), nên khoảng cấp 3–8 sẽ không còn sự cố.
- CHỐT HƯỚNG NGAY 4. Gom mọi miễn trừ vào một hàm chung incidentExempt(ctx) đặt trong farm/rules.js. Gọi hàm này ở cả 4 điểm: lúc quay ở farm (signContract, model.js:144), lúc quay ở quán (cafeShiftPaid, model.js:150), lúc kích hoạt ở farm (act 'incident', model.js:523) và lúc kích hoạt ở quán (model.js:603, gọi từ cafe/service.js:434). Dưới minLevel thì lúc quay trả về type 'none', không chỉ hủy lúc kích hoạt.
- CHỐT HƯỚNG NGAY 5. Thứ tự mở: từ minLevel, sự cố đầu tiên chỉ có thể là Mải chơi 📱. Sick và rude bị chặn cho tới khi cờ progress.incidentIntro = true. Cờ được kiểm tra cả lúc quay (xác suất bằng 0) lẫn lúc kích hoạt: sick/rude đã quay sẵn mà cờ chưa bật thì đổi thành 'none' và đánh dấu done. Cờ dùng chung cho farm và quán, có chủ đích: gặp Mải chơi ở một màn là đã học cơ chế.
- CHỐT HƯỚNG NGAY, SỐ CHỜ SIM 6. Đặt trần cho cờ incidentIntro: cờ cũng bật khi đã qua N ngày công/ca có người kể từ lúc đạt minLevel, kể cả khi chưa có Mải chơi nào được áp dụng. Lý do: nếu chỉ chờ Mải chơi, ca có barista cấp 5 kèm Quản lý ca chỉ có xác suất phone ≈ 0,12 × 0,52 × 0,5 ≈ 3%/ca (từ cấp 6 hệ số chạm sàn 0,4: ≈ 0,12 × 0,4 × 0,5 = 2,4%/ca), và hệ sự cố coi như bị tắt ngầm. N đề xuất là 5, cần sim scripts/balance-sim.mjs.
- CHỐT HƯỚNG NGAY, SỐ CHỜ SIM 7. Tăng dần: trong M ngày công/ca có người đầu tiên kể từ minLevel, nhân xác suất sự cố với hệ số r. Đề xuất M = 3, r = 0,5, cần sim scripts/balance-sim.mjs. Sau khoảng đó dùng xác suất gốc.
- CHỐT HƯỚNG NGAY 8. Gợi ý lần Mải chơi đầu tiên ('Thợ đang mải chơi, bấm «Nhắc» để gọi lại') hiện một lần, trỏ vào toast hoặc vào thợ, không mở modal và không làm tối map. Nếu lúc đó đang mở modal (Shop, Kho, Nhân viên…), kể cả khi Auto chạy phía sau modal, thì ghi vào 'Cần xử lý' kèm nút «Nhắc», rồi hiện gợi ý khi modal đóng. Thời gian chờ tối đa vẫn là 40 s (phoneMs).
- GIỮ NGUYÊN 9. Giữ mọi miễn trừ đã chốt: 2 ngày công/ca đầu sau khi thuê; người chơi đang ở quán (với farm); uy tín quán < 30; Nghỉ ốm khi farm chỉ có đúng 1 người và người đó đang giữ đơn; gói thử robot (chỉ ở quán); robot không bao giờ gặp sự cố. Giữ xác suất gốc (phone 12%, sick 4%, rude 5%), hệ số theo cấp thợ (sàn 0,4) và Quản lý ca 0,5, trần 1 sự cố mỗi ngày công/ca, Nghỉ ốm không mất lương. «Nhắc» luôn có sẵn; robot và «Thuê robot thay» mở trước minLevel.
- CHỐT HƯỚNG NGAY 10. Không có tùy chọn, công tắc hay cài đặt nào để người chơi tắt hoặc hoãn sự cố. minLevel, M, r, N là hằng số thiết kế trong INCIDENTS (farm/rules.js). Nếu sim lệch so với mục tiêu 'sau khoảng 1 giờ' thì chỉ đổi hằng số, không đổi cấu trúc luật.
- SỬA LẬP LUẬN 11. Sự cố là 'việc cần trông khi có mặt' và là cái giá để chọn người thay robot (robot-staff.md:36). Nó không phải lý do quay lại game, vì theo miễn trừ 3 (robot-staff.md:107) sự cố chỉ xảy ra khi người chơi đang ở màn đó. Từ lúc mở robot tới minLevel, người tạm không có cái giá sự cố; robot vẫn rẻ hơn (15 xu so với 30+10(L−1) xu, rules.js:92). Báo cáo gói thử robot nên ghi 'người sẽ cần trông từ cấp X', để không hứa trước một cái giá chưa có.
- QUY TRÌNH 12. Q9 là đề xuất sửa danh sách miễn trừ đã chốt của F-18 (Đã chốt, Đã code, GDD:100). Việc này cần sếp duyệt. Tạo dòng D-xx mới trong GDD liên kết với D-10 (4 chỗ code robot/sự cố đang lệch spec), và nên xử lý cùng đợt với D-10 và lỗi B-2 (signContract quay đè sự cố cũ). Không sửa rules.md, robot-staff.md, contracts.md, 04-cafe/gameplay.md và không code cho tới khi ý tưởng mobile-first ở trạng thái 'Đã chốt' và có F-xx/D-xx (AGENTS.md). Không ghi Kiểm chứng.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- Mọi chỗ tham chiếu dùng INCIDENTS.minLevel / incidentExempt(ctx), không ghi số 9 hay 10. Q4 và Q10 sửa theo.
- Ghi rõ minLevel có thể > 10 vì levelFor có cấp trên 10 (content.js:120).

**Ý phản biện không lấy:**

- Mâu thuẫn ở ngưỡng: phản biện rules muốn minLevel = cấp mở chỗ thứ 2 (9); phản biện player muốn chỗ thứ 2 + 1 (10). Chọn +1 của player. Lý do: audit dòng 136 đã xếp vào cấp 9 slot 2 ở farm và quán cùng vòi sữa; thêm sự cố là trái quy tắc 'tối đa khoảng 2 thứ mới mỗi cấp' (audit:124), và người chơi gặp phạt đúng lúc vừa học quản 2 người. Cả hai bên đồng ý điểm chính là gắn ngưỡng vào sự kiện, không ghi cứng số.
- Phương án tạm của rules, 'miễn N ngày công kể từ lần thuê người đầu tiên': không lấy. Chọn biến thể 'cấp mở workers + k' (cũng do rules đề xuất). Lý do: biến thể này vẫn dùng levelFor(progress.xp) như luật chính và không cần thêm trường ngày thuê đầu vào save.
- Quyết định gốc 'minLevel = 9 cứng trong INCIDENTS': bác. Cả hai phản biện chỉ ra rằng số này neo vào bảng cấp ở ý tưởng trạng thái Đang xem (chưa Đã chốt). Code hiện mở thợ ở cấp 3 (content.js:115), nên số 9 sẽ xóa sự cố ở cấp 3–8.
- Quyết định gốc 'chặn sick/rude chỉ lúc quay': bác, theo rules (3). Nhánh act 'incident' (model.js:523, :603) không xét cờ, nên sự cố đã quay sẵn vẫn kích hoạt.
- Quyết định gốc 'cờ incidentIntro chỉ bật khi có Mải chơi applied': bác, theo player (3). Thêm trần N để tránh hệ sự cố bị tắt ngầm khi phone chỉ còn khoảng 3%/ca.
- docs_to_change gốc (sửa ngay rules.md, robot-staff.md, contracts.md, 04-cafe/gameplay.md): hoãn tới khi được duyệt, theo rules (2) và AGENTS.md (ý tưởng ở trạng thái Đang xem (chưa Đã chốt) thì chưa vào đặc tả hay code).
- Rationale gốc 'sự cố là lý do quay lại' và 'trước cấp 9 người luôn tốt hơn robot mà không có cái giá nào': sửa lại theo cả hai phản biện. Sự cố chỉ xảy ra khi người chơi có mặt (miễn trừ 3), và robot vẫn rẻ hơn (15 xu so với 30+ xu).
- Ý của rules 'chưa có trích nguồn PDF founder': ghi nhận nhưng không chặn quyết định. Sự cố nhân viên không thuộc hệ P0 founder, và Q9 không đụng tới Memory, Quick Taste, Decode hay V60. Nên đối chiếu docs/references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf khi trình sếp.

**Tham khảo game:**

- RimWorld: không có nút tắt; storyteller tăng sự cố dần theo thời gian và tài sản. Học được: dùng hệ số tăng dần, không bật từ 0 lên đủ xác suất ngay.
- Stardew Valley: công cụ xử lý có trước thử thách. Học được: «Nhắc» và robot mở trước minLevel.
- Hay Day và các game casual trên di động: không có sự cố tiêu cực ở đầu game. Học được: giờ đầu trên di động không có phạt khó hiểu.
- Two Point Hospital, Frostpunk: mỗi sự cố có lối ra rõ. Học được: Nhắc ≤ 40 s, Nghỉ ốm không mất lương, Thuê robot thay.

**Phụ thuộc:** Q4: minLevel đọc mốc 'mở chỗ thợ thứ 2' trong bảng cấp. Q4 chưa chốt thì chỉ dùng phương án tạm ở luật 3, và con số 9/10 chưa có hiệu lực.; Q10 (yếu): nếu Nhà thợ thành công trình chạm được thì gợi ý «Nhắc» và lối vào modal Nhân viên phải khớp với nó; luật sự cố không đổi.

**Luật đã chốt bị đổi:**

- docs/screens/03-farm/rules.md:49: thêm miễn trừ 'cấp người chơi < minLevel' và luật Mải chơi trước, có trần N. Câu 'Không có tùy chọn tắt sự cố' giữ nguyên.
- docs/shared/robot-staff.md:103-110 (Không có sự cố khi): thêm miễn trừ 7, cờ incidentIntro và hệ số tăng dần.
- docs/shared/robot-staff.md:130-140 (bảng kỳ vọng sự cố): ghi rằng bảng chỉ áp dụng khi cấp ≥ minLevel và đã qua khoảng tăng dần.
- docs/screens/04-cafe/gameplay.md (mục Sự cố nhân viên quán): thêm cùng ngưỡng và thứ tự Mải chơi trước.
- Các thay đổi trên là đề xuất, chờ sếp duyệt (F-18 đang Đã chốt/Đã code). Chưa ghi vào đặc tả màn.

**Chờ sim:**

- Số phút chơi thực tế để tới minLevel (mục tiêu 'khoảng 1 giờ'), theo bảng cấp Q4: cần sim scripts/balance-sim.mjs
- k trong phương án tạm minLevel = cấp mở 'workers' (3) + k: cần sim scripts/balance-sim.mjs
- M (đề xuất 3) và r (đề xuất 0,5) của khoảng tăng dần: cần sim scripts/balance-sim.mjs
- N (đề xuất 5) ngày công/ca, trần mở sick/rude khi chưa gặp Mải chơi: cần sim scripts/balance-sim.mjs
- Số ngày công/ca trung bình trước sự cố đầu, và tần suất sự cố mỗi giờ ở farm 2 người và ở quán sau minLevel: cần sim scripts/balance-sim.mjs

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Bảng F-18 (dòng 169): mốc thành 'một cấp sau khi mở chỗ thợ thứ 2 (≈ cấp 10 theo bảng đề xuất; số phút cần sim)'. Bảng xung đột mục 6 (dòng 227) và câu hỏi 6 (dòng 243): 'không trái câu cấm tắt; sửa danh sách miễn trừ đã chốt của F-18, cần duyệt'. |
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Dòng 136: chuyển 'sự cố nhân viên' từ cấp 9 sang dòng cấp 10, ghi là slot2+1. Câu hỏi 9 (dòng 254): ghi quyết định (miễn trừ, cấp người chơi, gắn vào sự kiện, tăng dần, Mải chơi trước, có trần N, phụ thuộc Q4). Kiểm lại cấp 10 sau khi thêm sự cố vẫn đúng quy tắc tối đa khoảng 2 thứ mới mỗi cấp. |
| `docs/design/godbean-gdd.md` | Thêm dòng D-xx: 'Q9 ẩn sự cố tới minLevel bằng miễn trừ, chờ duyệt, phụ thuộc Q4'. Liên kết D-xx với D-10 và B-2. Thêm ghi chú vào F-18 (dòng 100). Không ghi Kiểm chứng. |
| `docs/design/progress/2026-11-05-<người>.md` | Thêm một gạch đầu dòng về quyết định Q9. |
| `SAU KHI DUYỆT: docs/screens/03-farm/rules.md, docs/shared/robot-staff.md, docs/screens/04-cafe/gameplay.md` | Ghi luật 1–10 như ở locked_rules_changed. Ghi rõ cấp là levelFor(progress.xp). |
| `SAU KHI DUYỆT: docs/shared/contracts.md` | Thêm progress.incidentIntro và progress.incidentShifts. Thêm các hằng INCIDENTS.minLevel/rampShifts/rampFactor/introCap. |
| `SAU KHI DUYỆT (code, ngoài tài liệu): src/i18n/locales/farm.js và locale quán; tests/` | Thêm chuỗi gợi ý «Nhắc» lần đầu và dòng 'Cần xử lý'. Thêm test cho incidentExempt ở 4 điểm gọi, cho cờ chặn lúc kích hoạt, cho trần N và cho save cũ. |

**Save / contracts:** Nhẹ, không cần chuyển save phức tạp. Cấp người chơi suy ra từ progress.xp sẵn có. Thêm 2 trường: progress.incidentIntro (boolean, mặc định false) và progress.incidentShifts (số nguyên ≥ 0, mặc định 0). incidentShifts đếm ngày công/ca có người đã trả lương khi cấp ≥ minLevel, gộp farm và quán; trường này phục vụ cả khoảng tăng dần M lẫn trần N. Khi tải save: nếu một thợ hay nhân viên quán có incident type 'phone' và done=true thì có thể đặt incidentIntro=true (không bắt buộc). Save cũ dưới minLevel: sự cố đã quay sẵn bị incidentExempt hủy lúc kích hoạt (đổi thành 'none' và done), không mất lương hay hàng. Save cũ từ minLevel trở lên mà incidentIntro=false: sick/rude đang chờ cũng bị hủy lúc kích hoạt (sửa câu sai trong save_impact gốc), sau đó mở lại khi có Mải chơi hoặc sau N ca. Không đổi cấu trúc w.incident hay s.incident (model.js:34).

**Kiểm chứng khi playtest:** 1) Save mới: thuê người ở farm và quán, uy tín ≥ 30, qua 2 ngày công đầu, chơi tới cấp minLevel−1. Không có toast sự cố nào; ở debug, incidentOdds hoặc kết quả quay là 'none'. 2) Ở cấp minLevel: sự cố đầu ở farm hoặc quán luôn là Mải chơi. Gợi ý «Nhắc» hiện khi không có modal; nếu đang mở Shop/Kho (Auto bật) thì gợi ý vào 'Cần xử lý' và hiện khi đóng modal. Bấm «Nhắc» thì thợ làm lại; không bấm thì tối đa 40 s. 3) Trước Mải chơi đầu hoặc trước N ca thì không có Nghỉ ốm hay Chửi khách; sau đó thì có. Thử ca quán có Quản lý ca, người chơi đứng ở quán: sick/rude vẫn mở sau N ca. 4) Các miễn trừ cũ vẫn chạy: ở quán thì farm không có sự cố; uy tín < 30 thì không có; farm 1 người giữ đơn thì không ốm. 5) Không có nút tắt hoặc hoãn trong Cài đặt và modal Nhân viên. 6) Save cũ dưới minLevel đang có sự cố chờ: sự cố bị hủy, không mất lương. Save cũ từ minLevel trở lên có sick đang chờ, cờ false: sự cố bị hủy, không lỗi. 7) Mỗi playtester ghi số phút tới minLevel và số phút tới sự cố đầu, để so với sim scripts/balance-sim.mjs. 8) Hỏi người chơi ở cấp minLevel có thấy quá tải không, so với cấp mở chỗ thứ 2.

### Q10 — Công trình thay nút HUD

**Quyết định:** Chọn hướng thay nút HUD bằng công trình, nhưng chỉ làm 4 công trình: Cửa quán, Bảng đơn, Sạp ven đường, Nhà thợ. Không dựng Xưởng nâng cấp; nâng cấp nằm trên từng vật thể, còn danh sách tổng để trong ≡. Cổng Hội đồng chuyển sang Q1. Mỗi nút HUD chỉ được gỡ khi công trình tương ứng chạm trúng được ở khung dọc 375×812. Toàn bộ vẫn là đề xuất, vì idea đang ở trạng thái "Đang xem" (chưa Đã chốt).

**Luật:**

- CHỐT HƯỚNG NGAY (đề xuất, chờ sếp duyệt và có dòng F-xx rồi mới ghi vào rules.md):
- CT-1 Danh sách: farm có 4 công trình chạm được: Cửa quán (`cafe-door`), Bảng đơn (`order-board`, đặt sát Cửa quán trong cụm thương mại gần cổng trước), Sạp ven đường (`seed-shop`) và Nhà thợ (`crew-house`). Q10 không dựng Xưởng nâng cấp. Cổng Hội đồng không thuộc Q10 mà thuộc câu trả lời Q1. Sân phơi, lò rang, máy xay, giếng, ao và biển ruộng giữ nguyên.
- CT-2 HUD farm khi xong chuyển đổi gồm: avatar/cấp, Việc tiếp theo, chip xu, Kho (🎒), nút ngữ cảnh/dải công cụ, ≡. Các mục ☕ Vào quán (cụm phải), 🏪 Cửa hàng, 📦 Đơn hàng, Nhân viên và 🔧 Nâng cấp lần lượt rời HUD, nhưng chỉ khi qua cổng ở CT-11. Chip xu vẫn là lối tắt, mở tab giống của Sạp (không bỏ hẳn luật rules.md:144).
- CT-3 Chạm thẳng một công trình đang thấy trên màn và có modal (Bảng đơn, Sạp, Nhà thợ) thì modal mở ngay giữa màn hình, nhân vật không phải đi tới. Modal có nút đóng và khoá di chuyển. Mở modal vẫn gọi clearInput + cancelWork như code hiện tại; lý do chọn "không đi bộ" là để bớt ma sát, không phải để giữ việc đang làm. Khi Auto bật, nhân vật vẫn làm việc phía sau modal (crew-autoplay mục 5).
- CT-4 Lối tắt từ xa (≡, Việc tiếp theo, nút 'sang cửa hàng', chip xu, Cần xử lý) lia camera tới công trình trước rồi mới mở modal, để người chơi học vị trí công trình. Đóng modal thì camera trả focus về nhân vật. Thời gian lia không ghi số cố định trong luật mà đo khi playtest.
- CT-5 Chạm Cửa quán thì nhân vật đi tới cửa, tới nơi mới chuyển cảnh vào quán. Nếu đang đứng trong khoảng tương tác thì vào ngay. Ra khỏi quán thì nhân vật đứng trước Cửa quán.
- CT-6 Sạp ven đường mở đúng modal `seed-shop` hiện có, giữ 3 tab Giống / Vật tư / Chợ ('trade'). Tab Chợ đã chứa `shop-order` (đơn cố định, ORDERS_PER_DAY) và `shop-sell:*`. Bỏ trạm 3D `market`, nhưng giữ id hành động `market` trong model, autoplay và world.setObjectStatus. Dời trạm `seed-shop` từ [12,12] vào trong FARM_BOUNDS (maxZ=4). Khi hết giống, nút 'sang cửa hàng' lia camera tới Sạp rồi mở tab Giống.
- CT-7 Bảng đơn gọi openOrderBoard (kind 'jobs') và giữ hành vi tự tạo đơn cafe cho quest `ship`. Lối `delivery` (kind 'orders') vẫn là phím tắt từ Cần xử lý.
- CT-8 Nhà thợ mở modal Nhân viên 4 tab như hiện hành (Farm hiện tại · Người · Robot · Chỉ thị). Lối 'thuê robot thay ca' và 'Cần xử lý' về thợ mở modal này kèm lia camera theo CT-4.
- CT-9 Nâng cấp làm ngay trên vật thể: modal máy, Kho, giếng, ao và quán giữ khối nâng cấp riêng như code (game.js:531-533). Vật thể có huy hiệu ⬆ chỉ khi vừa đủ cấp vừa đủ xu. Danh sách tổng của menu `upgrades` (cả tab 'cafe') chuyển thành mục 'Nâng cấp' trong ≡, mở remote. Sửa gameplay.md:52 (đang ghi giếng không mở nâng cấp, lệch code) trong cùng thay đổi tài liệu. Nếu playtest cho thấy người chơi không tìm ra nâng cấp thì xét dựng Xưởng sau.
- CT-10 Trạng thái nhìn thấy được, không phụ thuộc asset: Ẩn → Dựng lên (hiệu ứng + một bàn tay chỉ, ít chữ) → Rảnh / Có việc. Huy hiệu: ✓ ở Bảng đơn khi có đơn giao được, chấm số khi có đơn chờ; ! ở Nhà thợ khi thợ cần xử lý; ! ở Sạp khi hết giống mà còn ô trống. Không có luật 'chỉ một công trình Khoá kế tiếp'. Biển 🔒 chỉ dùng cho mốc theo Cấp, sau khi Q4 chốt.
- CT-11 Cổng gỡ nút HUD: trong lúc chuyển, menu dưới cũ vẫn giữ (thu gọn). Một nút chỉ bị gỡ khi công trình tương ứng chạm trúng được ở khung dọc mặc định (portraitView focus [-6.4,-.5], zoom .9) mà không cần xoay và không bị che. Công trình không đạt thì dời toạ độ, chỉnh portraitView, hoặc giữ nút HUD của nó.
- CT-12 Mốc hiện tạm thời dùng `HUD_UNLOCKS.when` (content.js:111-117): cafe-play gắn Cửa quán, seed-shop gắn Sạp, order-board gắn Bảng đơn, workers gắn Nhà thợ. Mốc upgrades chuyển sang mục ≡; build và tools vẫn là HUD hoặc ≡. Công trình đã hiện một lần (có cờ `unlock-<id>`) thì không ẩn lại nữa, để nhánh 'hết giống' của seed-shop không làm Sạp chớp tắt. Vòng toast/chấm 'Mới' (`ui.unlocks`, game.js:659-662) chuyển sang huy hiệu công trình, giữ đủ id `unlock-*-used`: cafe-play, seed-shop, order-board, upgrades, workers, build, tools. Save cũ đã qua mốc thì thấy công trình ngay, không toast (rules.md:145).
- CT-13 Vùng không phải 'both' (farm-only) thì không dựng Cửa quán và Bảng đơn, giống điều kiện `regionType(p.region)==='both'` hiện có.
- CT-14 decorations.js: mỗi công trình mới có vùng cấm xây. Hiện chỉ miễn kind 'shop'/'market', nên phải thêm kind của công trình mới. Đồ trang trí của save cũ nằm trong vùng đó thì tự dời và trả về kho, không xoá.
- CT-15 Xây dựng/Trang trí không thuộc danh sách công trình; giữ mốc mở như onboarding 3.3, chỉ đổi vị trí nút khi Q4 chốt.

*CHỜ PLAYTEST / SIM:*

- CT-16 Chờ playtest: toạ độ cụ thể của 4 công trình (sơ đồ audit mục 3 lệch code), thời gian lia camera, và kiểm cổng CT-11 cho từng công trình.
- CT-17 Chờ Q4 và sim: đổi mốc hiện công trình từ `when` sang bảng Cấp, và chọn cấp cụ thể để mở biển 🔒 (cần sim scripts/balance-sim.mjs). Q10 không ghi số cấp mới nào.
- CT-18 Các hệ P0 (Coffee Memory, Quick Taste 6 thuộc tính, Decode/First Sixth Key, V60 đầu) giữ nguyên, Q10 không đụng tới.

**Vá sau soát chéo (thắng luật ở trên khi khác nhau):**

- CT-1: đổi id `cafe-door` thành `cafe-entrance`. Farm có 4 công trình cộng Cổng Hội đồng (Q1), cả 5 theo CT-10/CT-11/CT-14.
- CT-3: luật chung là vật mở modal hoặc hội thoại tại chỗ thì mở ngay; vật đổi cảnh thì đi bộ (CT-5). Áp cho cả Cổng Hội đồng.
- CT-10: huy hiệu ! ở Nhà thợ theo incidentExempt, bỏ 'cấp < 9'.
- CT-12: pha 1 giữ `when`; pha 2 (sau sim Q4) đổi sang level ≥ N và giữ các nhánh nhu cầu.

**Ý phản biện không lấy:**

- Xưởng nâng cấp: hai phản biện mâu thuẫn. Rules muốn giữ Xưởng và gọi là 'danh sách đầy đủ'; player muốn bỏ hẳn. Chọn player. Lý do: dẫn chứng CoC không có nguồn, Hay Day nâng cấp ngay trên vật thể, bản đồ dọc đã chật, và Xưởng sẽ thành nơi thứ hai cho cùng một việc vì code đã có khối nâng cấp trên máy, Kho, giếng, ao, quán. Lấy phần đúng của rules: giữ khối nâng cấp ở mọi vật thể và sửa gameplay.md:52.
- Chip xu: quyết định gốc bỏ chip xu mở shop; player giữ làm lối tắt. Chọn giữ, vì vậy ít phá luật đã chốt (rules.md:144, onboarding:76) mà vẫn có lối tới Sạp khi Sạp nằm ngoài khung.
- Cổng Hội đồng: player để 'có điều kiện theo Q1-B' trong danh sách; rules muốn tách hẳn sang Q1. Chọn rules để Q10 không trộn luật màn 02.
- Sạp 3 tab Mua / Đơn chợ / Bán (rules): không lấy. Modal seed-shop đã có 3 tab Giống / Vật tư / Chợ, và tab Chợ đã chứa shop-order và shop-sell. Giữ nguyên thì không phải đổi UI; mối lo của rules về đơn cố định đã được đáp ứng.
- Thời gian lia camera: quyết định gốc ghi 200 ms, player ghi 300–400 ms. Không lấy số nào, theo rules: số chưa có cơ sở, để playtest đo.
- Luật 'mỗi lúc chỉ một công trình Khoá kế tiếp' (CT-9 gốc): bỏ theo player, vì các điều kiện `when` chạy song song, không có thứ tự tuyến tính.
- Lý do 'đi bộ thì cancelWork' trong quyết định gốc: bỏ, vì mở modal shortcut cũng gọi cancelWork (player).

**Tham khảo game:**

- Hay Day: chức năng kinh tế là công trình, bảng đơn đặt sát nơi giao hàng, nâng cấp ngay trên vật thể. Khác biệt: Hay Day pan camera tự do, còn Godbean bám nhân vật và khoá portraitView, nên phải có cổng 'vừa khung dọc' (CT-11) và lia camera cho lối tắt (CT-4).
- Bỏ trích dẫn 'Clash of Clans 2026' vì không có nguồn kiểm chứng trong repo.

**Phụ thuộc:** Q1: Cổng Hội đồng do Q1 quyết, Q10 không dựng.; Q4: mốc theo Cấp, biển 🔒 và vị trí nút Xây dựng đều chờ Q4 cùng sim.; Q2: lấy Túi hạt giống mặc định thì phút đầu ít cần Sạp, ảnh hưởng thời điểm Sạp hiện.; Q7: ca tập vào quán phải đi qua Cửa quán thay cho nút ☕.; Q9: huy hiệu ! ở Nhà thợ không báo sự cố khi incidentExempt (cấp < INCIDENTS.minLevel).; Q6: huy hiệu giỏ thành phẩm và ⬆ trên máy cùng nằm trên một vật thể, phải tránh chồng huy hiệu.

**Luật đã chốt bị đổi:**

- docs/screens/03-farm/rules.md:144: ☕ Vào quán rời cụm phải; chip xu giữ nhưng mở Sạp tab Giống kèm lia camera
- docs/screens/03-farm/rules.md:145: luật HUD mở dần và menu dưới 6 nút (chốt 03/11) đổi thành công trình hiện dần, gỡ nút theo cổng CT-11
- docs/screens/03-farm/rules.md:219: lý do 'giữ menu 6 nút' khi gộp Quản lý vào Chỉ thị không còn đúng; giữ nguyên tab
- docs/screens/03-farm/gameplay.md:52: 'Nút Nâng cấp riêng' chuyển thành mục ≡ cộng nâng cấp trên vật thể; sửa chỗ lệch code về giếng
- docs/shared/onboarding-flow.md mục 3.3 và dòng 76: đổi từ nút HUD mở dần sang công trình hiện dần; chip xu mở tab Giống của Sạp
- docs/shared/design-system.md §5–6: số nút HUD, thêm component huy hiệu công trình

**Chờ sim:**

- Cấp mở từng công trình và biển 🔒 sau khi Q4 chốt trục Cấp: cần sim scripts/balance-sim.mjs
- Không có số kinh tế mới trong Q10. Giá nâng cấp và giá giống giữ nguyên. Thời gian lia camera và toạ độ là việc của playtest, không phải sim.

**Tài liệu phải sửa khi duyệt:**

| File | Sửa |
|---|---|
| `docs/design/audits/2026-11-05-review-luong-mobile-first.md` | Mục 9 câu 10: ghi quyết định cuối (4 công trình, không có Xưởng, cổng gỡ nút HUD, Cổng Hội đồng chuyển sang Q1). Mục 3: đánh dấu sơ đồ lệch toạ độ code (seed-shop [12,12], market [4,14], FARM_BOUNDS maxZ=4). |
| `docs/design/ideas/2026-11-05-mobile-first-don-gian-hoa.md` | Dòng Cập nhật ghi Q10 chờ sếp duyệt; bỏ trích dẫn 'Clash of Clans 2026' vì không có nguồn. |
| `docs/design/progress/2026-11-05-quang.md` | Thêm một dòng: chốt hướng Q10, chờ duyệt. |
| `docs/design/godbean-gdd.md` | CHỈ KHI SẾP DUYỆT: thêm dòng F-xx 'Công trình thay nút HUD', trạng thái Đã chốt, chưa code; ghi phụ thuộc Q1 và Q4. |
| `docs/screens/03-farm/rules.md` | CHỈ KHI CÓ F-xx: thay dòng 144-145 bằng CT-1..CT-15, kèm changelog nói rõ thay luật 03/11; sửa lý do ở dòng 219. |
| `docs/screens/03-farm/gameplay.md` | CHỈ KHI CÓ F-xx: dòng 52 (nâng cấp trên vật thể + mục ≡; giếng có khối nâng cấp như code); dòng 'sang cửa hàng' lia camera tới Sạp; thêm toạ độ công trình sau playtest. |
| `docs/screens/03-farm/README.md` | CHỈ KHI CÓ F-xx: thêm bảng công trình (id, modal, huy hiệu) và vị trí code (content.js STATIONS/HUD_UNLOCKS, game.js shortcut, decorations.js). |
| `docs/shared/onboarding-flow.md` | CHỈ KHI CÓ F-xx: mục 3.3 và dòng 76 đổi sang công trình hiện dần, cờ không ẩn lại, chip xu mở Sạp. |
| `docs/shared/design-system.md` | CHỈ KHI CÓ F-xx: §5–6 số nút HUD; component huy hiệu ✓ ! ⬆ và hiệu ứng dựng lên. |
| `docs/shared/contracts.md` | CHỈ KHI CÓ F-xx: thêm id cafe-entrance, order-board, crew-house; ghi trạm 3D `market` bị bỏ nhưng id hành động `market` giữ nguyên. |
| `docs/game-flow.md` | CHỈ KHI CÓ F-xx: vào quán qua Cửa quán thay cho nút ☕. |
| `docs/screens/04-cafe/README.md` | CHỈ KHI CÓ F-xx: vào từ Cửa quán, ra thì đứng trước Cửa quán. |

**Save / contracts:** Không cần migration và không thêm trường save. Trạng thái hiện công trình tính bằng `HUD_UNLOCKS.when` hoặc cờ `unlock-<id>` đã lưu qua farm.act('tutorial','seen'), nên công trình đã hiện thì không ẩn lại. `initialVisible` là hằng trong content.js, không được lưu (đã kiểm game.js:659-662). Giữ đủ id `unlock-*-used`: cafe-play, seed-shop, order-board, upgrades, workers, build, tools. Giữ id hành động `market` trong model, autoplay và setObjectStatus. Đồ trang trí cũ nằm trong vùng cấm xây của công trình mới thì tự dời về kho khi load, không xoá.

**Kiểm chứng khi playtest:** Chạy trên mobile preset 375×812 và desktop, mỗi phiên 3 người mới và 1 save cũ đã qua cấp 4. Cần kiểm: (a) từng công trình chạm trúng được ở portraitView mặc định, không xoay, không bị che (đây là cổng CT-11 để gỡ từng nút HUD); (b) người mới tự tìm ra Sạp và Bảng đơn, ghi thời gian từ lúc dựng lên tới lần chạm đầu; (c) lối tắt từ xa có lia camera và đóng modal thì camera về nhân vật, đo thời gian lia vừa ý; (d) Sạp không chớp tắt khi hết giống rồi mua giống; (e) chạm công trình mở modal giữa màn, có nút đóng, khoá di chuyển, còn khi Auto bật thì nhân vật vẫn làm phía sau; (f) Cửa quán: nhân vật đi tới rồi vào quán, ra thì đứng trước cửa; (g) huy hiệu ✓ ! ⬆ bật/tắt đúng; (h) người chơi tìm được nâng cấp qua ⬆ trên vật thể hoặc ≡, nếu không thì xét dựng Xưởng; (i) save cũ thấy đủ công trình, không toast, quest ship/sell đúng, đồ trang trí bị dời về kho chứ không mất; (j) vùng farm-only không có Cửa quán và Bảng đơn. Chưa có bằng chứng thì không ghi "Kiểm chứng" vào GDD.
