# 04 · Vùng đất 3D

Pha `play` (và `expiry`). Một bản đồ đi bộ được của vùng: các ô đất nông trại, khu quán (Quầy gọi món, Quầy pha chế), lô xây dựng, đường và Cổng Thế Giới. Bố cục: `src/core/config/layout.js`.

## Chạm (không modal)

| Chạm vào | Kết quả |
|---|---|
| Ô đất trống của mình | Trồng giống đang chọn (`farm/plant`) |
| Cây chín | Thu hạt (`farm/harvest`) |
| Kéo qua nhiều ô | Trồng hoặc thu cả dải (theo ô đầu tiên) |
| Quầy gọi món | Nhận đơn nếu có khách chờ (`shop/takeOrder`) |
| Quầy pha chế | Phục vụ nếu ly đã xong, không thì pha (`shop/brew` → `shop/serve`) |
| Công trình / biển bán đất / đường khóa / cổng | Chọn → HUD hiện action bar |
| Mặt đất | Nhân vật đi tới đó |

Camera: theo người chơi, Area Focus khi chọn, cinematic cho `expiry`, `round`, `country`, `rebirth`, `arrive`. Realm tự sinh khách theo `arrivalMs`; khách chờ quá lâu thì bỏ đi.

## Level 10

Lần đầu đạt Level 10: dừng chơi → cinematic + Thầy nói → `expiry/execute` (reset công trình, cây, đơn, phân công nhân viên của vùng; giữ xu, cấp, hạt, đất, lượt trùng sinh) → [Bản đồ](03-atlas.md) chế độ `chooseRegion`. An toàn khi tải lại giữa chừng.

- Code: `src/features/realm/` (API ở [v3-architecture.md](../design/v3-architecture.md#realm-api-srcfeaturesrealmindexjs)). Chữ: `realm.*`.
