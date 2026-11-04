---
name: design-review
description: Soát spec thiết kế trong docs/design trước khi giao dev — đủ mục, làm được, khớp 4 trụ cột, contracts.md và AGENTS.md. Chế độ `all` soát chéo mọi tài liệu (luật đá nhau, chiến lược áp đảo, quá tải chú ý, lệch trụ cột). Chỉ báo cáo, không sửa. Dùng khi người dùng gõ /design-review <file|all|flow> (flow = soát cả hành trình từ chọn nhân vật tới quán).
---
Chỉ đọc và báo cáo. Không phán tài liệu nào "đúng" khi hai tài liệu mâu thuẫn: nêu mâu thuẫn và phương án, người dùng chốt. Mỗi phát hiện trích đúng file, mục và câu liên quan.

## Đọc trước
`AGENTS.md`, `.claude/agents/game-designer.md` (4 trụ cột + phương pháp), `docs/design/contracts.md`, `docs/farm-operations-guide.md` (luật đã chốt, "Nhật ký quyết định"), `docs/design/cafe-gameplay.md`. Code chỉ đọc khi cần đối chiếu hiện trạng (`src/features/farm/model.js`, `src/features/cafe/recipes.js`).

## Một file (`/design-review <đường dẫn>`)
**1. Đủ mục** (thiếu mục BẮT BUỘC thì không duyệt):
- BẮT BUỘC: tóm tắt; luật chi tiết; con số/công thức (nếu có luật dùng số) theo định dạng công thức của game-designer; trường hợp biên (thiếu tiền, kho đầy, reload, offline lâu); phụ thuộc/hợp đồng dữ liệu; checklist nghiệm thu; chia việc theo vùng file.
- NÊN CÓ: cảm giác người chơi muốn có; núm chỉnh và khoảng an toàn.

**2. Nhất quán nội bộ:** công thức ra số có khớp hành vi mô tả không; trường hợp biên có đá luật chính không; thử giá trị cực trị vào từng công thức (âm, chia 0, vô hạn).

**3. Làm được:** dev làm được mà không phải đoán không; chỗ nào nói chung chung; mỗi mục nghiệm thu có bước + số trước/sau đo được không ("cảm thấy cân bằng", "chạy đúng" là không đạt — đề xuất viết lại).

**4. Khớp hệ thống:**
- Trụ cột: phục vụ trụ cột nào; có hệ thống nào không phục vụ trụ cột nào.
- Luật `AGENTS.md` (modal shop/kho giữa màn, dải icon chọn giống, mua ruộng qua biển, khoá di chuyển khi mở modal…).
- Luật đã chốt trong `farm-operations-guide.md`: đổi luật mà không ghi Nhật ký quyết định → chặn.
- `contracts.md`: trường save mới có ghi ai ghi/ai đọc và bước chuyển save cũ chưa; giá trị trùng với tài liệu khác có khớp không.
- Hai màn phụ thuộc nhau: thay đổi có làm một màn tự đủ không (vd. quán không cần hạt farm).

**5. Kinh tế nhanh:** spec thêm nguồn vào hay nơi tiêu xu → có nói tiền đi đâu không; nếu đụng số lớn thì đề xuất chạy `/balance-check`.

## Cả bộ (`/design-review all`)
Đọc mọi `docs/design/*.md` và `docs/farm-operations-guide.md` rồi soát những thứ chỉ lộ ra khi xem chung:
- **Nhất quán chéo:** cùng một con số/luật ghi khác nhau; tài liệu cũ chưa cập nhật theo quyết định mới; hai tài liệu cùng nhận làm chủ một trường save hay một luật.
- **Vòng tiến trình cạnh tranh:** các đường lên cấp (XP farm, uy tín quán, ★ thành thạo, cấp thợ) có kéo người chơi ngược nhau hay một đường làm đường khác vô nghĩa.
- **Ngân sách chú ý:** đếm thứ phải theo dõi cùng lúc ở farm, ở quán; quá ~5–7 thứ chủ động → quá tải.
- **Chiến lược áp đảo và vòng kinh tế:** độc quyền nguồn lực, lời cao không rủi ro, lựa chọn hiển nhiên đúng; vòng tiền không nơi tiêu.
- **Đường khó:** độ khó/áp lực (hạn đơn, lương, khách chờ) có tăng đều theo tiến trình không.
- **Lệch trụ cột:** hệ thống nào đã trôi khỏi 4 trụ cột.
- **Kịch bản liên màn:** chọn 3–5 khoảnh khắc nhiều hệ thống cùng chạy (vd. nhận đơn quán → trồng → sơ chế → rang → giao → quán bán → nâng cấp). Mỗi kịch bản: kích hoạt, thứ tự, dữ liệu qua `contracts.md`, người chơi thấy gì, chỗ gãy (hai bên cùng ghi một state, vòng khuếch đại, reload/offline giữa chừng, ngõ cụt không thoát).

## Hành trình người chơi (`/design-review flow`)
Soát trọn đường đi của một người mới, theo đúng thứ tự màn: **Chọn nhân vật → Intro → Thiên đàng → Farm → Quán**. Màn nào chưa có tài liệu thì đọc code làm hiện trạng.
- Nguồn: `src/features/selection/`, `src/features/intro/` (`timeline.js`), `docs/heaven-gameplay.md` + `src/features/heaven/`, `docs/farm-operations-guide.md` + `src/features/farm/content.js` (QUESTS), `docs/design/cafe-gameplay.md`, `src/app/game.js` (chuyển màn, lưu tiến độ).
- Mỗi màn chấm theo 4 trụ cột và ghi: mục tiêu người chơi thấy là gì, mất bao lâu tới phần thưởng/tiến triển đầu tiên, có bỏ qua được không (intro dài), quyết định nào ảnh hưởng màn sau (quà thiên đàng → farm), chỗ có thể kẹt hoặc chờ trống.
- Nối màn: thông tin/phần thưởng màn trước có được dùng ở màn sau không; người chơi có hiểu vì sao chuyển màn; tải lại giữa chừng thì quay về đâu (`readProgress`).
- Lần đầu vào quán: quán được giới thiệu lúc nào, có mục tiêu rõ không, có hạt để pha không (phụ thuộc farm).
- Có thể đo bằng chơi thử nếu người dùng yêu cầu (playtester / Chrome DevTools, khung điện thoại); không thì chỉ đọc.
- Báo cáo thêm bảng **Hành trình**: màn · mục tiêu · thời gian tới phần thưởng đầu · điểm gãy · đề xuất.

## Báo cáo (tiếng Việt)
```
## Soát thiết kế: <file | toàn bộ>
### Đủ mục: X/N bắt buộc
### Phải sửa trước khi code   (CHẶN — mục · phát hiện · trích dẫn)
### Nên sửa                   (mục · phát hiện · đề xuất)
### Mâu thuẫn cần người dùng chốt (tài liệu A vs B · phương án)
### Kịch bản liên màn         (chỉ ở chế độ all)
### Cỡ việc: S / M / L / XL
### Kết luận: DUYỆT / CẦN SỬA / SỬA LỚN / CHƯA ĐÁNH GIÁ
```
- **DUYỆT** — không có mục CHẶN.
- **CẦN SỬA** — có mục CHẶN sửa trong phạm vi spec.
- **SỬA LỚN** — đá luật đã chốt, phá trụ cột, hoặc cần đổi hợp đồng dữ liệu.
- **CHƯA ĐÁNH GIÁ** — không có file/tài liệu để soát; nói thiếu gì.

## Sau báo cáo
Hỏi người dùng: giao `game-designer` sửa các mục CHẶN ngay, lưu báo cáo vào `docs/design/reviews/<tên>-<YYYY-MM-DD>.md`, hay dừng. Chạy dưới dạng subagent thì kết thúc bằng câu hỏi đó.
