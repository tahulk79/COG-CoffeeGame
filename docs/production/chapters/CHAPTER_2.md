> Chung cho mọi màn: [CHAPTER_PLAN](../CHAPTER_PLAN.md) (3 giai đoạn, cách làm asset 3D/UI) · [ART_BIBLE](../../design/ART_BIBLE.md) · [TASK_LIST](../../task-list/TASK_LIST.md)

## 2. Màn 2 · Đường Chuyển Sinh (chốt 2026-10-29, thay Vườn mây · prototype đã code, chờ chơi thử)

> **Chốt 2026-10-29:** Thay hẳn Vườn mây (3 viên đá giác quan) bằng con đường hỏi đáp. Giữ Thần Cà Phê và cách điều khiển (phím / joystick / chạm để đi, Lướt). Không có thua; điểm Phúc Đức ảnh hưởng nhẹ tới Màn 3. 5 trạm.

### Cập nhật bố cục theo ảnh mẫu (2026-10-30)

**UI mới nhất (T-122, theo ảnh bổ sung):** Giữ bảng Nhiệm vụ chính bên trái và khung hỏi đáp có tab tên nâu, chân dung, ba đáp án ở dưới. Chỉ bỏ avatar/cấp độ, điểm Phúc Đức, tiến độ và menu phụ; Cài đặt vẫn có. Countdown câu hỏi 20 giây là gợi ý nhịp đọc: hết giờ vẫn giữ câu hỏi/đáp án cho đến khi chọn, không tự chuyển qua câu khác. Xem ảnh/báo cáo cập nhật ở ISLAND_ACCEPTANCE.

Màn chơi hiện dùng đảo mây isometric liền cảnh thay hành lang chữ nhật. Mask 42×42 chỉ cho đi trong quảng trường, cầu và sân thư viện. PC rộng giữ camera toàn cảnh; điện thoại/màn dọc bám nhân vật. NPC và Bà Gác Cửa kích hoạt theo khoảng cách, giữ thứ tự năm trạm và điều kiện chuyển sinh. Đền phía trên là cửa kết thúc, cổng trái là cảnh trí. Xem [nghiệm thu web](../../art/chapter2/ISLAND_ACCEPTANCE.md) cho ảnh và kết quả kiểm tra. Mô tả rào chắn/tuyến thẳng ở các phần cũ chỉ còn là thiết kế trước ảnh mẫu.

### 2.1 Mạch chơi (3–5 phút)

```
Ánh sáng trắng tan (nối từ vòng tròn ma thuật Màn 1)
 → Thần Chết làm thủ tục: "Cậu chết vì gì?" (đáp án đúng = kiểu ngất ở Màn 1)
 → Twist: "Cậu chưa chết, mới NGẤT!" → Thần Cà Phê nhận ghi nhầm, giải thích luật
 → Đường mây với 5 trạm gác, mỗi trạm 1 câu hỏi
 → Bà Gác Cửa: lời khuyên + "Bạn đã sẵn sàng chưa?"
 → Bước qua cửa → vòng quay "trùng sinh ở đâu" → Màn 3
```

- **Mở màn (sửa 2026-10-29): Thần Chết hỏi "chết vì gì"** (câu troll, đúng hay sai chỉ để cười, không tính Phúc Đức):
  1. Thần Chết (áo choàng đen, cầm muôi phở mượn của bà Ba): "Chào mừng tới cõi bên kia. Ta là Thần Chết, hôm nay ta trực ban thủ tục." → "Cái muôi này hả? Lưỡi hái mang đi mài rồi…"
  2. "Theo quy định, cậu tự khai: cậu chết vì gì?" → 3 đáp án xáo trộn: **kiểu ngất thật ở Màn 1** + 2 câu nhiễu rút ngẫu nhiên (nhiều câu gọi lại Màn 1: "Gọi nước mắm ở quán bún đậu", "Ngồi trúng cái ghế đỏ gãy chân ở quán trà đá", "Bị bà Ba bán phở chửi"…).
  3. Đúng → chuông: "Khai đúng! Hồ sơ ghi: "Bị mèo quấn chân, ngã giữa phố". Ta đóng dấu đây." · Sai → bảng "SAI" rơi: "Khai sai! Hồ sơ ghi rõ: … Ta cũng thấy khó tin, nhưng hồ sơ không biết đùa."
  4. Twist: "Ơ khoan… hồ sơ ghi NGẤT, không phải CHẾT! Ai chuyển nhầm cậu lên đây thế này?!" → Thần Chết: "Mà thôi, dấu đóng rồi. Đóng dấu xong là như đổ ly cà phê: không hốt lại được. Quy trình là quy trình!" → Thần Cà Phê: "Dạ em! Em ghi nhầm ạ…" → giải thích vì sao vẫn phải trùng sinh (hồ sơ lỡ đóng dấu, bù lại được chọn kiếp mới) rồi luật 5 trạm và cách điều khiển. (Câu nối thêm 2026-10-30 để trả lời "không chết sao vẫn trùng sinh?"; xem [CHAPTER_PLAN](../CHAPTER_PLAN.md) mục Mạch cốt truyện.)
  5. Thần Chết chia tay bằng một câu riêng cho từng kiểu ngất (mèo: "Con mèo vẫn khoẻ, nó nhờ ta gửi lời xin lỗi. Đùa đấy, mèo không bao giờ xin lỗi."), rồi "Thôi, ta đi ăn phở đây."
  - Vào thẳng bằng `?chap=2` thì không có kiểu ngất thật: rút ngẫu nhiên một kiểu.
  - Sửa lời ở `reaper` trong `trials.json`: `causes.<kiểu ngất>` = `{cause (đáp án), record (hồ sơ), quip (câu chia tay)}`; `decoys` = câu nhiễu.
- **Mỗi trạm:** đi tới thì rào mây chặn, nhân vật đứng lại. Footer mở ra: NPC chào → bấm Tiếp → câu hỏi kèm 2–3 đáp án ngay trong footer → chọn → NPC đáp ngay (câu đùa; không nhắc lại đáp án đã chọn) → Sổ Phúc Đức hiện "Lời nhắn", rào mây tan → bấm "Đi tiếp" thì đóng footer, đi tiếp.
- **Trước cửa:** Bà Gác Cửa nói lời khuyên theo điểm Phúc Đức (3 mức: cao / trung bình / thấp), rồi: "Bước qua cánh cửa này, bạn sẽ trùng sinh ở bất cứ đâu. Bạn đã sẵn sàng chưa?"
  - `Sẵn sàng` → cửa mở.
  - `Cho tôi nghĩ thêm` → bà đếm "3… 2… 1… hết giờ!" rồi đẩy vào luôn (gag).
- **Vòng quay trùng sinh:** cửa mở, chờ 700 ms để nhìn thấy cửa trước khi hiện vòng quay; chạy qua "Con gà / Cây xương rồng / Tổng thống…" trong 3,8 giây rồi dừng ở **"Chủ một quán cà phê nhỏ"**. Giữ kết quả và tổng điểm/số lời nhắn 3,2 giây → Màn 3. Chặn di chuyển và tương tác cổng tới khi kết thúc; Cài đặt tạm dừng cả nhịp mở cửa/quay/giữ kết quả.
- **Thẻ Màn 3:** hiện Phúc Đức và số lời nhắn mang theo, có mục mở danh sách để đọc lại đủ thẻ theo thứ tự nhận; màn ngắn cuộn được. "Chơi lại chương 1" bỏ tham số vào thẳng chương, về Màn 1 cả khi trước đó dùng `?chap=2|3`. Chưa có gameplay/vốn/vật phẩm Màn 3.

- **Mở màn (cập nhật 2026-10-30):** lúc mở màn chỉ có Thần Chết, hero và Thần Cà Phê trên đảo. Sau câu chia tay Thần Chết biến mất bằng hiệu ứng 0,9 giây (bay lên, mờ dần, vòng mây và tia sáng vàng) rồi các trạm mới hiện ra. Ông Đồ IQ ở trạm 4 ("lại là ta") chỉ hiện khi tới lượt (xong trạm 3) để không có hai ông Đồ giống nhau cùng lúc.

### 2.1b Rà soát flow (2026-10-29)

| Tiêu chí | Đánh giá | Đã làm / đề xuất |
|---|---|---|
| **Liên kết Màn 1 → 2** | Trước: Màn 2 không nhắc gì tới cú ngất, như một game khác. | **Đã làm:** Thần Chết hỏi đúng kiểu ngất; câu nhiễu gọi lại các quán Màn 1; câu chia tay riêng cho từng kiểu. Câu đạo đức "thấy người ngất giữa phố" gọi lại ông quay TikTok. |
| **Bất ngờ / hài** | Trước: câu đầu tiên đã nói "chưa chết đâu", mất cú twist. | **Đã làm:** để Thần Chết tưởng là chết thật, làm thủ tục nghiêm túc, rồi mới lộ ra "mới ngất" và Thần Cà Phê nhận ghi nhầm. |
| **Xàm có kiểm soát** | Câu xàm (trạm 1 và Thần Chết) không tính điểm, chọn gì cũng qua: người chơi được cười mà không bị phạt. Trạm 4 là bẫy nên có tính điểm (−1/0/+1); riêng câu `q_honest` cố ý chỉ có 2 đáp án (Có/Không). | Giữ. Mỗi câu xàm vẫn có một "Lời nhắn" thật để không vô nghĩa. |
| **Thông điệp** | Trạm 3 (đạo đức) và 5 (lời khuyên) mang thông điệp chính, ±Phúc Đức, có Sổ Phúc Đức xem lại. | **Đã làm:** trạm 3 luôn ra câu "thấy người ngất giữa phố" khi người chơi vừa ngất ở Màn 1 (`afterFaint: "q_faint"` trong `trials.json`); vào thẳng bằng `?chap=2` thì vẫn rút ngẫu nhiên 1/4. |
| **Chuyên nghiệp** | Không có thua; thoại bấm Tiếp, nhân vật đứng yên; đáp án full width, phím 1/2/3, nút ≥ 44px; giảm chuyển động; toàn bộ chữ ở 1 file dữ liệu. | **Đề xuất:** tách chữ ra `vi.json`/`en.json` khi chốt nội dung. |
| **Liên kết Màn 2 → 3** | Phúc Đức + lời nhắn lưu ở `counters` (`trial:*`), vòng quay luôn ra "Chủ một quán cà phê nhỏ". | **Đề xuất cho Màn 3:** vốn khởi đầu theo Phúc Đức; khi gặp tình huống trùng (khách chê, thất bại lần đầu…), Thần Cà Phê nhắc lại đúng Lời nhắn đã nhận ở Màn 2. |

### 2.1c Bảng liên kết giữa các màn

| Từ | Mang theo | Dùng ở | Lưu ở đâu |
|---|---|---|---|
| Màn 1 | Kiểu ngất (12 gag + thanh chắn) | Màn 2: đáp án đúng + hồ sơ + câu chia tay của Thần Chết; trạm 3 hỏi câu "người ngất giữa phố" | `story.scenario` (giữ khi sang S04) |
| Màn 1 | Bối cảnh quán (nước mắm, ghế đỏ, bà Ba, trà đá), đám đông quay TikTok | Màn 2: câu nhiễu của Thần Chết, câu đạo đức trạm 3, muôi phở của Thần Chết | Viết cố định trong `trials.json` |
| Màn 2 | Điểm Phúc Đức | Màn 3: vốn / món đồ khởi đầu (đề xuất); thẻ "Sắp ra mắt" đã hiện số điểm | `counters['trial:karma']` |
| Màn 2 | Các Lời nhắn đã nhận | Màn 3: Thần Cà Phê nhắc lại khi gặp tình huống trùng (đề xuất) | `counters['trial:lesson:<id>']` |
| Màn 2 | Kết quả vòng quay "Chủ một quán cà phê nhỏ" | Màn 3 mở bằng chính quán đó | Cố định |

### 2.2 Năm trạm

Loại câu cố định theo trạm; câu hỏi rút ngẫu nhiên từ kho (hiện 4 câu mỗi trạm, tổng 20 câu). Mỗi lượt rút một câu/trạm và giữ nguyên trong lượt; chơi lại có thể trùng câu vì vẫn rút ngẫu nhiên.

| Trạm | NPC | Loại câu | Mục đích |
|---|---|---|---|
| 1 | Ông Đồ IQ (cầm bảng đen) | Xàm | Cười, mất cảnh giác |
| 2 | Bà Thủ Thư Mây | Tri thức thật | Học một điều có thật |
| 3 | Ông Cân Phúc Đức (cầm cái cân) | Tình huống đạo đức | Thông điệp chính |
| 4 | Ông Đồ IQ quay lại | Xàm có bẫy đạo đức | Bất ngờ |
| 5 | Thần Cà Phê | Lời khuyên sống | Chuẩn bị cho Màn 3 |

### 2.3 Câu hỏi mẫu (nháp, sẽ chuyển vào `trials.json`)

- **Xàm:** "1 + 1 = mấy?" → `2` / `11` / `Cửa sổ`. Chọn gì cũng qua. `2` → Ông Đồ: "Đúng, nhưng thiếu sáng tạo." · `Cửa sổ` → "Ta thích cậu."
- **Xàm:** "Cái gì càng lau càng ướt?" → `Cái khăn`.
- **Tri thức:** "Cà phê vào Việt Nam khoảng thời gian nào?" → `Thế kỷ 19`. Lời nhắn: "Ly cà phê nào cũng có câu chuyện dài phía sau."
- **Đạo đức (gắn Màn 1):** "Thấy người ngất giữa phố, bạn sẽ…" → `Gọi 115` / `Quay TikTok đã` / `Đứng xem`. Chọn TikTok thì hiện lại ông quay TikTok ở Màn 1, cái cân nghiêng hẳn. Lời nhắn: "Một cuộc gọi đáng giá hơn một nghìn lượt xem."
- **Đạo đức:** "Nhặt được ví có 5 triệu?" → `Trả lại` / `Giữ 4 triệu, trả 1` / `Mua trà sữa`.
- **Bẫy trạm 4:** "Câu này dễ: bạn có thật sự trả lời trung thực mấy câu nãy không?" → `Có` / `Không`. Chọn `Không` thì được thưởng: "Thật thà là câu đúng duy nhất hôm nay."
- **Lời khuyên:** "Làm gì cũng cần…" → `Kiên nhẫn` / `Vốn` / `Wifi mạnh`. Chọn gì cũng đúng một nửa. Lời nhắn: "Pha cà phê hay sống đời đều cần chờ từng giọt."

### 2.4 Logic

- **Không có thua.** Sai thì gag (bảng "SAI" rơi trúng đầu), cộng/trừ Phúc Đức, vẫn qua trạm.
- **Phúc Đức** (−4 đến +5, khởi đầu 0): thủ tục Thần Chết và trạm 1 không tính điểm; trạm 2 là 0/+1; trạm 3 là −2/−1/+2; trạm 4 là −1/0/+1; trạm 5 là −1/0/+1. Hết giờ ở trạm 1/4: 0 điểm. Mức cao ≥4, trung bình 1–3, thấp ≤0; cùng dùng ngưỡng trong `trials.json` cho Sổ và Bà Gác Cửa. HUD hiện số điểm bên đèn sen.
- **Ghi nhận:** điểm, thẻ lời nhắn và cờ hoàn thành trạm được ghi cùng lúc khi hiện Lời nhắn, trước sự kiện lưu tiến độ. Một trạm chỉ ghi một lần; Sổ giữ thứ tự nhận thẻ.
- **Sổ Phúc Đức:** mỗi Lời nhắn là 1 thẻ sưu tập; cuối màn tổng kết 5 thẻ, mở lại được từ HUD. Sổ là modal dùng chung với hệ thống Cài đặt: hiện điểm/mức Phúc Đức, mỗi trang một thẻ với nút Trước/Sau, đóng bằng ✕/chạm nền/Esc. Khi mở và trong hoạt ảnh đóng, tạm dừng di chuyển, thoại, câu hỏi và âm thanh gameplay; không cho input xuyên xuống thế giới. Chơi lại đường mới xoá điểm/thẻ cũ, còn chuyển sang Màn 3 giữ chúng.
- **Ảnh hưởng Màn 3 (nhẹ):** Phúc Đức cao thì khởi đầu thêm vốn hoặc 1 món đồ; thấp thì Thần Cà Phê buông một câu trêu ở đầu Màn 3.

### 2.5 UI/UX

- Camera cuộn ngang như Màn 1 (chế độ `story`). Trời chuyển từ hồng sang vàng dần khi gần cửa.
- Tới trạm: khoá di chuyển, camera zoom nhẹ vào NPC.
- **Mọi câu thoại nằm ở footer** (component chung `DialogueFooter`, ảnh khung bo tròn `karma-panel-v2` cắt 9 mảnh, trượt từ mép dưới lên khi mở). Bố cục chung cho mọi cỡ màn: avatar tròn viền vàng đè góc trên trái, bảng tên nằm trên mép trên (tâm bảng trên đường viền), câu thoại căn giữa ngay dưới bảng tên, rồi đáp án. Điện thoại dọc: đáp án xếp dọc, rộng tối đa 300px, căn giữa. PC và màn ngang: ba đáp án một hàng bằng nhau, mỗi thẻ tối đa 300px. Mỗi đáp án có số trong chấm cam bên trái và mũi tên bên phải. Khung cao tối thiểu 134px (nhỏ hơn thì góc bo bị bóp nhọn) và chừa đáy ≥ 44px (50px ở màn ngang thấp). Avatar hero là đầu nhân vật Màn 1 (`hero-avatar-v1`), không phải hình vẽ tạm.
- **Luật bấm:** thoại thường (không có đáp án): bấm Tiếp, Enter hoặc chạm bất kỳ đâu (kể cả ngoài thế giới và nền khung) để sang câu sau; câu cuối có nút "Đi tiếp ▸". Câu có đáp án: bắt buộc chọn bằng thẻ hoặc phím 1/2/3; bấm ra ngoài hoặc Enter không bỏ qua mà làm các thẻ đáp án nháy 3 lần để nhắc. Đồng hồ 20 giây chỉ là gợi ý nhịp đọc: hết giờ hiện "Cứ từ từ", giữ nguyên câu hỏi, không tự chọn.
- Trên đầu người đang nói có dấu "…" nhấp nháy để biết ai đang nói ngoài thế giới. Dấu nằm trên đầu theo chiều cao từng nhân vật. Nhãn tên NPC là viên thuốc nâu viền vàng cùng tông bảng tên; dấu "!" (trạm kế tiếp) và "✓" (đã xong) là huy hiệu riêng trên đầu.
- HUD: 5 chấm tiến độ trạm (trên cùng) · đèn hoa sen Phúc Đức (góc trái, sáng/tối theo điểm) · nút mở Sổ Phúc Đức.
- Phản hồi: đúng → chuông, đèn sen sáng, rào mây tan · sai → tiếng "toẹt", bảng rơi, cái cân rung · thẻ Lời nhắn bay vào sổ.

### 2.6 Kỹ thuật

> Đã code 2026-10-29 (T-109). Sửa câu hỏi, lời đáp, lời khuyên, vòng quay ở **`src/data/config/trials.json`**, không cần đụng code.

- `src/gameplay/story/TrialService.ts` (thay `GardenService`, đã xoá): mô phỏng thuần, gồm trạm, tường mây, Phúc Đức, rút 1 câu/trạm bằng `Rng`, Bà Gác Cửa, vòng quay.
- `src/data/config/trials.json`: `intro`, `timeoutLine`, `karma {min,max,high,mid}`, `stations[] {id,name,npc,type,x,y,timerMs?,questions[] {id,prompt,options[] {text,karma,reply,mood?},lesson}}`, `gate`, `spin`. `mood` = `right|wrong|funny` (chuông / bảng "SAI" / boing), bỏ trống thì theo dấu của `karma`. Chữ đang để thẳng trong JSON như `story.json`, chưa tách `vi.json`/`en.json`.
- `src/data/maps/afterlife.json`: đường mây 46×9 ô, trạm ở x = 8 / 15 / 22 / 29 / 36, Bà Gác Cửa x = 41, cửa (`portal`) x = 43.
- Lưu: flag `station:<id>` trong `story.flags`; Phúc Đức ở `counters['trial:karma']`, lời nhắn ở `counters['trial:lesson:<id>']`. Mỗi lần vào đường mới thì xoá `trial:*` cũ. Màn 3 đọc `trial:karma`.
- Chương: S03 (Màn 1) → S04 `afterlife` (Màn 2, mở bằng ánh sáng) → S05 `cafe` (Màn 3, hiện là thẻ "Sắp ra mắt" kèm số Phúc Đức).
- Vẽ: `trialArt.ts` (NPC, tường mây, Thần Cà Phê, dấu "…", bảng "SAI"; `drawKeeper`/`drawSpirit` dùng chung cho chân dung footer). Âm: `TrialAudio.ts`. HUD: `StoryHud.ts` (footer thoại + đáp án, 5 chấm + đèn sen, nút Sổ Phúc Đức, thẻ vòng quay).
- Mỗi trạm có thêm `greet` (câu chào trước câu hỏi) trong `trials.json`.

### 2.7 Asset Màn 2

> Prompt tạo ảnh cho từng asset (dán vào ChatGPT): [docs/art/chapter2/PROMPTS.md](../../art/chapter2/PROMPTS.md).

| Mã | Asset | Ghi chú |
|---|---|---|
| C2-01 🧍 | Ông Đồ IQ, Bà Thủ Thư Mây, Ông Cân Phúc Đức, Bà Gác Cửa | Đã nối 4 trạng thái/người; Ông Đồ dùng cùng sheet ở hai trạm nhưng sprite riêng |
| C2-02 🧍 | Thần Chết, Thần Cà Phê | Đã nối idle/nói/đóng dấu hoặc vui/sốc hoặc xin lỗi |
| C2-03 🧍 | Chân dung footer | Đủ NPC và Sổ; tái dùng portrait Ông Đồ và hero, có fallback code |
| E2-01 🏠 | Đường mây | Vật liệu chiếu 2:1, nền bake 6 mảng theo map hiện tại, có mép mây |
| E2-02 🏠 | Rào mây | Solid/wisps cho đủ 5 trạm, dùng lại mẫu đã có |
| E2-03 🏠 | Cửa trùng sinh | Sprite đóng/mở, giữ nhịp kết màn |
| E2-04 🏠 | Props hai bên đường | Cây/cột theo map; thêm đèn, bảng trống, chuông, ghế ở ngoài vùng đi |
| E2-05 🏠 | Trời | Ảnh hồng/vàng, crop theo vị trí hero, phủ viewport giữ tỷ lệ |
| U2-01 🎛 | Bong bóng lựa chọn, 5 chấm tiến độ, đèn hoa sen, Sổ Phúc Đức, thẻ Lời nhắn, vòng quay trùng sinh | |
| A2-01 🔊 | Nhạc đường mây, SFX chuông / toẹt / cửa mở / vòng quay | Đang là Web Audio tổng hợp |
| ✨ | Rào mây tan, đèn sen sáng, thẻ bay vào sổ, ánh sáng cửa | |

Luồng 5: [SAMPLE_PASS_01](../../art/chapter2/SAMPLE_PASS_01.md). PNG mẫu ở `art-src/slice/chapter2/`, WebP ở `public/assets/slice/chapter2/`; registry `CHAPTER2_SLICE_ASSETS` giữ đủ ô/pivot, dùng pipeline nạp hiện có. Đây là hồ sơ đợt mẫu; trạng thái nhân rộng hiện tại xem luồng 6 bên dưới. Chưa nghiệm thu trong game.

Luồng 6 đã nhân rộng nhân vật: [CHARACTER_PASS_02](../../art/chapter2/CHARACTER_PASS_02.md), bổ sung ba sheet cho đủ 6 NPC × 4 trạng thái và 8 chân dung (kể cả hero/Sổ). `expression` tạm trên dòng thoại chỉ điều khiển hướng diễn (sốc/xin lỗi/vui), không đổi luật điểm hoặc save. Ảnh/pivot được đọc và xem tĩnh, chưa mở game/test/typecheck/build; còn chờ tự test/duyệt. Môi trường của đợt này chưa đổi; trạng thái hiện tại xem luồng 7 bên dưới.

Luồng 7: [ENVIRONMENT_PASS_03](../../art/chapter2/ENVIRONMENT_PASS_03.md), môi trường đã có raster thay hình tạm, giữ map/va chạm. Registry Màn 2 nạp khi map đích là afterlife; cache nguồn để chơi lại, xoá canvas nền tạm khi rời scene. Có làm mờ cây/cột/cửa khi che hero, fallback nếu ảnh lỗi. Chỉ rà code/xem ảnh tĩnh, chưa kiểm đường nối/camera/độ mượt trong game hoặc đo tải/FPS/RAM. Chờ tự test trước luồng 8.

