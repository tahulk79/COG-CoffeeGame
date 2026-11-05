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

**Đánh đổi 05/11/2026 (F-44, Q3):** lần chọn vùng đầu chọn sẵn Việt Nam (`both`), chấp nhận hiệu ứng mặc định nghiêng về loại `both` để người mới vào nhanh; loại nơi vẫn ẩn, vẫn cảnh báo «không đổi được», vẫn khóa vĩnh viễn. Quang chốt 05/11, chưa qua sếp duyệt.

### Chọn sẵn Việt Nam lần đầu (05/11/2026, F-44 — đề xuất [Q3](../../shared/mobile-first-proposal.md); đã code, chưa chạy test/chơi thử)

- Điều kiện: mở bản đồ khi save chưa có `startingRegion` và trong phiên chưa chốt nơi → `src/app/game.js` truyền `preselect: DEFAULT_REGION` (`vn`) vào `createWorldMap`. Đã có `startingRegion` thì như cũ: mở thẳng thẻ kết quả, không chọn sẵn. Mặc định `vn` cho mọi ngôn ngữ. Nếu sau này có trùng sinh lại thì mặc định không chọn sẵn (quyết riêng khi đó).
- Bản đồ mở ở toàn cảnh (`view` x 2, z −1,5, khoảng cách 20), giữ `PRESELECT_HOLD` giây rồi `select('vn', { auto: true })`: camera lướt tới VN, khối VN trồi lên theo lò xo, cờ VN `is-selected`. Nhánh `auto`: không phát `sfx('ui.open')`, không focus nút «Chọn nơi này», focus đặt vào thẻ đáy (role=status). Chạm một cờ, kéo, chụm/cuộn phóng hoặc bấm phím di chuyển trong lúc giữ toàn cảnh thì hủy chọn sẵn (không kéo camera về VN).
- Thẻ thu gọn: tên, nơi chốn, teaser, dòng `world.preselectHint` (giữ vế «chỉ lộ ra sau khi chọn»), nút **Xem thêm** và **Chọn nơi này**; năm dòng địa lý tạm ẩn, hiện khi chạm bất kỳ cờ nào (kể cả cờ VN) hoặc **Xem thêm**. Không có nhãn «khuyên dùng/dễ», không icon hay chữ lộ loại nơi, không nút 1 chạm bỏ qua xác nhận.
- Nút «Chọn nơi này» chỉ nhận chạm/Enter sau `CHOOSE_DELAY` giây kể từ lúc bản đồ mở (chặn chạm/Enter còn sót từ thiên đàng/Bỏ qua). Hai hằng số ở đầu `world-map/scene.js`, chỉnh khi playtest (số hiện tại là số tạm, chưa đo).
- Chạm cờ khác: chọn như thường (sfx, thẻ đầy đủ), không tự quay về VN. ✕/Esc đứng lại trước cổng; mở lại khi chưa chốt thì VN lại được chọn sẵn.
- Không lưu gì trước khi bấm **Trùng sinh ở đây**. Đường nhanh nhất vẫn 3 chạm: Chọn nơi này → Trùng sinh ở đây → Bắt đầu.
- Analytics: `onPick(id, { preselected })` → `region_selected.preselected` = true khi bản đồ đã thật sự chọn sẵn (hết `PRESELECT_HOLD` mà chưa bị hủy), nơi chốt là nơi chọn sẵn và người chơi chưa chạm cờ nơi khác ([analytics.md](../../shared/analytics.md)). Không phải trường save.

Mỗi nơi có hai nhiệm vụ riêng nối sau chuỗi chung theo loại (`REGION_QUESTS`, `farm/content.js`). Cân bằng: nơi chỉ một bên thưởng cao hơn (không có nguồn hạt rẻ hoặc không có đầu ra giá cao).

| id | Nơi | Loại (lộ sau khi chốt) | Nhiệm vụ riêng (chỉ số ≥ mốc · xu) |
|---|---|---|---|
| `vn` | Việt Nam | `both` · Trồng + quán | Bán 30 ly phin (`served` 30 · 25) → Gửi 1 kg hạt về quán (`delivered` 1000 g · 25) |
| `br` | Brazil | `both` | Phơi nắng 1 kg (`dried` 1000 g · 25) → Bán 40 ly cafezinho (`served` 40 · 25) |
| `co` | Colombia | `farm` · Chỉ trồng | Hái tay 15 lần (`harvested` 15 · 45) → Xuất khẩu 1,5 kg (`beansSold` 1500 g · 60) |
| `ke` | Kenya | `farm` | Rang 1 kg (`roasted` 1000 g · 45) → Bán 1 kg cho nhà xuất khẩu (`beansSold` 1000 g · 60) |
| `id` | Indonesia (Sumatra) | `farm` | Phơi 1,5 kg qua mùa mưa (`dried` 1500 g · 45) → Khai hoang thêm hai ruộng (`expanded` 2 · 60) |
| `it` | Ý | `cafe` · Chỉ quán | Pha 10 ly espresso (`served` 10 · 45) → Qua giờ cao điểm 40 ly (`served` 40 · 60) |
| `jp` | Nhật Bản | `cafe` | Pha tay 12 ly (`served` 12 · 50) → Thành kissaten 30 ly (`served` 30 · 70) |
| `us` | Mỹ (Seattle) | `cafe` | Bán 25 ly mang đi (`served` 25 · 45) → Mở chuỗi 60 ly (`served` 60 · 70) |

Thẻ mục tiêu dẫn đường cho nhiệm vụ riêng như nhiệm vụ gốc cùng chỉ số (`sold`/`beansSold` → Cửa hàng/Chợ, `served` → quán, `dried`/`roasted` → trạm, `delivered` → Đơn hàng, `expanded` → biển ruộng).

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

### Vùng ảnh hưởng trồng trọt (F-43, chốt 04/11/2026 — Q-08, ĐÃ CODE 04/11: `REGION_CROP` trong `farm/rules.js`, dòng Hợp vùng ở thẻ giống; số Đang chỉnh, chưa chơi thử)

Mục đích: bản đồ thế giới có giá trị thật (tài liệu chuẩn tr. 2 §3.2: khí hậu, đất ảnh hưởng năng suất và chất lượng). Mọi giống vẫn trồng được ở mọi nơi có farm; giống không hợp vùng bị phạt, là lựa chọn có đánh đổi. Hệ số nhân vào **sản lượng**, cộng vào **chất lượng gốc** (`55 + sức khỏe × 0,25`, kẹp 0–100) và nhân vào **thời gian lớn** (> 1 là chậm hơn). Áp cùng lúc với bón/tỉa (F-41).

| Nơi | Vối (Robusta) | Chè (Arabica) | Mít (Liberica) | Lý do (theo dữ liệu địa lý của thẻ) |
|---|---|---|---|---|
| Việt Nam | ×1,10 · +0 · ×1,0 | ×0,95 · +3 · ×1,0 | ×1,00 · +0 · ×1,0 | 500–1.500 m, 18–25 °C: vùng vối lớn; chè ở cao nguyên |
| Brazil | ×1,05 · −3 · ×1,0 | ×1,10 · +0 · ×1,0 | ×0,85 · −5 · ×1,1 | 700–1.300 m cận nhiệt: chè và conilon |
| Colombia | ×0,80 · −8 · ×1,1 | ×1,00 · +8 · ×1,1 | ×0,80 · −8 · ×1,1 | 1.200–2.000 m, mát quanh năm: chè chất lượng cao, lớn chậm |
| Kenya | ×0,80 · −8 · ×1,1 | ×0,95 · +10 · ×1,1 | ×0,80 · −8 · ×1,1 | 1.400–2.100 m, đêm lạnh: chè chua sáng, sản lượng thấp |
| Indonesia | ×1,05 · +0 · ×1,0 | ×0,95 · +2 · ×1,0 | ×1,10 · +3 · ×0,95 | Nhiệt đới ẩm 0–2.000 m: cả ba giống, mít hợp nhất |

Đọc ô: *sản lượng · chất lượng · thời gian lớn*. Nơi chỉ quán không có farm nên không áp.

- Thẻ giống trong Cửa hàng hiện một dòng "Hợp vùng ✓ / Trung tính / Kém hợp ✗" (chữ + icon). Số hệ số cụ thể chỉ hiện khi đã mở Key **Nature** ([decode-awaken](../../shared/decode-awaken.md) mục 6).
- Loại nơi vẫn ẩn tới khi chốt trùng sinh; hệ số không hiện trên bản đồ trước khi chốt.
- Đã code: khi đã có Key **Nature**, thẻ kết quả (sau khi chốt) của nơi có farm thêm mục «Hệ số vùng theo giống» — mỗi giống một dòng: ✓/–/✗ + Hợp vùng/Trung tính/Kém hợp + sản lượng · chất lượng · thời gian lớn. Cờ `hasNature` truyền vào `createWorldMap` (không đọc cả save). Bản đồ chỉ mở từ cổng thiên đàng nên lớp này chỉ thấy ở lần trùng sinh sau khi đã mở Key Nature; không thêm đường mở lại bản đồ.
- Rủi ro: Colombia/Kenya đã là nơi chỉ trồng và có thưởng nhiệm vụ cao hơn; thêm phạt vối/mít có thể làm nơi này khó hơn lúc đầu (cây con khởi đầu là vối). **Đề xuất kèm:** túi hạt đầu ở Colombia/Kenya đổi thành hạt chè. Chạy sim theo vùng trước khi chốt số (D-13).

### Giao diện

- Lớp phủ toàn màn hình trên canvas; HUD thiên đàng ẩn (`body.world-map-open`). Nút ✕ góc trên trái (góc phải là ⚙️), tiêu đề giữa trên.
- **Sa bàn 3D nằm ngang, địa hình liền** (04/11: đã thử khối đùn phẳng, lưới ô lục giác, quả địa cầu, bản có cây/núi/mây; người dùng chốt bản này): `world-map/terrain.js` vẽ mặt nạ đất liền từ đường bờ biển rút gọn (`geo.js`, chiếu x = kinh độ/12, z = −vĩ độ/9) lên canvas nhỏ 720×288 (CPU), làm mờ hộp → trường mượt; một tấm lưới 330×176 lấy độ cao từ đó: đáy biển dốc lên bờ, bãi cát sát mép nước, nội địa cao dần, các dãy núi thật (Himalaya, Andes, Rockies, Alps, cao nguyên Đông Phi…) nhô lên có tuyết. Màu đỉnh theo dải khí hậu + sa mạc + độ cao. Mặt nước trong (thấy đáy nông màu ngọc), đáy biển sâu trải rộng để không lộ mép. Nắng đổ bóng thật (shadow map 2048, đi theo camera). Không cây, không mây.
- Mỗi nơi có **đường biên quốc gia rút gọn** (`outline` trong `content.js`, kinh-vĩ độ): viền vàng mờ nhấp nháy phủ theo địa hình báo chạm được, nhãn DOM nhỏ chỉ có 🚩 + tên. Không có chú giải loại.
- Việt Nam có thêm **quần đảo Hoàng Sa và Trường Sa** (`islands` của `vn` trong `content.js`): đảo cát nhỏ nổi trên mặt nước, chạm vào là chọn Việt Nam, trồi lên cùng khối Việt Nam khi chọn; nhãn chữ «Quần đảo Hoàng Sa (Việt Nam)», «Quần đảo Trường Sa (Việt Nam)» hiện khi phóng gần (chỉ đọc, không nhận chạm). Thêm 05/11/2026.
- Kéo một ngón: bản đồ bám đúng ngón tay, thả nhanh thì trôi theo quán tính, giữ yên rồi thả thì dừng; kẹp biên. Hai ngón chụm / con lăn phóng to-thu nhỏ; mũi tên/WASD trượt. Nhãn làm tròn pixel để không rung.
- Chạm vào trong viền một nước (hoặc ≤ 0,8 đơn vị với nước nhỏ), hay chạm nhãn: camera lướt tới; **khối hình quốc gia** (đùn từ đường biên, mặt cỏ, cạnh đất) **trồi lên theo lò xo** (vượt đích rồi nảy về, lắc nhẹ), cắm cờ màu kem, đổ bóng thật xuống đất, mặt ửng vàng, rồi lơ lửng nhấp nhô.
- **Không lộ loại nơi trước khi chốt:** thẻ khi chạm chỉ có tên, nơi chốn (`place`), câu gợi (`teaser`) và **thông tin địa lý**: địa hình, khí hậu quanh năm, nhiệt độ, lượng mưa, độ cao so với mực nước biển (`world.region.<id>.terrain|climate|temp|rain|elevation`). Cấm nhắc cà phê, trồng được gì, uống, quán (ví dụ Colombia ghi "Quindío · Caldas" thay vì "Trục cà phê"). Nút **Chọn nơi này** → cảnh báo "không đổi được, chỉ khi đó mới biết" → **Trùng sinh ở đây** / **Quay lại**.
- **Lộ kết quả** khi bấm Trùng sinh ở đây: lưu nơi, ẩn ✕ (Esc không đóng), các nơi khác mờ đi và không chạm được; khối quốc gia bay cao hơn, mặt khối đổi màu loại (vàng `#e0a93a` trồng + quán, xanh `#5f9a3c` chỉ trồng, đỏ đất `#b5523a` chỉ quán), cờ và viền đổi màu loại, cây/tách nảy lên, nhãn đổi icon loại. Thẻ kết quả trượt lên, viền màu loại: huy hiệu loại, ✓/✕ Nông trại, ✓/✕ Quán, 💰 bán gì, 🛒 mua gì, giống trồng, đặc trưng thật, 🎯 hai nhiệm vụ riêng kèm xu thưởng, một dòng cân bằng (dễ/khó, thưởng thấp/cao) và nút **Bắt đầu** → hoạt cảnh qua cổng.
- Lúc mở (05/11/2026, F-44): chưa chốt nơi → toàn cảnh, thẻ đáy là gợi ý thao tác, rồi VN được chọn sẵn với thẻ thu gọn (kể cả khi mở lại sau ✕); đã chốt → thẻ kết quả của nơi đó.

## Chưa làm (để sau)

- **Chợ thế giới** — sàn đơn hàng chung giữa các khu vực: đề xuất ở [market-proposal.md](market-proposal.md).

- Hợp đồng xuất khẩu / đấu giá thay bảng Đơn hàng ở nơi chỉ nông trại; chọn xuất xứ hạt nhập ở nơi chỉ quán.
- Cảnh farm/quán riêng theo nơi; giới hạn giống theo nơi; hệ số kinh tế theo nơi (giá chợ/giá nhập/giá ly) — hiện chỉ cân bằng bằng thưởng nhiệm vụ, chưa đo bằng sim. Nhiệm vụ của các nơi chỉ quán đều dùng `served` (chưa có chỉ số mang đi / điểm pha).
- Nơi chỉ quán vẫn dựng cảnh nông trại phía sau (giữ model); tab nâng cấp quán vẫn hiện ở nơi chỉ nông trại; gợi ý quán thiếu hạt vẫn nhắc "về farm".
- Mẹo thiên đàng không có tác dụng ở nơi thiếu một bên (chấp nhận ở v1).
- Asset thật: địa hình, khối quốc gia, cờ, vật mốc dựng bằng code (khối tạm có chức năng). Đường biên là bản rút gọn tay (Indonesia chỉ Sumatra, Nhật chỉ Honshu–Kyushu, Mỹ chỉ phần lục địa).

**Sửa 04/11/2026 (PT-9):** cờ/điểm mốc Việt Nam dời vào trong đường biên (108,3°E, 13,5°N; trước 107°E 13°N rơi vào Campuchia); đường biên Nhật Bản vẽ lại Kyushu–Honshu–Hokkaido, cờ ở Honshu (139,7°E, 35,7°N); `terrain.js` tô đất theo cả đường biên từng nơi nên khối trồi lên luôn nằm trên đất.
