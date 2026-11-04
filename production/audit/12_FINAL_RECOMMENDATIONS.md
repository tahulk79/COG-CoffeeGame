# 12 — Tổng hợp & kế hoạch sửa (chờ duyệt)

Nhánh `audit/game-studio-playtest-optimization`, gốc `d8fdf77`. Vòng 1 chỉ đo và phân tích, chưa sửa `src/`. Chi tiết và bằng chứng nằm ở các file 01–11.
Mọi playtest đều do AI agent chạy, không phải người thật. Số hiệu năng đo trên Chrome Mac giả lập viewport và CPU 4×, không phải thiết bị di động thật.

## Trạng thái
- **ĐÃ KIỂM, ĐẠT:** `node --test tests/*.test.js` 33/33. Rò rỉ sau 10 vòng farm↔quán: +0.27–0.68 MB, số object Three không đổi. Chọn nhân vật, thiên đàng, farm, quán đều giữ ~60 fps ở mobile 4×.
- **Không có P0.** Mọi lỗi P1 sau phản biện độc lập đều hạ xuống P2 (ECO-1, ECO-2, PRG-1, PERF-1). Riêng PRG-2 bị bác.
- **CHƯA ĐÁNH GIÁ / BỊ CHẶN:**
  - Thiết bị thật và safe-area.
  - Chơi liền 20 phút với tốc độ khung hình thật: pane bị ẩn, còn chrome-devtools MCP bị khóa profile.
  - Farm đầy 48 cây.
  - ROI thợ và robot.
  - Hai tab thật.

## Đợt sửa đề xuất (rủi ro thấp, không đổi luật chơi)
| # | Lỗi | Sửa | File chính |
|---|---|---|---|
| 1 | PERF-1 Intro 37.7 fps, khung dài 966 ms | Chỉ tính bounding box skinned khi thật sự cần, không chạy mỗi khung | `src/features/intro/scene.js` |
| 2 | PERF-2 Lần đầu vào quán biên dịch shader đồng bộ 565 ms | `compileAsync` trước khi hiện quán, giống các cảnh khác | `src/features/farm/game.js` |
| 3 | EX-1 Save có phần tử null → kẹt vĩnh viễn ở màn lỗi | Lọc null khi tải, thêm nút "Chơi lại từ đầu" ở màn lỗi | `src/features/farm/model.js`, `src/app/game.js` |
| 4 | ISS-01 Quality bị hạ tự động lại lưu vĩnh viễn | `lowerQuality` không ghi vào settings đã lưu | `src/ui/settings.js` |
| 5 | UX-2/S-6 Shop thiếu xu hiện "0 xu", không nói lý do | Báo số xu còn thiếu (đúng luật AGENTS.md) | `src/features/farm/ui.js` |
| 6 | UX-1 Vùng bấm < 44px | Tăng vùng bấm, giữ nguyên kích thước hiển thị | CSS dải giống, hộp xác nhận, nút trạm |
| 7 | S-4 nút "Bán ngay" ở hộp nâng cấp; UX-11 HUD xu "381,37"; A-1 thông báo cây gây nhầm | Sửa nhãn, làm tròn số hiển thị, tách dòng thông báo | farm UI |
| 8 | R3 `skeleton.update()` gọi trùng; M1 ImageBitmap không `close()` | Bỏ lời gọi trùng, đóng bitmap khi dispose | `src/shared/three/*`, `src/characters/*` |

Mỗi mục sửa xong sẽ đo lại cùng điều kiện, kết quả ghi vào `07_PERFORMANCE_AFTER.md` và `11_REGRESSION_RESULTS.md`.

## CẦN NGƯỜI QUYẾT ĐỊNH THIẾT KẾ
- **ECO-1:** Đơn cố định ở Chợ lặp vô hạn với giá 1,2×. Đề xuất mỗi ngày công 1 đơn, hoặc tính đơn vào mức bão hoà chợ.
- **ECO-2:** Cuối game không có chỗ tiêu tiền. Ngày 30 còn ~98k xu nằm yên, nâng cấp công trình ROI ≈ 0. Hướng xử lý: cắt trần cấp hoặc gắn tác dụng thật cho nâng cấp, thêm nơi tiêu lặp lại.
- **PRG-1:** Thêm bàn làm uy tín người chơi solo tụt, kéo theo khoá lại món đã mở.
- **ECO-3 / ECO-4:** Quán không cần farm vẫn lời; Mít trội hơn Chè ở mọi mặt; phân bón thành việc bắt buộc.
- **PRG-3 / TESTB-1:**
  - 10 phút đầu farm chỉ kiếm ~3,1 xu/phút.
  - Người chơi casual có khoảng chết từ ngày 2 tới ngày 7.
- **S-2 / ISS-02:**
  - Offline mất phần thời gian thừa sau khi cây đã chín.
  - Tóm tắt offline có tính nhưng không hiện.
- **A-3:** Ca quán chạy theo đồng hồ thật nhưng khách di chuyển theo dt bị kẹp 0,1 s, nên máy yếu phục vụ được ít khách hơn.
- **D-1, D-2, UX-3, UX-4, UX-9, UX-10:**
  - Thiếu animation làm việc.
  - Câu hỏi thiên đàng quá dễ.
  - Màn ngang chật.
  - Camera vào farm bị lệch.
  - Bài học bật lên che HUD.
  - Hết ca thì mất ly đang pha.
- **A-4 / UX-6:** Thiếu `public/models/cafe/robots.glb`, cần asset.
- **Hiệu năng cần quyết đánh đổi:**
  - VRAM thiên đàng/quán ước ~91–95 MB.
  - Draw call farm 183 ở preset high.
  - Farm và quán cùng nằm trên GPU sau lần vào quán đầu.
- **FW-1:** Không cài nguyên trạng framework Game Studios vì sẽ ghi đè agent/skill trùng tên. Xem `EXECUTION_LOG.md`.
