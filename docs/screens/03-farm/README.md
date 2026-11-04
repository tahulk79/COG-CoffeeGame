# 03 · Nông trại

Màn chính và là nơi giữ model dữ liệu của cả game: ruộng, cây, kho, tiền, nhân viên, đơn hàng, công trình, nhiệm vụ. Quán cà phê ([04](../04-cafe/README.md)) mở từ đây và dùng chung model này.

| | |
|---|---|
| Vào từ | [02 · Thiên đàng](../02-heaven/README.md); hoặc mở game khi save đã có `farm` / `heaven.completed` |
| Ra tới | [04 · Quán](../04-cafe/README.md) bằng nút Vào quán; quán trả về đây |
| Dữ liệu ghi | `farm` (object `version: 3`) qua `saveFarm`; `commit()` sau mỗi thao tác thành công và mỗi ≥ 5 s |
| Code | `src/features/farm/`, xem bảng dưới |

## Tài liệu

Luật hiện hành:

| File | Nội dung |
|---|---|
| [rules.md](rules.md) | **Luật gameplay hiện hành** của farm và quán: vòng chơi, đất/cây, nhân viên, đơn hàng. Tài liệu chính để sửa tiếp |
| [gameplay.md](gameplay.md) | Mô tả kỹ thuật và bố cục farm; khi mâu thuẫn thì theo `rules.md` |

Đề xuất (ngày 02/11/2026, ghi "chưa triển khai" khi viết; chưa đối chiếu lại với code):

| File | Nội dung |
|---|---|
| [build-proposal.md](build-proposal.md) | Gameplay xây dựng, danh mục công trình, luồng Build |
| [crop-processing-proposal.md](crop-processing-proposal.md) | Giống, vòng đời cây, chuỗi chế biến và bán |
| [staff-ai-proposal.md](staff-ai-proposal.md) | Nhân viên tự vận hành nông trại |

Dùng chung / lịch sử:

- Robot vườn và sự cố của nhân viên: [shared/robot-staff.md](../../shared/robot-staff.md)
- Dữ liệu `farm`, tiền, kho, lô hàng: [shared/contracts.md](../../shared/contracts.md)
- Lịch sử luật và bản thiết kế ban đầu: [archive/farm/](../../archive/farm/farm-operations-history.md) (không dùng làm đặc tả)

## Code theo chức năng

| File | Việc |
|---|---|
| `model.js`, `rules.js`, `content.js` | Dữ liệu và luật. Chỉ `model.js` được sửa số liệu |
| `game.js`, `ui.js`, `tools.js`, `environment.js` | Cảnh, HUD, công cụ, môi trường |
| `crew.js`, `worker-planner.js`, `activity.js` | Nhân viên và chia việc |
| `orders.js` | Đơn hàng, giao farm → quán |
| `decorations.js`, `decoration-builder.js` | Công trình, trang trí |
| `blockers.js`, `assets.js`, `feedback.js` | Vật cản, model, phản hồi hình/tiếng |
