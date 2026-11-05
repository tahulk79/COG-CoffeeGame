# Áp dụng tài liệu chuẩn: V60 món đầu, đánh đổi năng suất–chất lượng, câu hỏi mở thiên đàng

| | |
|---|---|
| Người yêu cầu | Quang |
| Ngày | 04/11/2026 |
| Trạng thái | Chờ dev |
| Mức | Cao |
| Tài liệu đã sửa | `docs/design/godbean-gdd.md` (v2.0), `docs/screens/03-farm/rules.md`, `docs/screens/03-farm/gameplay.md`, `docs/screens/04-cafe/gameplay.md`, `docs/screens/02-heaven/gameplay.md`, `docs/shared/onboarding-flow.md`, `docs/reports/PDF-GDD-GAP-REPORT.md`; đợt 2: `docs/shared/{coffee-memory,decode-awaken,progression,analytics}.md`, `docs/shared/contracts.md`, `docs/screens/02b-world-map/README.md` |
| Mục GDD | 2, 5.3, 6.2, 7.5, 10.2, 10.3, 14.4, 15.1, A.4, A.6 |
| Mã | F-33…F-43; D-21…D-26 |
| Cập nhật | Chốt 6 điểm lệch với tài liệu chuẩn PDF 04/11/2026; luật mới ghi rõ "chưa code" trong tài liệu màn |

## Thay đổi

| Trước | Sau |
|---|---|
| Lộ trình: kinh tế trước, chưa có Memory/Sixth Key | Kết hợp: giữ kinh tế, bổ sung Phase 1–3 của PDF làm ưu tiên kế tiếp (GDD 14.4) |
| V60 mua Bộ V60 90 xu, mở cuối; một lần rót, không chấm nhiệt/thời gian | V60 có sẵn, là món hướng dẫn đầu; bước nhiệt 92–94 °C, bloom, rót chính 140–160 g, rót cuối 235–265 g, tổng 2:30–3:00; nâng cấp ấm 60 → 120 xu; kho đầu +300 g hạt chè rang, +40 giấy lọc |
| Bón ×1,1 (không bón ×0,9), +5 chất lượng; không tỉa ×0,95, tỉa +5 chất lượng; giá chợ × (0,7 + 0,3 q/100); Đơn Chợ 1,2 × | Bón ×1,15 / −6 chất lượng; tỉa ×0,9 / +10; giá chợ × (0,3 + 0,8 q/100); Đơn Chợ q ≥ 85 trả 1,6 × |
| Mẹo thiên đàng chỉ là buff | Giữ mẹo; mỗi câu thêm một câu hỏi mở, kiểm chứng ở farm/quán mới nhận Fragment |
| Chữ "thật" / "mô phỏng" chưa quyết | Công thức và số đo giữ chữ "thật"; dòng điểm ly đổi thành "Điểm theo mô hình game" + ⓘ; thêm `SCORE_MODEL_VERSION` (D-21, đợt 2) |
| XP bán chợ ⌊xu/2⌋ không trần; XP mua ruộng +10; không có mục tiêu thắng | Ba trục độc lập: XP chợ trần 40/ngày công, bỏ XP mua ruộng, thêm XP luyện món/Memory/giải mã; Economic Victory ≥ 300.000 xu tài sản + điều kiện theo nơi, Discovery Victory 6 Key (F-36) |
| Giá món cố định | Chủ quán đặt hệ số giá 0,8–1,3 mỗi món khi quán đóng; khoảng cách khách × p̄^1,5; tip giảm khi p > 1 (F-42) |
| Vùng không ảnh hưởng trồng | Hệ số sản lượng/chất lượng/thời gian lớn theo nơi × giống (F-43) |
| Không có Memory, Decode, analytics | Spec `shared/coffee-memory.md` (ly game + ly thật), `shared/decode-awaken.md`, `shared/progression.md`, `shared/analytics.md`; dữ liệu ở `contracts.md` mục 8 |
| Repo canonical theo PDF: `TheCoffeeSixSense` | Làm trên `beolamtat/V2`, MR vào `tahulk79/COG-CoffeeGame` `main` |

## Vì sao

Tài liệu chuẩn của founder (`docs/references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf`) là nguồn ưu tiên; Quang chốt cách xử lý từng điểm lệch ngày 04/11/2026. Lý do từng điểm: `docs/reports/PDF-GDD-GAP-REPORT.md` mục 4 và 9.

## Dev cần làm

- [ ] F-40: `src/features/cafe/recipes.js` (bước V60 mới, bỏ yêu cầu gear), `farm/model.js` (lô `starter` +300 g arabica, 40 giấy lọc; khách đầu gọi V60), `cafe/ui.js` thẻ hướng dẫn bước 3, chuỗi i18n EN/VI; sửa `contracts.md` (D-24); test `tests/cafe-rules.test.js`
- [ ] F-41: `src/features/farm/model.js:293` (hệ số bón/tỉa, chất lượng), `model.js:338` (giá chợ), Đơn Chợ (`makeOrder`/giao đơn); chạy `scripts/balance-sim.mjs` và ghi kết quả vào GDD 10.5
- [ ] F-39: dòng điểm "Điểm theo mô hình game" + ⓘ (`cafe/bench.js`, i18n), hằng `SCORE_MODEL_VERSION` lưu kèm ly
- [ ] F-33/F-34: theo `docs/shared/coffee-memory.md` (khóa `godbean-memory`, sổ tay ở quầy pha, Cài đặt ▸ Dữ liệu)
- [ ] F-35: theo `docs/shared/decode-awaken.md` (trường `awakening`, `cafe.shiftLog`)
- [ ] F-36: theo `docs/shared/progression.md` (`market.xp`, `mastery[].tiers`, `victories`)
- [ ] F-38: theo `docs/shared/analytics.md` (cần nơi nhận, D-26)
- [ ] F-42: `farm.cafe.prices`, `arrivalGap`, tip, modal Menu
- [ ] F-43: bảng `REGION_CROP` áp ở `farm/model.js` (sản lượng, chất lượng, thời gian lớn), dòng "Hợp vùng" ở Cửa hàng
- [ ] D-25: chạy `scripts/balance-sim.mjs` cho F-36, F-41, F-42, F-43 và ghi GDD 10.5
- [ ] Sau khi commit code: cập nhật cột Code ở GDD 0.3, "Đối chiếu code lần cuối"

## Kết quả

_Dev điền khi Xong: commit, phiên bản GDD, ghi chú._
