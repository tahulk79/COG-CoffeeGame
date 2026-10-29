> Chung cho mọi màn: [CHAPTER_PLAN](../CHAPTER_PLAN.md) (3 giai đoạn, cách làm asset 3D/UI) · [ART_BIBLE](../../design/ART_BIBLE.md) · [TASK_LIST](../../task-list/TASK_LIST.md)

## 2. Màn 2 · Đường Chuyển Sinh (chốt 2026-10-29, thay Vườn mây · prototype đã code, chờ chơi thử)

> **Chốt 2026-10-29:** Thay hẳn Vườn mây (3 viên đá giác quan) bằng con đường hỏi đáp. Giữ Thần Cà Phê và cách điều khiển (phím / joystick / chạm để đi, Lướt). Không có thua; điểm Phúc Đức ảnh hưởng nhẹ tới Màn 3. 5 trạm.

### 2.1 Mạch chơi (3–5 phút)

```
Ánh sáng trắng tan (nối từ vòng tròn ma thuật Màn 1)
 → Mở màn: Thần Cà Phê giải thích
 → Đường mây với 5 trạm gác, mỗi trạm 1 câu hỏi
 → Bà Gác Cửa: lời khuyên + "Bạn đã sẵn sàng chưa?"
 → Bước qua cửa → vòng quay "trùng sinh ở đâu" → Màn 3
```

- **Mở màn:** Thần Cà Phê bay ra: "Chưa chết đâu, mới ngất thôi. Muốn trùng sinh thì đi qua 5 trạm. Trả lời sai cũng không sao, nhưng Sổ Phúc Đức ghi hết đấy."
- **Mỗi trạm:** đi tới thì rào mây chặn, nhân vật đứng lại. Footer mở ra: NPC chào → bấm Tiếp → câu hỏi kèm 2–3 đáp án ngay trong footer → chọn → nhân vật nói câu đã chọn → NPC đáp (câu đùa) → Sổ Phúc Đức hiện "Lời nhắn", rào mây tan → bấm "Đi tiếp" thì đóng footer, đi tiếp.
- **Trước cửa:** Bà Gác Cửa nói lời khuyên theo điểm Phúc Đức (3 mức: cao / trung bình / thấp), rồi: "Bước qua cánh cửa này, bạn sẽ trùng sinh ở bất cứ đâu. Bạn đã sẵn sàng chưa?"
  - `Sẵn sàng` → cửa mở.
  - `Cho tôi nghĩ thêm` → bà đếm "3… 2… 1… hết giờ!" rồi đẩy vào luôn (gag).
- **Vòng quay trùng sinh:** con trỏ chạy qua "Con gà / Cây xương rồng / Tổng thống…" rồi dừng ở **"Chủ một quán cà phê nhỏ"** → Màn 3.

### 2.2 Năm trạm

Loại câu cố định theo trạm; câu hỏi rút ngẫu nhiên từ kho (4–6 câu mỗi trạm) để chơi lại không chán.

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
- **Phúc Đức** (−3 đến +6): câu đạo đức ±2, tri thức đúng +1, xàm 0 (bẫy trạm 4 có thể +1).
- **Sổ Phúc Đức:** mỗi Lời nhắn là 1 thẻ sưu tập; cuối màn tổng kết 5 thẻ, mở lại được từ HUD.
- **Ảnh hưởng Màn 3 (nhẹ):** Phúc Đức cao thì khởi đầu thêm vốn hoặc 1 món đồ; thấp thì Thần Cà Phê buông một câu trêu ở đầu Màn 3.

### 2.5 UI/UX

- Camera cuộn ngang như Màn 1 (chế độ `story`). Trời chuyển từ hồng sang vàng dần khi gần cửa.
- Tới trạm: khoá di chuyển, camera zoom nhẹ vào NPC.
- **Mọi câu thoại nằm ở footer** (sửa 2026-10-29 theo yêu cầu): bên trái là chân dung người đang nói (NPC bán thân, Thần Cà Phê, nhân vật chính, hoặc cuốn Sổ Phúc Đức), trên là tên, giữa là câu thoại. Bấm "Tiếp", chạm bất kỳ đâu, Enter hoặc Space để sang câu sau; câu cuối có nút "Đi tiếp ▸". Trong lúc footer mở, nhân vật đứng yên, màn hình mờ đi.
- Khi là câu hỏi: các đáp án là nút xếp dọc ngay dưới câu hỏi trong footer (phím 1/2/3), không có nút Tiếp, chạm ra ngoài không bỏ qua được. Nút cao 46px. Câu xàm có đồng hồ ⏱ 6 giây ở góc footer, hết giờ vẫn qua.
- Trên đầu người đang nói có dấu "…" nhấp nháy để biết ai đang nói ngoài thế giới.
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

| Mã | Asset | Ghi chú |
|---|---|---|
| C2-01 🧍 | Thần Cà Phê (bay lơ lửng, nói, chỉ đường, vui mừng) | Giữ từ Vườn mây |
| C2-02 🧍 | Ông Đồ IQ, Bà Thủ Thư Mây, Ông Cân Phúc Đức, Bà Gác Cửa | Prototype vẽ bằng code |
| E2-01 🏠 | Đường mây cuộn ngang, rào mây, cánh cửa trùng sinh | Thay `gardenArt.ts` |
| U2-01 🎛 | Bong bóng lựa chọn, 5 chấm tiến độ, đèn hoa sen, Sổ Phúc Đức, thẻ Lời nhắn, vòng quay trùng sinh | |
| A2-01 🔊 | Nhạc đường mây, SFX chuông / toẹt / cửa mở / vòng quay | Đang là Web Audio tổng hợp |
| ✨ | Rào mây tan, đèn sen sáng, thẻ bay vào sổ, ánh sáng cửa | |

