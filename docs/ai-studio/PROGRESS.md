# Việc đang làm (AI studio)

Giữ ngắn. Việc xong chuyển sang báo cáo ngày `docs/design/progress/`. Hook SessionStart in file này sau compact.

## Đang làm

- (trống)

## Bị chặn / chờ quyết

- 04/11 Audit gameplay: đã sửa Pha nhanh, Auto pha, Auto câu hỏi, quà theo nơi, nhiệm vụ vùng, Esc quán, tài liệu lệch code. Còn chờ quyết/sim: G5 đầu ra nơi chỉ trồng, G10 mở nút Auto, G11 mục tiêu sau 15 phút, G15 giới hạn hỏi lại, E3–E10 cân bằng (cần sửa sim trước), U2/U5/U8/U11 cần xem trên máy.
- 04/11 Audit toàn game lần 2: báo cáo `docs/design/audits/2026-11-04-audit-toan-game.md`. Chờ Quang duyệt backlog và 4 quyết định (nơi chỉ quán kẹt tiền, mục tiêu ca khi có nhân viên, đơn Chợ, sink cuối game). EC-2 (`model.js:538`) đã sửa, có test, chưa chạy test.
- 04/11 Triển khai audit xong đợt 1 (mục 4b báo cáo audit): P0 + 11 P1 + phần lớn P2 DONE, test 64/64. NEW-2/NEW-3/PT-3/PT-6/UX-B3/PT-10/QA-4/QA-6 xong, test 72/72. Chờ quyết: EC-3, EC-5. Chưa làm: UX-A1, UX-A4, PT-9, PT-11, BG-A3, phần còn lại BG-A4, PF-x/PF-3/5/6/7.
- 04/11 `/game-studio dev` xong: 14 backlog audit đã code (trừ PF-x), test 74/74, build OK. Chờ Quang duyệt: EC-3 giá 45 xu (đã code, giá tạm), EC-5 sink cuối game (đề xuất). Chưa commit.
