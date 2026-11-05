# Trạng thái triển khai theo tài liệu chuẩn

Checkpoint để tiếp tục sau khi gián đoạn. Nguồn: [PDF-GDD-GAP-REPORT.md](PDF-GDD-GAP-REPORT.md) mục 6, 9, 10; GDD v2.1 mục 0.3, 14.4. Nhánh `feat/audit-implementation-2026-11-04`, bắt đầu từ `4f361ba` (tài liệu đối chiếu chưa commit).

## Kiểm tra trước khi code (04/11/2026)

| Mục | Kết quả |
|---|---|
| D-21, Q-04, Q-06, Q-07, Q-08, Q-10, Q-11 | Đã chốt — GDD 15.1, lịch sử phiên bản 2.1 |
| Spec D-22 `shared/decode-awaken.md`, D-23 `shared/coffee-memory.md` | Đã viết đủ: luật, dữ liệu, UI, tiêu chí nghiệm thu |
| Audit | Dùng lại audit 04/11 + gap report, không audit lại |
| Test nền | `node --test tests/*.test.js` 74/74 PASS |

## Backlog

| Task | F-xx | Trạng thái | Agent / skill | Test | Ghi chú |
|---|---|---|---|---|---|
| T-01 Xuất/nhập/xóa dữ liệu, cảnh báo localStorage, `npm test`, profile MAX dev | F-37, B-08 | Code xong, chờ QA browser | gameplay-programmer; Producer sửa 1 dòng `model.js` (xu MAX) | Unit PASS (`npm test` 92/92) | `?profile=max` chỉ khi `import.meta.env.DEV`; key hậu tố `@max`; chưa kiểm `vite build` |
| T-02 Điểm "theo mô hình game" + `SCORE_MODEL_VERSION`; V60 món đầu 3 giai đoạn | F-39, F-40 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS (`tests/v60.test.js`) | ⓘ là nút bấm (chưa có `.ui-tip` chạm-giữ dùng chung); thời gian ly đầu chưa đo |
| T-03 Đánh đổi năng suất–chất lượng + hệ số vùng | F-41, F-43 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS (`tests/crop-tradeoff.test.js`); sim 60 phút: cấp 12, chợ 3.909 | Colombia/Kenya khởi đầu khó hơn (cây vối bị phạt) |
| T-04 Coffee Memory + Quick Taste (lát 1) | F-33, F-34 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS (`tests/memory.test.js`) | Scientist, TDS/RDT tooltip, sổ tay ở nơi chỉ trồng chưa làm; dung sai so bước 5% Đang chỉnh |
| T-05 Giá do chủ quán | F-42 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS (`tests/cafe-price.test.js`); sim p=1 không đổi | Số hệ số chưa sim với p ≠ 1 (D-25) |
| T-06 Ba trục tiến trình + mục tiêu thắng | F-36 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS (`tests/progression.test.js`); sim 60 phút: cấp 11 (trước 12) | Sim chỉ 60 phút, chưa kiểm ngưỡng cấp 14 ở 120 phút; 'đủ tự động hóa' hiểu là max mọi cấp |
| T-07a Module analytics (`src/shared/analytics/`) | F-38 | Code xong | gameplay-programmer | Unit PASS 8/8 | Chưa nối vào game |
| T-07b Nối analytics vào game + công tắc Cài đặt | F-38 | Code xong (10 sự kiện) | gameplay-programmer | Unit PASS (`tests/analytics-wire.test.js`) | Nơi nhận BLOCKED (D-26) |
| T-07c API sự kiện farm model + 7 sự kiện còn lại + XP Memory | F-38, F-36 | Code xong | gameplay-programmer | Unit PASS (`tests/farm-events.test.js`) | Ca học việc trượt không phát `shift_ended` |
| T-08a Lõi Decode (câu hỏi, Fragment, Key, First Sixth Key, `awakening`, `shiftLog`) | F-35 | Code xong | gameplay-programmer | Unit PASS (`tests/awakening.test.js`) | 3 câu chưa có dữ liệu: region, roast-age (thay bằng variety) |
| T-08b Giao diện Decode + câu `tired` | F-35 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS 155/155 | Quán vào Câu hỏi/Key qua Sổ tay |
| T-08c Key mở công cụ (§6) | F-35 | Code xong, chờ QA browser | gameplay-programmer | Unit PASS 164/164 | Thẻ bản đồ (Nature) không làm; Thí nghiệm chỉ cảnh báo, chưa khóa biến; CSS khối mới chưa chỉnh |
| T-09a Sim D-25 | F-36, F-41, F-42, F-43 | DONE | economy-designer (mở rộng sim), Producer chạy | Sim: cấp 15 ở 120′; vùng ≤ −14%; chăm cây chênh 6,8%; p 0,8 áp đảo | Ghi GDD 10.5; D-27, D-28 chờ Quang |
| T-09b Build production | — | DONE | Producer | `npm run build` PASS; `?profile=max` bị loại ở production | Cảnh báo chunk > 500 kB (có sẵn) |
| T-09c QA browser NORMAL + MAX, perf | — | BLOCKED | qa-tester, performance-analyst | NOT RUN | Khung trình duyệt bị ẩn → cảnh 3D không vẽ |

## QA browser (Producer)

- 04/11: `?profile=max` trong dev: xu hiện 10T, chỉ ghi key `@max`, save thường không bị đụng; console không lỗi. Khung trình duyệt bị ẩn nên cảnh 3D không vẽ (rAF dừng) — QA hình ảnh/tương tác 3D **NOT RUN**, chờ khung hiện.
- 04/11: smoke DOM (khung ẩn): farm MAX tải không lỗi JS, `awakening` có 6 câu thiên đàng, V60 cấp 1. Phát hiện + sửa: profile MAX ghi analytics lẫn với dữ liệu thật → tắt analytics khi `?profile=max` (`app/game.js`); thiếu icon 🌐 💾 → thêm `globe`, `disk` (`ui/icons.js`). Sau sửa: hàng chờ analytics rỗng, hết cảnh báo icon.

## Còn lại

1. QA trình duyệt NORMAL + MAX trên mobile/desktop và đo hiệu năng — cần khung trình duyệt hiện (T-09c).
2. D-26 nơi nhận analytics; D-27 Đơn Chợ; D-28 sàn giá quán — chờ Quang.
3. Commit / MR — chờ Quang.

## QA trình duyệt 04/11 (Producer, khung hiện một phần thời gian)

| Kiểm | Chế độ | Kết quả |
|---|---|---|
| Save mới → intro (Bỏ qua) → thiên đàng (Bỏ qua) → bản đồ → Việt Nam → farm | NORMAL | PASS — 200 xu, không buff; 6 câu hỏi mở `open`; analytics `landing_viewed → play_clicked → game_started → region_selected → heaven_completed`, không có chữ tự do |
| Hái đầu tiên, câu hỏi ôn thiên đàng, mở «Vào quán» | NORMAL | PASS |
| Ca đầu: khách đầu gọi V60, quầy pha 9 bước, kho 600 g vối + 300 g chè | NORMAL | PASS |
| Màn kết quả "Điểm theo mô hình game: 91 · Chất lượng: 83" + ⓘ, nút «📓 Ghi sổ» | NORMAL | PASS |
| Sổ tay: Quick Taste 6 thuộc tính + mức thích, chip trung tính, chốt cảm nhận → Insight 3 ô → quay lại màn kết quả | NORMAL | PASS (lỗi XP Insight — đã sửa, xem dưới) |
| Bưng ly → bán ly đầu, `tutorial_completed` | NORMAL | PASS |
| Profile MAX: 10T xu, chỉ ghi key `@max`, không ghi analytics | MAX | PASS |
| Hướng dẫn: tab Câu hỏi mở, Fragment/Key, Mục tiêu (tài sản 9.999.999.999.999 / 300.000 nhưng điều kiện ruộng/uy tín vẫn ✗) | MAX | PASS |
| Menu/Giá: +/− cập nhật ngay, chặn ở ×1,30, cảnh báo "quá đắt", khóa khi quán mở | MAX | PASS sau sửa |
| Khổ mobile 375×812: HUD, modal Hướng dẫn | NORMAL/MAX | PASS sau sửa tab |
| Rót V60 cộng dồn trên trình duyệt | — | NOT RUN (khung ẩn → cân không chạy); có unit test |
| Hiệu năng farm (MAX, 1024×768, dpr 1, dev) | Đo 05/11 | HEAD gốc: 100 fps, p99 11 ms, 0 khung >33 ms, 165 draw, heap ~57 MB. Code mới trước sửa: p50 10 ms nhưng 11–13 khung 50–410 ms mỗi 10 s, lặp ~3 s, 165 draw, heap 41–51 MB → **hồi quy** |
| Sửa hồi quy giật 3 s | Test 05/11 | `awakening check` không đổi gì vẫn tăng `workRevision` + lưu → UI check lại sau 3 s → vòng lặp (kèm điều phối lại nhân viên). Sửa `model.js`: check không đổi trả sớm. Test `awakening.test.js` mới, `npm test` 167/167. Đo lại 05/11 (giây 38–68 sau tải): 3.000 khung, 1 khung 40 ms, còn lại ≤ 20 ms; 3 lượt × 8 s sau đó: 100 fps, p99 11 ms, 0 khung >33 ms → **DONE** |
| Hiệu năng quán (MAX, mở, 2 khách chờ) | Đo 05/11 | 100 fps, p99 11 ms, 0 khung >33 ms trong 54 s; 166–167 draw (bàn pha mở: 133); heap 60–85 MB dao động GC, chưa đo đủ dài để kết luận rò bộ nhớ |
| Rót V60 cộng dồn trên trình duyệt | — | NOT RUN — trang bị Vite tải lại 2 lần do người/phiên khác sửa `scene.js`, `cafe/game.js` lúc 06:47; mới có unit test |

**Lỗi tìm được và đã sửa (nguyên nhân gốc):**

1. **Hồi quy nghiêm trọng — mọi thao tác modal quán không vẽ lại / không trả kết quả:** chú thích `//` chèn giữa dòng ở `cafe/ui.js` `act()` nuốt `rerender?.(); return result;` (từ T-07c). Sửa: tách chú thích ra dòng riêng. Quét các file đã đổi: không còn chỗ tương tự.
2. **Insight không được +5 XP:** `memory_saved` phát lúc chốt cảm nhận (trước khi có Insight); Insight lưu sau không phát gì. Sửa: `memory.js` phát `insight_saved` một lần khi Insight đủ 3 ô; `wire.js` cộng XP. Test mới trong `tests/memory.test.js`.
3. **V60 rót chính/rót cuối ghi "tổng" nhưng cân bắt đầu từ 0:** thêm cờ `cumulative` cho 2 bước, cân bắt đầu từ lượng của bước trước; lớp cà phê trong ly và `waterG` của sổ tay tính theo tổng. Test mới trong `tests/v60.test.js`.
4. **Chữ nhiệm vụ "Quán đã có 600 g hạt rang"** sai sau F-40 → "600 g vối + 300 g chè" (EN/VI).
5. **Chữ tiếng Việt lẫn trong bản tiếng Anh** (`awakening.lore.flag`) → "Fictional lore". Quét mọi locale EN: chỉ còn tên riêng cố ý.
6. **Tab thứ ba của Hướng dẫn bị cắt trên điện thoại** → tab co giãn chia đều ở màn ≤ 480 px.

Sau sửa: `npm test` 166/166, `npm run build` PASS.
