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
