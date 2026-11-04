# 02b · Bản đồ thế giới

Đi qua cổng trùng sinh ở thiên đàng thì mở bản đồ thế giới 3D. Người chơi chọn nơi trùng sinh; nơi đó quyết định có nông trại, có quán hay cả hai. Đề xuất gốc: [ideas/2026-11-04-ban-do-the-gioi.md](../../design/ideas/2026-11-04-ban-do-the-gioi.md).

| | |
|---|---|
| Vào từ | [02 · Thiên đàng](../02-heaven/README.md): bước vào cổng ở pha `return` (lần đầu nghe lời chào trước) |
| Ra tới | ✕ / Esc → đứng lại trước cổng thiên đàng. Chọn nơi → hoạt cảnh qua cổng → [03 · Nông trại](../03-farm/README.md) (loại `both`/`farm`) hoặc thẳng [04 · Quán](../04-cafe/README.md) (loại `cafe`) |
| Dữ liệu ghi | `startingRegion` (`saveRegion`, cấp 1 của save) ngay khi bấm **Trùng sinh ở đây** (trước thẻ kết quả); farm chép sang `farm.region` khi tạo save. Mở lại bản đồ khi đã có `startingRegion` → vào thẳng thẻ kết quả của nơi đó |
| Code | `src/features/world-map/`: `content.js` (danh sách địa điểm có kinh-vĩ độ, đường biên rút gọn, thông tin địa lý; nguồn duy nhất), `geo.js` (đường bờ biển rút gọn, sa mạc, dãy núi, phép chiếu), `terrain.js` (địa hình liền + màu), `scene.js` (cảnh 3D + lớp DOM); nối ở `src/app/game.js` (`openWorldMap`, `leaveWorldMap`) |
| CSS / chữ | `src/ui/styles/world-map.css`; khóa `world.*` trong `src/i18n/locales/world-map.js` |

## Luật hiện hành (v1, 04/11/2026)

### Địa điểm

Cả 8 nơi đều chọn được. **Loại nơi bị ẩn tới khi chốt** (04/11, góp ý: lộ loại trước thì ai cũng chọn nơi "cả hai"): cờ, nhãn và thẻ trước khi chốt chỉ có tên, nơi chốn và một câu gợi không khí (`world.region.<id>.teaser`).

Mỗi nơi có hai nhiệm vụ riêng nối sau chuỗi chung theo loại (`REGION_QUESTS`, `farm/content.js`). Cân bằng: nơi chỉ một bên thưởng cao hơn (không có nguồn hạt rẻ hoặc không có đầu ra giá cao).

| id | Nơi | Loại (lộ sau khi chốt) | Nhiệm vụ riêng (chỉ số ≥ mốc · xu) |
|---|---|---|---|
| `vn` | Việt Nam | `both` · Trồng + quán | Bán 30 ly phin (`served` 30 · 25) → Gửi 1 kg hạt về quán (`delivered` 1000 g · 25) |
| `br` | Brazil | `both` | Phơi nắng 1 kg (`dried` 1000 g · 25) → Bán 40 ly cafezinho (`served` 40 · 25) |
| `co` | Colombia | `farm` · Chỉ trồng | Hái tay 15 lần (`harvested` 15 · 45) → Xuất khẩu 1,5 kg (`sold` 1500 g · 60) |
| `ke` | Kenya | `farm` | Rang 1 kg (`roasted` 1000 g · 45) → Bán 1 kg cho nhà xuất khẩu (`sold` 1000 g · 60) |
| `id` | Indonesia (Sumatra) | `farm` | Phơi 1,5 kg qua mùa mưa (`dried` 1500 g · 45) → Khai hoang thêm hai ruộng (`expanded` 2 · 60) |
| `it` | Ý | `cafe` · Chỉ quán | Pha 10 ly espresso (`served` 10 · 45) → Qua giờ cao điểm 40 ly (`served` 40 · 60) |
| `jp` | Nhật Bản | `cafe` | Pha tay 12 ly (`served` 12 · 50) → Thành kissaten 30 ly (`served` 30 · 70) |
| `us` | Mỹ (Seattle) | `cafe` | Bán 25 ly mang đi (`served` 25 · 45) → Mở chuỗi 60 ly (`served` 60 · 70) |

Thẻ mục tiêu dẫn đường cho nhiệm vụ riêng như nhiệm vụ gốc cùng chỉ số (`sold` → Cửa hàng/Chợ, `served` → quán, `dried`/`roasted` → trạm, `delivered` → Đơn hàng, `expanded` → biển ruộng).

- Một save một nơi, không đổi lại được (thẻ xác nhận nói rõ).
- Save cũ không có `farm.region` / `startingRegion`, hoặc id lạ → `vn` (chơi y như trước).
- Giống trồng chưa giới hạn theo nơi (thẻ chỉ ghi giống thực tế để tham khảo).

### Luật theo loại

| Phần | `both` | `farm` | `cafe` |
|---|---|---|---|
| Vào game | Nông trại | Nông trại | Tự vào quán ngay khi tải |
| Nút ☕ Vào quán (HUD `cafe-play`) | Mở như cũ | Không bao giờ mở | — |
| Nút 🌱 Nông trại trong quán, Esc rời quán | Có | — | Không có |
| Bảng Đơn hàng (`order-board`), đơn quán tự sinh khi có thợ | Có | Không | Không (ô 📦 trong ngăn kéo quán ẩn) |
| Kho quán → "Đặt farm" | Có | — | Ẩn; chỉ còn "Nhập hạt ngoài" |
| Giữ 252 g hạt rang cho nhiệm vụ Gửi hạt khi bán nhanh | Có | Không | — |
| Chuỗi nhiệm vụ | Chuỗi gốc + 2 nhiệm vụ riêng | Chuỗi gốc bỏ "Bán ly đầu", "Gửi hạt" + 2 nhiệm vụ riêng | Chỉ "Bán ly đầu" + 2 nhiệm vụ riêng |
| Bán / mua | Bán ly ở quán, hạt dư ra chợ; mua giống, phân, vật tư quán | Chỉ bán hạt (chợ); mua mọi đầu vào | Chỉ bán ly; mua toàn bộ hạt (nhập), sữa, ly, vật tư |
| Thẻ mục tiêu khi hết nhiệm vụ | … → "Bán ly" | … → "Bán hạt" (mở Cửa hàng → Chợ) | — |

Chuỗi nhiệm vụ theo nơi: `questsFor(region)` trong `farm/content.js`.

### Giao diện

- Lớp phủ toàn màn hình trên canvas; HUD thiên đàng ẩn (`body.world-map-open`). Nút ✕ góc trên trái (góc phải là ⚙️), tiêu đề giữa trên.
- **Sa bàn 3D nằm ngang, địa hình liền** (04/11: đã thử khối đùn phẳng, lưới ô lục giác, quả địa cầu, bản có cây/núi/mây; người dùng chốt bản này): `world-map/terrain.js` vẽ mặt nạ đất liền từ đường bờ biển rút gọn (`geo.js`, chiếu x = kinh độ/12, z = −vĩ độ/9) lên canvas nhỏ 720×288 (CPU), làm mờ hộp → trường mượt; một tấm lưới 330×176 lấy độ cao từ đó: đáy biển dốc lên bờ, bãi cát sát mép nước, nội địa cao dần, các dãy núi thật (Himalaya, Andes, Rockies, Alps, cao nguyên Đông Phi…) nhô lên có tuyết. Màu đỉnh theo dải khí hậu + sa mạc + độ cao. Mặt nước trong (thấy đáy nông màu ngọc), đáy biển sâu trải rộng để không lộ mép. Nắng đổ bóng thật (shadow map 2048, đi theo camera). Không cây, không mây.
- Mỗi nơi có **đường biên quốc gia rút gọn** (`outline` trong `content.js`, kinh-vĩ độ): viền vàng mờ nhấp nháy phủ theo địa hình báo chạm được, nhãn DOM nhỏ chỉ có 🚩 + tên. Không có chú giải loại.
- Kéo một ngón: bản đồ bám đúng ngón tay, thả nhanh thì trôi theo quán tính, giữ yên rồi thả thì dừng; kẹp biên. Hai ngón chụm / con lăn phóng to-thu nhỏ; mũi tên/WASD trượt. Nhãn làm tròn pixel để không rung.
- Chạm vào trong viền một nước (hoặc ≤ 0,8 đơn vị với nước nhỏ), hay chạm nhãn: camera lướt tới; **khối hình quốc gia** (đùn từ đường biên, mặt cỏ, cạnh đất) **trồi lên theo lò xo** (vượt đích rồi nảy về, lắc nhẹ), cắm cờ màu kem, đổ bóng thật xuống đất, mặt ửng vàng, rồi lơ lửng nhấp nhô.
- **Không lộ loại nơi trước khi chốt:** thẻ khi chạm chỉ có tên, nơi chốn (`place`), câu gợi (`teaser`) và **thông tin địa lý**: địa hình, khí hậu quanh năm, nhiệt độ, lượng mưa, độ cao so với mực nước biển (`world.region.<id>.terrain|climate|temp|rain|elevation`). Cấm nhắc cà phê, trồng được gì, uống, quán (ví dụ Colombia ghi "Quindío · Caldas" thay vì "Trục cà phê"). Nút **Chọn nơi này** → cảnh báo "không đổi được, chỉ khi đó mới biết" → **Trùng sinh ở đây** / **Quay lại**.
- **Lộ kết quả** khi bấm Trùng sinh ở đây: lưu nơi, ẩn ✕ (Esc không đóng), các nơi khác mờ đi và không chạm được; khối quốc gia bay cao hơn, mặt khối đổi màu loại (vàng `#e0a93a` trồng + quán, xanh `#5f9a3c` chỉ trồng, đỏ đất `#b5523a` chỉ quán), cờ và viền đổi màu loại, cây/tách nảy lên, nhãn đổi icon loại. Thẻ kết quả trượt lên, viền màu loại: huy hiệu loại, ✓/✕ Nông trại, ✓/✕ Quán, 💰 bán gì, 🛒 mua gì, giống trồng, đặc trưng thật, 🎯 hai nhiệm vụ riêng kèm xu thưởng, một dòng cân bằng (dễ/khó, thưởng thấp/cao) và nút **Bắt đầu** → hoạt cảnh qua cổng.
- Lúc mở: thẻ đáy là gợi ý thao tác.

## Chưa làm (để sau)

- **Chợ thế giới** — sàn đơn hàng chung giữa các khu vực: đề xuất ở [market-proposal.md](market-proposal.md).

- Hợp đồng xuất khẩu / đấu giá thay bảng Đơn hàng ở nơi chỉ nông trại; chọn xuất xứ hạt nhập ở nơi chỉ quán.
- Cảnh farm/quán riêng theo nơi; giới hạn giống theo nơi; hệ số kinh tế theo nơi (giá chợ/giá nhập/giá ly) — hiện chỉ cân bằng bằng thưởng nhiệm vụ, chưa đo bằng sim. Nhiệm vụ của các nơi chỉ quán đều dùng `served` (chưa có chỉ số mang đi / điểm pha).
- Nơi chỉ quán vẫn dựng cảnh nông trại phía sau (giữ model); tab nâng cấp quán vẫn hiện ở nơi chỉ nông trại; gợi ý quán thiếu hạt vẫn nhắc "về farm".
- Mẹo thiên đàng không có tác dụng ở nơi thiếu một bên (chấp nhận ở v1).
- Asset thật: địa hình, khối quốc gia, cờ, vật mốc dựng bằng code (khối tạm có chức năng). Đường biên là bản rút gọn tay (Indonesia chỉ Sumatra, Nhật chỉ Honshu–Kyushu, Mỹ chỉ phần lục địa).
