# 05 · HUD

Lớp DOM trên vùng đất (pha `play`). Tối giản, ưu tiên ngón cái trên điện thoại dọc.

- **Trên**: huy hiệu cấp + vòng XP + tên (trái), xu, hạt/sức chứa, Round + lượt trùng sinh, nút cài đặt (phải).
- **Thanh công cụ dưới**: Xây, Giống, Nhân viên, Thế giới, Tiến trình. Chấm đỏ khi có thứ mới hoặc mua được.
- **Action bar** theo đối tượng đang chọn: nâng cấp, mua đất, mở đường, di chuyển công trình…; giá hiển thị, thiếu tiền thì báo đúng số còn thiếu.
- **Đặt công trình**: xem trước trên bản đồ (xanh hợp lệ / đỏ không), nút ✓ / ↻ / ✕.
- **Modal** chỉ cho mở Round/nước và xác nhận trùng sinh. **Toast** cho lỗi và phần thưởng; số bay về thanh trên.
- **Tutorial**: 8 bước một hành động (trồng → thu → nhận đơn → pha → phục vụ → xây lò rang → nâng Kho → mua đất), bong bóng gợi ý + tay chỉ + mũi tên 3D + camera; tính từ save nên không kẹt, có thể bỏ qua.
- **QA panel 🧪**: chỉ với `?profile=test` ở dev (xem README gốc).
- Code: `src/features/hud/` (API ở [v3-architecture.md](../design/v3-architecture.md#hud-api-srcfeatureshudindexjs)), `src/ui/styles/v3.css`. Chữ: `hud.*`, `err.*`, `crop.*`, `drink.*`, `building.*`, `staff.*`, `blessing.*`, `tut.*`.
