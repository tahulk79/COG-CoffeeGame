# 02b · Bản đồ thế giới

Người chơi bước vào cổng trùng sinh ở thiên đàng thì mở bản đồ thế giới 3D. Ở đây họ chọn một trong 8 nơi để trùng sinh. Nơi chọn quyết định save có nông trại, có quán hay cả hai. Lựa chọn này khóa vĩnh viễn cho save. Luật theo nơi và bảng số liệu ở [rules.md](rules.md).

## Vào / ra

| Vào từ | Điều kiện |
|---|---|
| [02 · Thiên đàng](../02-heaven/README.md) | Bước vào cổng ở pha trở về (`openWorldMap`, `src/app/game.js`) |
| Mở lại sau khi đã chốt nơi | Có `startingRegion` trong save: bản đồ mở thẳng thẻ kết quả của nơi đó, không chọn lại được |

| Ra tới | Khi nào |
|---|---|
| Đứng lại trước cổng thiên đàng | Bấm ✕ hoặc Esc khi chưa chốt (`leaveWorldMap()` → `cancelPortal`). Không lưu gì |
| Đứng lại trước cổng thiên đàng | Không tải được bản đồ (lỗi import): về thiên đàng, gọi `cancelPortal` |
| [03 · Nông trại](../03-farm/README.md) | Bấm **Bắt đầu** ở thẻ kết quả, nơi loại `both` hoặc `farm`: hoạt cảnh qua cổng (`depart`) rồi `enterFarm` |
| [04 · Quán](../04-cafe/README.md) | Như trên, nơi loại `cafe`: farm tải xong tự vào quán ngay (`farm/game.js`) |

## Luồng chơi

1. Bản đồ mở ở toàn cảnh. HUD thiên đàng ẩn (`body.world-map-open`).
2. Lần chọn đầu (save chưa có `startingRegion`): sau `PRESELECT_HOLD` giây, Việt Nam được chọn sẵn với thẻ thu gọn. Kéo, phóng, bấm phím di chuyển hoặc chạm cờ trước lúc đó thì hủy chọn sẵn.
3. Chạm một nước: camera lướt tới, khối quốc gia trồi lên, thẻ hiện tên, nơi chốn, câu gợi và 5 dòng địa lý. **Loại nơi bị ẩn.**
4. **Chọn nơi này** → cảnh báo "không đổi được" → **Trùng sinh ở đây** hoặc **Quay lại**.
5. **Trùng sinh ở đây**: lưu nơi, lộ loại nơi bằng hoạt cảnh, hiện thẻ kết quả. Không còn đường lui (✕ ẩn, Esc bị bỏ qua).
6. **Bắt đầu** → qua cổng → nông trại hoặc quán.

Đường nhanh nhất: 3 chạm (Chọn nơi này → Trùng sinh ở đây → Bắt đầu).

## Điều khiển

| Thao tác | Kết quả |
|---|---|
| Kéo một ngón / chuột | Bản đồ bám ngón tay; thả nhanh thì trôi theo quán tính, giữ yên rồi thả thì dừng; kẹp trong `BOUNDS` |
| Chụm hai ngón / con lăn | Phóng to, thu nhỏ trong `ZOOM` (6–22) |
| Mũi tên / WASD | Trượt bản đồ |
| Chạm trong viền nước, chạm nhãn cờ, chạm đảo Hoàng Sa/Trường Sa | Chọn nơi đó. Nước nhỏ: chạm cách tâm ≤ 0,8 đơn vị cũng được |
| Esc | Đang ở bước cảnh báo: quay về thẻ. Chưa chốt: đóng bản đồ. Đã chốt: không làm gì |
| ✕ góc trên trái | Đóng bản đồ (ẩn sau khi chốt) |

## Dữ liệu

| Khóa localStorage | Trường | Đọc / ghi |
|---|---|---|
| `godbean-progress` | `startingRegion` | Ghi ngay khi bấm **Trùng sinh ở đây** (`saveRegion`, `src/state/progress.js`). Đọc khi mở bản đồ để vào thẳng thẻ kết quả |
| `godbean-progress` | `farm.region` | Farm chép từ `startingRegion` khi tạo save (`farm/model.js`). Mọi luật theo nơi đọc trường này |
| `godbean-progress` | `awakening` (Key Nature) | Chỉ đọc: có Key Nature thì thẻ kết quả hiện hệ số vùng (`hasNature`) |

Save không có `region` hoặc id lạ thì coi là `vn` (`regionId`, `world-map/content.js`).

## Code

| File | Vai trò |
|---|---|
| `src/features/world-map/content.js` | Nguồn duy nhất của 8 nơi: `id`, `type`, kinh-vĩ độ, đường biên rút gọn, quần đảo của VN, `FACTS`. Hàm `regionId`, `regionType`, `regionById`, `DEFAULT_REGION`, `TYPE_ICON`, `TYPE_COLOR` |
| `src/features/world-map/geo.js` | Đường bờ biển rút gọn, sa mạc, dãy núi; phép chiếu x = kinh độ/12, z = −vĩ độ/9 |
| `src/features/world-map/terrain.js` | Địa hình liền: mặt nạ đất 720×288 làm mờ, lưới 330×176, màu theo khí hậu và độ cao |
| `src/features/world-map/scene.js` | `createWorldMap`: cảnh 3D, camera, chạm/chọn, chọn sẵn, thẻ DOM, lộ kết quả. Hằng số `PRESELECT_HOLD`, `CHOOSE_DELAY`, `BOUNDS`, `ZOOM` |
| `src/app/game.js` | `openWorldMap`, `leaveWorldMap`: nối thiên đàng ↔ bản đồ ↔ farm, lưu nơi, phát analytics |
| `src/state/progress.js` | `saveRegion` ghi `startingRegion` |
| `src/features/farm/content.js` | `REGION_QUESTS`, `questsFor`, `BUILDINGS` (cờ `both`), mốc HUD theo loại nơi |
| `src/features/farm/rules.js` | `REGION_CROP`, `regionCrop`, `regionFit`, `supplierPrice`, `RELIEF_GRAMS` |
| `src/features/farm/model.js` | Chép nơi vào save, đổi quà, cứu trợ hạt, Hội đồng và đơn quán theo loại nơi, áp hệ số vùng khi cây lớn |
| `src/features/farm/progression.js` | `economicStatus`: điều kiện thắng theo loại nơi |
| `src/features/farm/game.js` | `regionKind`: tự vào quán ở nơi `cafe`, công trình chỉ ở `both`, thẻ mục tiêu, dòng hợp vùng ở thẻ giống |
| `src/features/farm/autoplay.js`, `decorations.js` | Auto gửi hạt hay bán chợ theo loại nơi; vùng cấm xây quanh công trình chỉ `both` |
| `src/features/cafe/ui.js` | `farmless`: ẩn "Đặt farm", ô 📦 Đơn hàng, nút 🌱 Nông trại; chữ gợi ý riêng; nút cứu trợ hạt |
| `src/ui/styles/world-map.css` | Giao diện lớp phủ, thẻ, nhãn cờ, màu loại |
| `src/i18n/locales/world-map.js` | Chữ `world.*`: tên, nơi chốn, câu gợi, địa lý, thẻ kết quả, nhiệm vụ riêng |

## Asset

Chưa có model thật. Mọi thứ dựng bằng code, giữ đủ chức năng để thay asset sau:

- Địa hình liền có núi, bãi cát, mặt nước trong (`terrain.js`). Nắng đổ bóng thật, shadow map 1024.
- Mỗi nơi: viền vàng nhấp nháy theo đường biên, khối quốc gia đùn từ đường biên (mặt cỏ, cạnh đất), cờ màu kem, vật mốc cây/tách hiện khi lộ kết quả.
- Việt Nam có thêm quần đảo Hoàng Sa và Trường Sa: đảo cát nhỏ, chạm vào là chọn Việt Nam. Nhãn "Quần đảo Hoàng Sa (Việt Nam)", "Quần đảo Trường Sa (Việt Nam)" hiện khi phóng gần (khoảng cách camera < 17).
- Nhãn cờ là DOM: 🚩 + tên, đổi icon loại sau khi chốt.

## Analytics

| Sự kiện | Trường | Phát khi |
|---|---|---|
| `region_selected` | `region`, `type`, `preselected` | Bấm **Trùng sinh ở đây**. `preselected` = true khi VN đã thật sự được chọn sẵn, nơi chốt là VN và người chơi chưa chạm cờ nơi khác |
| `heaven_completed` | `region_type` (cùng các trường của thiên đàng) | Qua cổng sau khi chốt (`src/app/game.js`) |

## Chưa làm / điểm mở

- Chợ thế giới (F-32): sàn đơn mua/bán hạt giữa các nơi, NPC là bên kia. Chưa code.
- Hợp đồng xuất khẩu / đấu giá cho nơi chỉ trồng; chọn xuất xứ hạt nhập cho nơi chỉ quán.
- Cảnh farm/quán riêng theo nơi; giới hạn giống theo nơi; giá chợ/giá ly theo nơi. Hiện cân bằng chủ yếu bằng thưởng nhiệm vụ và giá nhập hạt.
- Nhiệm vụ của nơi chỉ quán đều dùng `served`; chưa có chỉ số mang đi hay điểm pha.
- Túi hạt đầu ở Colombia/Kenya đổi thành hạt chè (hiện luôn là vối).
- Nơi chỉ quán vẫn dựng cảnh nông trại phía sau (chỉ giữ dữ liệu). Tab nâng cấp "Quán" vẫn hiện ở nơi chỉ trồng.
- Mẹo thiên đàng không có tác dụng ở nơi thiếu một bên.
- Số `PRESELECT_HOLD`, `CHOOSE_DELAY` và hệ số `REGION_CROP` là số tạm, chưa đo bằng chơi thử.
- Đường biên là bản rút gọn tay: Indonesia chỉ có Sumatra, Mỹ chỉ phần lục địa.
