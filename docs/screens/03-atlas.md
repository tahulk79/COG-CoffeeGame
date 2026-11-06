# 03 · Bản đồ thế giới

Bản đồ 3D nghiêng. Nước đã mở sáng màu có cờ, nước đang ở có vòng sáng, nước khóa màu xám + 🔒 (mở ở Round 3 bằng xu, có xác nhận). Chạm một nước → sheet dưới cùng với 3 vùng và nút **Vào**.

| Chế độ | Khi nào | Đóng được? |
|---|---|---|
| `gate` | Pha `gate`: chọn nước + vùng đầu tiên | Không |
| `chooseRegion` | Sau khi vùng hết hạn ở Level 10: phải chọn vùng khác | Không |
| `play` | Mở từ nút World của HUD hoặc đi tới Cổng Thế Giới trong vùng | Có, quay lại vùng hiện tại |

- Ra: `world/enterRegion` thành công → [04 · Vùng đất](04-realm.md) (`enteredRegion` trong `src/app/game.js`). Vùng đã hết hạn nghỉ tới Round 2; vùng thứ 3 của mỗi nước mở ở Round 2.
- Code: `src/features/atlas/` (dùng lại địa hình/đường viền ở `src/features/world-map/terrain.js`, `geo.js`, `content.js`). Dữ liệu nước/vùng: `src/core/config/world.js`. Chữ: `atlas.*`, `country.*`, `regionName.*`, `world.region.*`.
