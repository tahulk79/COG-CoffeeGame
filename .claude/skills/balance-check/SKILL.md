---
name: balance-check
description: Soát cân bằng kinh tế và tiến trình farm↔cafe bằng số liệu thật trong code — nguồn vào/nơi tiêu xu, dự phóng ngày 1/7/30, vòng lặp tiền vô hạn, lựa chọn áp đảo, khoảng chết. Chỉ báo cáo, không sửa. Dùng khi người dùng gõ /balance-check [farm|cafe|tiến trình|<file>] hoặc hỏi "game có cân bằng không".
---
Chỉ đọc và báo cáo. Không sửa code hay tài liệu, không chạy game.

## 0. Thiếu dữ liệu thì nói thiếu
Liệt kê từng nguồn cần đọc, ghi `CÓ` / `KHÔNG`. Mục nào thiếu dữ liệu ghi **CHƯA ĐÁNH GIÁ — THIẾU DỮ LIỆU**, nói thiếu gì; không ước đoán, không suy từ file bên cạnh. Không tìm thấy vấn đề vì không có gì để soát không phải là "đạt".

## 1. Phạm vi
Theo tham số: `farm`, `cafe`, `tiến trình`, đường dẫn file, hoặc trống = cả vòng farm↔cafe.

## 2. Đọc số liệu
- Farm: `src/features/farm/content.js` (CROPS, giá, thời gian), `rules.js`, `model.js` (đơn quán `makeOrder`, nhiệm vụ, lương/hợp đồng thợ, nâng cấp `upgradePrice`, bán hàng, cước giao, nhập hạt dự phòng), `decorations.js`.
- Cafe: `src/features/cafe/recipes.js` (công thức, giá bán, SUPPLIES, GEAR, STAFF), phần `sell` trong `model.js` (giá × chất lượng, tip, uy tín), `service.js` (tần suất khách).
- Mục tiêu thiết kế: `docs/farm-operations-guide.md`, `docs/design/cafe-gameplay.md`, `docs/design/contracts.md`, `docs/design/*.md`. Thời gian: `DAY_MS`.
Ghi lại mọi file đã đọc.

## 2b. Đo bằng mô phỏng (ưu tiên hơn tính tay)
Chạy `node scripts/balance-sim.mjs 60` và `120` (thêm `NOFERT=1` để so lựa chọn bón phân, `EVENTS=1` để in mốc mở khóa). Script gọi thẳng `model.js` nên số liệu là của luật thật; ghi lại giả định người chơi mẫu trong script (nhịp farm/quán, tốc độ pha 12 s/ly) và chỉnh nó khi luật đổi. So sánh hai phương án bằng tổng "giá trị" = tiền ròng + tiền đã đầu tư nâng cấp/thiết bị.

## 3. Phân tích
**So với mục tiêu:** mỗi giá trị so với khoảng tài liệu ghi. Lệch → dòng "Ngoại lệ". Tài liệu không ghi khoảng → "chưa có khoảng — không phán xét", không coi là ngoại lệ.

**Kinh tế:**
- Bảng mọi nguồn vào (bán farm, đơn quán, bán ly, tip, nhiệm vụ, quà) và nơi tiêu (giống, phân, lương, hợp đồng, vật tư quán, cước, nâng cấp, thiết bị, trang trí, tuyển/đào tạo) với tốc độ xu/ngày game cho một người chơi điển hình. Nêu giả định (số luống, khách/ngày, chất lượng trung bình).
- Dự phóng số dư ngày 1, 7, 30; thời gian (ngày game) để mua được từng mốc nâng cấp/thiết bị lớn.
- Nơi tiêu có theo kịp nguồn vào không; nơi tiêu nào cạn (đạt cấp tối đa, mua một lần) và sau đó tiền dư đi đâu.
- Vòng lặp tiền vô hạn: mua rẻ bán đắt không giới hạn (vd. nhập hạt dự phòng 50 xu/500 g rồi bán ly lời hơn mà không cần farm — phá trụ cột "hai màn phụ thuộc nhau").
- Món/cây không bao giờ đáng mua hay trồng.

**Lựa chọn áp đảo:** lời/phút từng cây và từng món (sau chi phí vật tư, thời gian, thiết bị); lựa chọn tốt hơn tất cả ở mọi mặt; lời cao mà không rủi ro.

**Tiến trình:** đường cong XP/cấp/uy tín và thứ mở theo mốc; khoảng chết (> 2 ngày game không có gì mới), cú nhảy sức mạnh, đường cày tắt làm vỡ nhịp.

**Biên:** thử đầu vào cực trị (0 xu, kho đầy, uy tín 10 và 100, offline lâu, thợ cấp 10) — có ra số âm, chia 0, kẹt không thoát được không.

## 4. Báo cáo (tiếng Việt)
```
## Soát cân bằng: <phạm vi>
### Nguồn dữ liệu
### Kết luận: CHƯA ĐÁNH GIÁ / ỔN / CẦN CHỈNH / NGHIÊM TRỌNG
### Dòng tiền (bảng nguồn vào / nơi tiêu, xu/ngày) và dự phóng ngày 1/7/30
### Ngoại lệ (giá trị · khoảng mong đợi · thực tế · vấn đề)
### Chiến lược áp đảo / vòng lặp vô hạn
### Tiến trình
### Đề xuất (ưu tiên · vấn đề · cách sửa · hằng số + file:dòng · tác động)
```
Kết luận theo phát hiện nặng nhất:
- **NGHIÊM TRỌNG** — có lựa chọn áp đảo mọi lựa chọn khác, tiến trình kẹt/không hoàn thành được, hoặc vòng tiền không có nơi tiêu.
- **CẦN CHỈNH** — ngoại lệ hoặc đường cong chỉnh số là xong.
- **CHƯA ĐÁNH GIÁ** — thiếu dữ liệu hoặc thiếu khoảng mục tiêu; nói rõ thiếu gì.
- **ỔN** — mọi giá trị đã so với mục tiêu, không ngoại lệ, không áp đảo.

## 5. Sau báo cáo
Hỏi người dùng: sửa vấn đề ưu tiên cao nhất (giao `game-designer` cập nhật spec/khoảng mục tiêu rồi dev chỉnh hằng số), lưu báo cáo vào `docs/design/balance-<phạm-vi>-<YYYY-MM-DD>.md`, hay dừng. Chạy dưới dạng subagent thì kết thúc bằng câu hỏi đó, người gọi sẽ hỏi lại người dùng.
