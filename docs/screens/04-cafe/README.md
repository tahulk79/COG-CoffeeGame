# 04 · Quán cà phê

Người chơi vận hành quán và học công thức pha cà phê thật qua thao tác tay. Không có model riêng: đọc/ghi kho, tiền, lô hàng qua model của [03 · Nông trại](../03-farm/README.md) bằng `farm.act(...)`.

| | |
|---|---|
| Vào từ | [03 · Nông trại](../03-farm/README.md), nút Vào quán (`enterCafe`) |
| Ra tới | [03 · Nông trại](../03-farm/README.md), nút Nông trại (`exitCafe`) |
| Dữ liệu | Nằm trong object `farm` (lô hạt, chuyến giao, `stats`, uy tín); không có key lưu riêng |
| Lưu ý | Farm vẫn `tick` model khi người chơi đang ở quán; scene quán được giữ lại để vào lại nhanh |
| Code | `src/features/cafe/`, xem bảng dưới |

## Tài liệu

| File | Nội dung |
|---|---|
| [gameplay.md](gameplay.md) | Vòng chơi, công thức, nguyên liệu, bố cục 3D, nhân viên, tự động hoá, bàn pha |
| [fun-review.md](fun-review.md) | Soát độ vui vòng chơi, **đề xuất chờ duyệt**, chưa sửa code |
| [shared/robot-staff.md](../../shared/robot-staff.md) | Robot và nhân viên quán |
| [shared/contracts.md](../../shared/contracts.md) | Model dùng chung, lô hàng, chuyến giao |
| [03-farm/rules.md](../03-farm/rules.md) | Luật farm ↔ quán, đơn hàng |

## Code theo chức năng

| File | Việc |
|---|---|
| `game.js`, `ui.js`, `art.js`, `street.js` | Cảnh quán, HUD, hình, sân vườn |
| `service.js` | Khách, order, nhân viên, bảng việc |
| `bench.js`, `recipes.js` | Quầy pha và dữ liệu công thức |
| `feedback.js`, `debug.js` | Phản hồi hình/tiếng, debug lưới ô |

## Ca tập và ly V60 làm mẫu (05/11/2026, F-47)

Luật đầy đủ: [gameplay.md](gameplay.md) mục "Ca tập" và "Ly V60 làm mẫu". Code chưa chơi thử.

| Điểm | Vào / ra | Code |
|---|---|---|
| Tự mở ca tập | Vào: chưa có `cafe-intro`, quán đóng, chưa có ca, kho quán có chè rang ≥ liều V60. Ra: ca `training`, 1 khách V60 đứng sẵn ở quầy thu ngân | `service.update()` (cờ phiên `autoOpened`), `startShift`, `guestAtRegister` |
| Kết thúc ca tập | Bán ly đầu → ghi `cafe-intro`, đóng quán, báo cáo «Ly đầu tiên đã bán!» + «🚪 Mở ca mới» (sau hộp Memory; giữ qua lần rời quán) | `service.update()`, `endShift`; `ui.js` `trainingReport`, `pendingReport`; `game.js` `carryReport` |
| Khoá Mở/Đóng | Nút 🚪 HUD ẩn, mục `open-cafe` ở farm ẩn, cửa 3D `door` chỉ báo, Auto không trả `door` | `service.toggleOpen`, `ui.js` `refreshHud`, `farm/game.js` (open-cafe), `game.js` `autoPick` |
| Van an toàn | Quán đóng và không có chè ≥ liều V60 → 🚪/cửa bỏ ca tập (ghi `cafe-intro`), mở ca thường; đủ chè thì mở lại ca tập | `service.trainingValve`, `service.toggleOpen` |
| Thẻ quán 3 bước | Nhận order → pha V60 → bưng ly | `ui.js` `refreshHud` |
| Ly V60 làm mẫu | Tutorial id `v60-guided` ([contracts.md](../../shared/contracts.md)); save cũ `mastery.v60.best ≥ 70` coi như đã xem | `bench.js` (`guided`), `farm/content.js` `TUTORIAL_IDS`, `farm/model.js` |
