> Chung cho mọi màn: [CHAPTER_PLAN](../CHAPTER_PLAN.md) (3 giai đoạn, cách làm asset 3D/UI) · [ART_BIBLE](../../design/ART_BIBLE.md) · [TASK_LIST](../../task-list/TASK_LIST.md)

## 3. Màn 3 · Quán cà phê trùng sinh (chưa làm)

> **Chốt 2026-10-30:** Màn 3 là **bài học pha chế** và vận hành quán với **công thức do chủ sản phẩm đưa** và **nguyên liệu có hạn**; hết hạt, kiếm đủ tiền thì mới nghĩ tới nông trại (Màn 4) rồi bản đồ Việt Nam. Toàn bộ ý tưởng, vòng lặp, lộ trình slice và câu hỏi cần chốt nằm ở [CAFE_FARM_MAP_LOOP.md](../../design/CAFE_FARM_MAP_LOOP.md).
- Màn bắt đầu xây dựng trò chơi chính. Mở bằng kết quả vòng quay "Chủ một quán cà phê nhỏ", đọc Phúc Đức từ Màn 2 để chỉnh khởi đầu.
- Ý tưởng cũ còn dùng được: tiểu cảnh dạy pha espresso có hài (bậc thầy troll học trò), dùng chung bong bóng thoại của Màn 1.


### 3.1 Ý tưởng để dành: làm đổ cà phê của Thần Chết, pha lại ly ngon (ghi 2026-10-30, chưa làm)

> Hoãn: ưu tiên hoàn thiện Màn 1–2 để đóng gói phần mở đầu truyện. Phân tích đầy đủ dưới đây để làm sau.

**Ý tưởng:** làm đổ cà phê của Thần Chết. Thần Chết phạt, bắt pha lại một ly cà phê ngon thì mới cho sống.

**Chỗ đặt (chốt 2026-10-30, thay đề xuất đặt ở Màn 2):** câu chuyện nằm ở **đầu Màn 3**, không phải Màn 2. Xong Màn 2 (vòng quay "Chủ một quán cà phê nhỏ"), người chơi vào Màn 3 thì **tự dưng gặp lại Thần Chết** (ông đã nói "ta đi ăn phở đây" ở Màn 2, nên là một cú bất ngờ). Từ đó mới tới truyện: cốc cà phê của Thần Chết bị làm đổ (gag) → ông phạt "pha lại ly ngon mới cho sống" → pha (tiểu cảnh dạy pha espresso, xem phần trên) → ông nếm và nhận xét → vào gameplay quán. Cách này khớp lời hứa của vòng quay (làm chủ quán cà phê), giữ Màn 2 gọn, và biến Thần Chết thành nhân vật xuyên suốt (Màn 2 hồ sơ nhầm, Màn 3 cà phê bị đổ).

> Hệ quả: Màn 2 giữ nguyên, không thêm đoạn nào. Cần nghĩ cách ông xuất hiện ở Màn 3 hợp lý (ví dụ ông ghé quán lúc quán mở cửa; cốc cà phê của ông là khách hàng đầu tiên), và cho lời chia tay ở Màn 2 một câu hồi đáp ("Mai ta ghé quán cậu.") nếu muốn gài trước.

**Ba mức làm:**
1. *Thoại + lựa chọn (rẻ nhất, khoảng nửa ngày):* dùng hệ thống `Line`/`choices` sẵn có của `TrialService` (thêm trong `reaperTalk`/`chooseReaper`); pha lại = 3 câu chọn, mỗi câu là một bước (xay thô/mịn, nước sôi hay ~92°C, thêm đường hay không); đáp án đúng kèm kiến thức thật (lồng câu nước 90–96°C ở trạm 2); Thần Chết nếm và phản ứng theo số bước đúng (0–3) bằng pose sẵn có; hiệu ứng đổ vẽ bằng code; không cần asset mới.
2. *Thao tác kéo/bấm đơn giản (khoảng 2–3 ngày):* thanh canh thời điểm hoặc kéo nguyên liệu vào cốc; cần màn nhỏ trong `StoryHud`, nút lớn cho mobile, chặn input thế giới khi pha, và icon cốc/phin/nước mới.
3. *Mini-game có animation:* nên để thành cơ chế chính của quán ở Màn 3.

Đề xuất: mức 1 làm cho đoạn mở đầu Màn 3, mức 2–3 phát triển thành cơ chế chính của quán.

**Việc cần quyết định trước:**
- "Mới cho sống" xử lý thế nào: pha dở thì pha lại tới khi đúng (không bao giờ kẹt, vẫn "không có thua"; khuyên chọn cách này) hay trừ Phúc Đức/đổi lời khuyên Bà Gác Cửa.
- Có dùng Phúc Đức mang từ Màn 2 để chỉnh độ khó/lời phạt của Thần Chết hay không (ví dụ điểm cao thì ông dễ tính hơn).
- Thời lượng đoạn mở Màn 3: khoảng 40–60 giây cho mức 1.
- Ai làm đổ: hero vấp (hợp chủ đề ngất vì vấp ở Màn 1) hay Thần Cà Phê vướng cánh (hợp gag ghi nhầm, ít đặt trách nhiệm lên người chơi).

**Nếu làm mức 1, các chỗ sửa:** `src/data/config/trials.json` (khối `spill` trong `reaper`: thoại, 3 bước pha, câu nếm theo kết quả); `src/gameplay/story/TrialService.ts` (khi Màn 3 có service riêng thì đặt ở đó; tận dụng cách dựng `Line`/`choices` và trạng thái "đang pha" như `asking`); `src/components/render/trialArt.ts` (hiệu ứng đổ và bốc hơi); `CHAPTER_2.md` chỉ thêm một câu chia tay gài trước nếu muốn (không đổi luồng Màn 2).
