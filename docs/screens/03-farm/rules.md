# 03 · Nông trại — Luật hiện hành

Luật và số liệu đang chạy trong code. Thời gian là thời gian game (đã nén), không phải hướng dẫn canh tác ngoài đời. Khi tài liệu và code lệch nhau, code đúng; sửa tài liệu cho khớp.

Đơn vị thời gian dùng chung (`rules.js`):

| Tên | Giá trị | Hằng số |
|---|---|---|
| Ngày lịch (thời tiết, đơn quán) | 1 phút | `DAY_MS` |
| Ngày công / một vụ cây | 6 phút | `WORK_DAY_MS = SEASON_MS` |
| Tính bù khi vắng mặt | tối đa 8 giờ | `OFFLINE_MS` |
| Cấp nông trại tối đa | 999 | `MAX_LEVEL`, `levelFor` |

## 1. Vòng chơi

Trồng → chăm → hái quả → phơi (ra nhân sạch) → rang → bán ở Chợ hoặc chuyển sang quán → mua ruộng, nâng cấp, thuê thợ. Cây là cây lâu năm: hái không xoá cây, cây sang lứa mới.

- Ba luồng tách nhau: nhiệm vụ (người chơi tự làm, mục 8), đơn quán (thợ chuẩn bị, chủ bấm chuyển, không sinh xu), bán ở Chợ (cộng xu).
- Việc thợ làm không cộng tiến độ nhiệm vụ (`owner==='player'` trong `model.js`).
- Farm vẫn chạy khi chủ ở quán.

## 2. Bản đồ và bố cục

Toạ độ (x; z) theo đơn vị thế giới. Mặt trước công trình quay về +z (phía camera).

| Vật | Toạ độ | Nguồn |
|---|---|---|
| Vùng nông trại | x −20…11, z −19…4 | `FARM_BOUNDS` |
| Rào ngoài | cách mép vùng 0,6, khép kín cả 4 phía | `environment.js` |
| Ruộng 1–4 (tâm) | (−7,4; −3,1) · (−15,4; −3,1) · (−7,4; −14,2) · (−15,4; −14,2) | `FIELDS` |
| Sân phơi | (0; −2,5) | `MACHINES` |
| Lò rang | (6; −10,5) | `MACHINES` |
| Giếng | (−16,8; −8,4), lấy nước ở phía phải | `STATIONS` |
| Ao | (0; −15,5) | `STATIONS` |
| Cửa quán | (−8,6; 1,5), thảm cửa (−8,6; 2,75) | `STATIONS` |
| Bảng đơn | (−6,3; 1,7) | `STATIONS` |
| Sạp ven đường | (−9,6; −6,8) | `STATIONS` |
| Nhà thợ | (−5,6; −6,8) | `STATIONS` |
| Cổng Hội đồng | (−3,4; 1,9) | `STATIONS` |
| Nhân vật vào farm | (−3; −0,5) | `scene.js` `reset` |

- Ruộng: lưới 4 × 3 = 12 ô, tâm ô cách nhau 1,5, ô vuông 1,35. Tổng 48 ô.
- Mỗi ruộng có rào riêng cách mép 0,4, bốn lối rộng 2,2 ở giữa mỗi cạnh. Ruộng chưa mua đóng cổng ở cả bốn lối; mua thì mở cổng.
- Đường lát: dọc x −2 (z −9…1), ngang z 0,1 (x −11,5…8), hành lang z −8,4 giữa hai hàng ruộng (x −15…8), nhánh x 3,2, x 8,5, x −4 (`environment.js` `pavedRun`).
- Ruộng chưa mua vẫn hiện ô; mỗi ruộng một biển khoá kèm giá.
- Tên trạm là bảng phẳng sát chân công trình. Ô trống có dấu cộng giữa ô; ô đang chọn viền vàng.

## 3. Camera, chạm và tìm đường

**Camera** (`scene.js`):
- Phối cảnh fov 43 (màn rộng < 700 px: 55), offset (0; 12,5; 11,5). Màn dọc (rộng < 0,6 × cao) mở ở tâm (−6,4; −0,5), zoom 0,9 (`portraitView`).
- Zoom 0,8–1,65. Kéo quá 8 px thì dịch góc nhìn (kẹp trong `FARM_BOUNDS`), không ra lệnh đi. Đi thì camera theo nhân vật.
- Chọn ô bằng raycast vào mặt luống thật; khe giữa ô không bị hút vào ô gần nhất.

**Tìm đường** (`shared/game/navigation.js`, `scene.js`):
- A* trên lưới 0,35; mỗi đoạn kiểm tra va chạm từng 0,1.
- Bán kính nhân vật 0,42; tâm nhân vật luôn cách mép `FARM_BOUNDS` ≥ 1,15.
- Vật cản chia ô 2 × 2 để truy vấn nhanh. Đường của thợ chừa thêm 0,04.
- Mỗi công trình có nhóm điểm tiếp cận (`approachOffsets`); chọn điểm tới được, không ép vào điểm gần mà kẹt.
- Thân cây, rào, công trình, đồ trang trí đã xây là vật cản. Tán lá, luống không chặn.

## 4. Đất, cây và chăm sóc

### Mua ruộng

| Ruộng | Giá | Điều kiện |
|---|---|---|
| 1 | có sẵn | — |
| 2, 3, 4 | 120 / 180 / 300 xu | Liền kề ruộng đã có (cạnh chung trong lưới 2 × 2) |

- Chạm ô hoặc biển ruộng khoá: nhân vật đi tới biển. Tới nơi: đủ xu và liền kề thì mở xác nhận; thiếu xu thì báo số xu thiếu. Chỉ trừ xu khi bấm xác nhận; model kiểm tra lại (`act(field,'expand')`).

### Giống

| Giống | id | Giá hạt | Mở từ cấp | Cây con | Mỗi lứa | Sản lượng gốc | Hệ số giá |
|---|---|---|---|---|---|---|---|
| Vối | `robusta` | 10 xu | 1 | 90 s | 360 s | 3000 g | 1 |
| Chè | `arabica` | 20 xu | 2 | 120 s | 360 s | 2600 g | 1,3 |
| Mít | `liberica` | 30 xu | 3 | 150 s | 396 s | 3400 g | 1,5 |

Nguồn: `CROPS`. Cây con xong chỉ thành cây trưởng thành, chưa có quả; lứa đầu chín sau (cây con + một lứa).

### Chỉ số cây

| Chỉ số | Luật | Nguồn |
|---|---|---|
| Gieo | nước 50, cỏ 0, chất lượng 80, sức khoẻ 100; trừ 1 hạt khi gieo xong | `act` `plant` |
| Nước | giảm 0,085/s ÷ `efficiency(đất)`, kể cả khi quả đã chín | `CARE`, `advance` |
| Cần tưới | nước < 35, trừ giai đoạn khô có kiểm soát (cây trưởng thành, tiến độ 17–23%) | `plotCare` |
| Tưới | tốn 1 lượt nước trong bình, đặt nước = 70 | `act` `water` |
| Cỏ | tăng 0,035/s; cần làm cỏ khi ≥ 30 (cây chưa chín); làm cỏ về 0 | `CARE` |
| Ngừng lớn | nước ≤ 15 (ngoài giai đoạn khô) hoặc cỏ ≥ 75 | `plotCare` |
| Bón phân | mỗi lứa 1 lần; chưa bón, còn phân, nước ≥ 30, tiến độ 30% đến < 65% (cây trưởng thành thêm cửa sổ < 17%) | `plotCare` `canFeed` |
| Tỉa cành | mỗi lứa 1 lần; cây trưởng thành, chưa chín, tiến độ ≤ 17% | `act` `prune` |
| Cuốc | đưa ô về trống, không hoàn hạt, không nhận quả | `act` `clear` |

- Tưới xong (70) khoảng 412 s sau mới khát; vừa gieo (50) khoảng 176 s. Cỏ từ 0 tới 30 mất khoảng 857 s.
- Phân không làm cây lớn nhanh hơn (`CARE.fedSpeed = 1`). Hết phân cây vẫn lớn.

**Sức khoẻ** (sàn 20, trần 100):
- Giảm 0,0008/s khi cây đứng (thiếu nước/cỏ nhiều); hồi 0,0003/s khi đang lớn.
- Hàng rào bền < 25: giảm thêm 0,0002/s.
- Tốc độ lớn × (0,65 + 0,35 × sức khoẻ/100) ÷ hệ số thời gian vùng.

### Mưa

- Mưa vào ngày lịch thứ 4 và 5 của mỗi chu kỳ 7 ngày (mỗi ngày 1 phút) (`weatherAt`).
- Mưa cộng 0,28 nước/s cho cây và bể giếng.

### Hái và sản lượng

Khi cây chín (`advance`):
- Sản lượng = gốc × (0,7 + 0,3 × sức khoẻ/100) × `careYield` × hệ số sản lượng vùng.
- Chất lượng = 55 + sức khoẻ × 0,25 + `careQuality` + cộng chất lượng vùng (kẹp 0–100).

| Chăm | Sản lượng | Chất lượng |
|---|---|---|
| Bón phân | × 1,15 | −6 |
| Tỉa cành | × 0,9 | +10 |
| Không làm | × 1 | 0 |

Nguồn: `careYield`, `careQuality`.

- Hái lấy cả sản lượng chín, cây về lứa mới (reset tiến độ, lượt bón, lượt tỉa; giữ nước, cỏ).
- Hái cần kho đủ chỗ cho cả lứa; thiếu thì báo số gram còn trống và cần.
- Mẹo `ripe` (Hội đồng): người chơi tự hái được +5 chất lượng.
- Quả tươi để quá 1 ngày lịch mất 0,003 chất lượng/s, sàn 20.
- Vắng mặt: tính bù tối đa 8 giờ, cây không chết.

### Hệ số vùng

`[sản lượng ×, chất lượng +, thời gian lớn ×]`, nguồn `REGION_CROP`. Nơi chỉ có quán không có farm.

| Vùng | Vối | Chè | Mít |
|---|---|---|---|
| Việt Nam `vn` | 1,10 · 0 · 1 | 0,95 · +3 · 1 | 1 · 0 · 1 |
| Brazil `br` | 1,05 · −3 · 1 | 1,10 · 0 · 1 | 0,85 · −5 · 1,1 |
| Colombia `co` | 0,80 · −8 · 1,1 | 1 · +8 · 1,1 | 0,80 · −8 · 1,1 |
| Kenya `ke` | 0,80 · −8 · 1,1 | 0,95 · +10 · 1,1 | 0,80 · −8 · 1,1 |
| Indonesia `id` | 1,05 · 0 · 1 | 0,95 · +2 · 1 | 1,10 · +3 · 0,95 |

Nhãn hợp vùng (`regionFit`): sản lượng ≥ 1,05 hoặc chất lượng ≥ +5 là "hợp"; sản lượng ≤ 0,9 là "kém".

## 5. Thao tác của người chơi

- **Chạm cây** = công cụ Tự chọn: nhân vật đi tới và làm việc cây cần nhất.
- **Chạm cây chín luôn là hái**, kể cả khi đang cầm công cụ khác. Hái không được thì báo lý do có số (kho đầy, thợ đang giữ ô).
- **Chạm ô trống**: viền sáng đúng ô, nhân vật đi tới, dải icon giống hiện phía dưới. Không mở modal, không làm tối bản đồ, đổi ô được ngay. Hết giống thì có nút sang Sạp.
- **Chạm cây không cần việc**: báo giai đoạn và bao lâu nữa cần tưới.
- **Kéo-gieo** (có từ save mới): kéo túi hạt từ dải giống qua nhiều ô trống. Giới hạn = số hạt giống đó. Hạt trừ khi gieo xong từng ô.
- **Dải công cụ ⛏️** (tưới, bón, làm cỏ, tỉa, hái 🧺, cuốc) mở theo mốc `tools` (mục 9). Trước mốc chỉ có chạm từng cây và kéo-gieo.

Luật kéo (`tools.js`, `ui.js`):
- Danh sách ô không trùng; kéo lùi về ô trước thì bỏ các ô sau. Tới giới hạn (số hạt, lượt nước, phân; 🧺 = số cây chín kho còn vừa, `harvestCapacity`) thì không nhận ô mới.
- Thả tay mới xếp việc; làm lần lượt, trừ vật tư khi làm xong. Thả về dải hoặc huỷ cử chỉ thì huỷ. Lệnh di chuyển khác huỷ việc chưa làm. Kéo không tự mua ruộng.
- Ô chờ sáng viền nhạt kèm số thứ tự 1, 2, 3… (`setPlotQueue`); ô đang làm sáng đậm.
- Ngón tay trong dải 48 px sát mép màn: camera trôi 7 đơn vị/s (nửa nếu giảm chuyển động), kẹp trong `FARM_BOUNDS` (`edgeScrollDrag`).

Thời gian thao tác của người chơi = gốc ÷ `efficiency(cấp Dụng cụ)`. Gốc (giây): tưới 1,8 · làm cỏ 2,2 · bón 1,8 · hái 2,5 · lấy nước 1,5 · nhận mẻ 1,5 · bắt đầu mẻ 1,5 · đảo 1,8 · tỉa 2,5 · gieo 2,2 · cuốc 2,5 (`workDuration`).

### Nước

- Bình tưới chứa 6 + 4 × (cấp Giếng − 1) lượt; mẹo `water` cộng 2.
- Lấy nước ở giếng trừ vào bể giếng. Bể chứa 60 × `capacityScale(cấp Ao)`.
- Bể hồi 0,06 + 0,025 × (cấp Giếng − 1) mỗi giây, cộng mưa.
- Bình đầy thì báo đầy. Bể cạn thì Cần xử lý nhắc ra giếng.

### Hàng rào

- Độ bền giảm 0,0001/s ÷ `efficiency(cấp Hàng rào)`.
- Dưới 25 thì cây mất sức khoẻ thêm. Sửa 5 xu → 100 (`act('fence','repair')`).

## 6. Chế biến

| Trạm | 1 phần vào → ra | Thời gian/mẻ cấp 1 | Sức chứa đầu vào/mẻ cấp 1 |
|---|---|---|---|
| Sân phơi `dryer` | 600 g quả → 100 g nhân sạch | 30 s | 18 kg |
| Lò rang `roaster` | 100 g nhân sạch → 84 g hạt rang | 18 s | 1 kg |

Nguồn: `MACHINES`. Không có máy xay ở farm. Bột (`ground`) cũ trong kho vẫn bán được.

- Nguyên liệu trừ ngay khi xếp mẻ.
- Mỗi trạm chạy 1 mẻ một lúc. Mẻ sau bắt đầu khi mẻ trước xong.
- Yêu cầu lớn hơn sức chứa tự chia thành nhiều mẻ nối tiếp.
- Thời gian mẻ = gốc ÷ `efficiency(cấp)`; sức chứa = gốc × `capacityScale(cấp)`. Mẻ đã xếp giữ thông số lúc xếp.
- Hàng chờ tối đa 48 mẻ mỗi trạm, tính cả mẻ xong chưa nhận. Vượt thì xếp phần vừa và báo `Đã xếp x/y phần`.
- **Đảo** (chỉ sân phơi): mỗi mẻ 1 lần, từ nửa thời gian tới lúc xong; +2 chất lượng mẻ.
- **Huỷ**: chỉ mẻ chưa chạy; trả nguyên liệu, các mẻ sau dồn lên.
- **Nhận**: chỉ lấy các mẻ xong vừa kho, phần còn lại giữ ở trạm. Chất lượng đầu ra = trung bình lô đầu vào.

Giao diện:
- Chạm thân trạm mở modal: nâng cấp, chọn số phần (mặc định tối đa), nút Bắt đầu, danh sách mẻ có Nhận tất cả/Nhận từng mẻ.
- Chạm giỏ thành phẩm trên trạm: đi tới rồi nhận. Mỗi trạm chỉ một dấu trạng thái trên bản đồ.

## 7. Kho, Chợ và đơn

### Kho

- Kho tính theo tổng gram các lô, không theo số ô. Sức chứa = 60.000 g × `capacityScale(cấp Kho)` (`ASSETS` `storage`).
- Lô có loại hàng, giống, chất lượng, nguồn, thời điểm. Xuất kho lấy lô cũ trước.
- Ba vị trí tách nhau: kho farm, hàng đang chuyển, kho quán.
- Kho đầy không mất hàng: chặn hái và nhận mẻ, báo ở Cần xử lý.
- Túi có tab Tất cả / Hạt giống / Nông sản (Vật tư chỉ hiện khi có). Hạt giống trong túi chỉ để xem.

### Mua (Sạp)

- Hạt giống: theo bảng giống, chỉ giống đã mở theo cấp.
- Phân bón: 1 xu/túi (`FERTILIZER_PRICE`).
- Mỗi lần mua 1–99; có modal xác nhận món, lượng, tổng xu.

### Bán ở Chợ

Giá một lần bán:
- Giá gốc = gram × giá/gram × hệ số giá giống × (0,3 + 0,8 × chất lượng/100).
- Chất lượng tính theo các lô sẽ xuất (cũ trước). Nguồn: `saleQuote`, `marketQualityFactor`.

| Hàng | Giá/gram |
|---|---|
| Quả `cherries` | 0,004 xu |
| Nhân sạch `dried` | 0,04 xu |
| Hạt rang `roasted` | 0,07 xu |
| Bột `ground` | 0,072 xu |

**Chợ bão hoà** (mỗi ngày công 6 phút, `MARKET_DAILY = 1200`, `marketValue`):
- Giá biên giảm tuyến tính từ 100% về sàn 30% khi đã bán 840 xu giá gốc trong ngày công; sau đó giữ 30%.
- Tính theo tích phân: bán một lần hay chia nhỏ nhận như nhau.
- Lượng đã bán lưu ở `market.sold`; tải lại không hồi giá. Sang ngày công mới thì hồi.

Luật khác:
- Bán theo gram, mặc định bán hết; không giới hạn 99. Có modal xác nhận.
- Bật "Giữ hạt rang cho quán" có thể chặn bán hạt rang dưới lượng quán cần (mặc định tắt).
- XP bán = ⌊xu nhận/2⌋, tối đa 40 XP mỗi ngày công (`MARKET_XP_CAP`).

### Đơn Chợ (đơn cố định)

- 200 g hạt rang, giống xoay vòng trong các giống đã mở (`makeOrder`).
- Thưởng = 1,2 × giá gốc (vối 17 xu). Lô giao trung bình chất lượng ≥ 85 được × 4/3 (≈ 1,6 × giá gốc) (`orderPay`).
- Tối đa 2 đơn mỗi ngày công (`ORDERS_PER_DAY`). +14 XP.
- Nhận đơn thì có hạn 8 phút; quá hạn thì đơn mới thay.

### Đơn quán (chỉ nơi có cả farm và quán)

- Tự sinh khi farm có ít nhất 1 thợ. Mỗi ngày lịch (1 phút) bù cho đủ 2 đơn mở/đang chuyển: 252 g rồi 168 g hạt rang, hạn 8 phút (`refreshDaily`).
- Quán có thể gọi thêm đơn 252 g, tối đa 4 đơn quán mở/đang chuyển (`act('cafe','order')`).
- Đơn đã giao xoá sau 7 ngày lịch. Quá hạn thì đơn thành hết hạn.
- **Chuyển về quán · 2 xu**: cần đủ hạt rang, 2 xu, kho quán còn chỗ (kho quán dùng cùng sức chứa với kho farm).
- Chuyến hàng mất 10 s ÷ `efficiency(cấp Giao hàng)`. Giao đúng hạn được 5 sao, trễ 3 sao.
- Chuyển hàng tự do (không theo đơn): tối đa 1000 g × `capacityScale(cấp Giao hàng)` mỗi chuyến, 2 xu (`act('cafe','ship')`).

- Bảng Đơn hàng có 3 tab: Cần làm (chọn thợ) · Chờ chuyển (đủ hàng; Chuyển hết) · Đang chuyển. Đơn gần hạn xếp trước. Chi tiết đơn có 5 bước (`orders.js`).

Nơi chỉ có quán: hạt nhập 500 g giá 45 xu (`SUPPLIER_PRICE_CAFE_ONLY`; nơi khác 75). Hết hạt và hết xu thì nhận cứu trợ 300 g mỗi ngày công (`RELIEF_GRAMS`). Luật dùng hạt ở quán: xem màn 04.

## 8. Nhiệm vụ, XP và cấp

Chuỗi gốc (`QUESTS`, theo thứ tự, mỗi mục một lần):

| id | Việc | Đạt khi | Thưởng |
|---|---|---|---|
| `harvest` | Hái lứa đầu | hái 1 lần | 10 xu, 4 XP |
| `serve` | Bán ly đầu ở quán | 1 ly tự pha | 15 xu, 6 XP |
| `dry` | Phơi mẻ đầu | nhận 1 mẻ phơi | 10 xu, 4 XP |
| `roast` | Rang mẻ đầu | nhận 1 mẻ rang | 10 xu, 4 XP |
| `sell` | Bán ở Chợ | bán 1 lần | 15 xu, 6 XP |
| `ship` | Gửi hạt rang về quán | chuyển hàng | 10 xu, 5 XP |
| `expand` | Mua ruộng 2 | mua 1 ruộng | 10 xu, 5 XP |
| `water` | Tưới | tưới 1 lần | 5 xu, 3 XP |
| `weed` | Làm cỏ | làm cỏ 1 lần | 5 xu, 3 XP |

Theo loại nơi (`questsFor`):
- Nơi chỉ nông trại bỏ `serve`, `ship`.
- Nơi chỉ quán chỉ giữ `serve`.
- Mỗi nơi thêm 2 nhiệm vụ riêng (`REGION_QUESTS`):

| Nơi | Nhiệm vụ riêng (chỉ số ≥ số) |
|---|---|
| vn · br | 30 ly · giao 1000 g / phơi 1000 g · 40 ly |
| co · ke · id | hái 15 lần · bán 1500 g hạt / rang 1000 g · bán 1000 g hạt / phơi 1500 g · 2 ruộng |
| it · jp · us | 10 · 40 ly / 12 · 30 ly / 25 · 60 ly |

- Chỉ thao tác của người chơi được tính. Save cũ giữ `claimed`; đổi thứ tự không trả lại hay xoá thưởng.
- **Thẻ mục tiêu** (HUD trái) hiện nhiệm vụ kế tiếp. Chạm thẻ: nhân vật đi tới đúng chỗ (cây cần việc, trạm, biển ruộng, công trình); nhiệm vụ Bán mở Sạp tab Chợ.
- Lần đầu thẻ nhấp nháy, có dòng "Chạm để được dẫn đường" và mũi chỉ 3D. Tắt khi chạm thẻ lần đầu (cờ `quest-guide`) hoặc đã nhận `roast`; sau đó mũi chỉ hiện 6 s mỗi lần chạm.
- Hết chuỗi: thẻ gợi ý việc tiếp theo (`freeGoal`). Thứ tự: gặp Hội đồng → hái → tưới → làm cỏ → nhận mẻ → gieo → mua ruộng → bán/phục vụ.

XP nông trại (`model.js`, `progression.js`):

| Nguồn | XP |
|---|---|
| Hái 1 cây | 6 |
| Nhận mẻ | 4 mỗi mẻ |
| Đơn Chợ | 14 |
| Bán ở Chợ | ⌊xu/2⌋, trần 40/ngày công |
| Ly tự pha bán được | 1 + số sao |
| Mốc món ★★ / ★★★ | 15 / 30 (một lần) |
| Ký ức cà phê | 3 (ly game) / 5 (ly thật), +5 có cảm nhận; trần 30/ngày công |
| Giải mã | 20 |

- Cấp 1–10 theo bảng `LEVEL_XP` (0, 30, 90, 190, 350, 600, 950, 1400, 2000, 2800).
- Sau cấp 10: 2800 + 850 × (cấp − 10) + 50 × (cấp − 10)², tới 999 (`xpForLevel`).

**Mục tiêu thắng kinh tế** (`economicStatus`, ghi một lần vào `victories.economic`):
- Tài sản ≥ 300.000. Tài sản = xu + giá ruộng + tiền đã nâng cấp + thiết bị quán + đồ trang trí.
- Nơi có farm thêm: đủ 4 ruộng.
- Nơi chỉ nông trại thêm: mọi công trình farm cấp ≥ 15.
- Nơi có cả hai thêm: uy tín quán ≥ 85.
- Nơi chỉ quán: điều kiện riêng ở màn 04.

## 9. HUD và công trình

**Bố cục HUD** (`ui.js`, `hud-drawer.js`): trái là avatar, cấp, XP và thẻ mục tiêu; phải là ô xu (chạm: lia tới Sạp, mở tab Giống); dưới là 🎒 Kho và ≡ Quản lý. ≡ chứa Cửa hàng, Vào quán, Nâng cấp, Nhân viên, Đơn hàng, Xây dựng, Hướng dẫn, Cài đặt, Cần xử lý, Hoạt động. Nút Auto riêng.

**Mở dần** (`HUD_UNLOCKS`). Mỗi mục mở khi bất kỳ điều kiện nào đúng; save cũ đã qua mốc thấy ngay, không toast.

| id | Mở khi | Ghi chú |
|---|---|---|
| `cafe-play` | Đã nhận `harvest`, hoặc đã bán ly, hoặc quán có doanh thu | Chỉ nơi có cả hai |
| `seed-shop` | Tới nhiệm vụ `sell`, hoặc đã bán, hoặc có ô trống mà hết giống | |
| `order-board` | Tới nhiệm vụ `ship`, hoặc đã có đơn | Chỉ nơi có cả hai |
| `upgrades` | Cấp ≥ 2, hoặc có hạng mục > cấp 1 | |
| `workers` | Đã nhận `expand`, hoặc có thợ, hoặc cấp ≥ 3 | Cùng lúc tặng Gói thử robot ở quán |
| `build` | Đã nhận `weed`, hoặc có đồ trang trí, hoặc cấp ≥ 4 | |
| `tools` | Đã nhận `expand`, hoặc có ≥ 2 ruộng, hoặc cấp ≥ 3 | Dải ⛏️ và kéo nhiều ô (trừ kéo-gieo) |

- Mục vừa mở khi đang chơi: chấm "Mới" + toast một dòng. Cờ đã báo: `unlock-<id>` trong `tutorial.seen`.
- Cần xử lý và Hoạt động gập sẵn, tiêu đề có số mục. Mục khẩn (hết xu trả lương, kho đầy) làm tiêu đề nháy.
- Toast ở giữa phía trên, tự tắt sau 3 s, không chặn thao tác. Hoàn thành nhiệm vụ và lên cấp đứng đầu.

**Công trình thay nút** (`BUILDINGS`, `syncBuildings`):

| Công trình | id | Mốc | Chạm |
|---|---|---|---|
| Cửa quán | `cafe-entrance` | `cafe-play` | Đi tới thảm cửa rồi vào quán; ra quán đứng trên thảm |
| Bảng đơn | `order-board` | `order-board` | Mở Đơn hàng tại chỗ |
| Sạp ven đường | `seed-shop` | `seed-shop` | Mở Cửa hàng 3 tab Giống / Vật tư / Chợ tại chỗ |
| Nhà thợ | `crew-house` | `workers` | Mở Nhân viên 4 tab tại chỗ |

- Hiện khi mốc mở hoặc đã có cờ `unlock-<id>`; đã hiện thì không ẩn lại. Nơi chỉ nông trại không có Cửa quán và Bảng đơn.
- Mở lúc đang chơi: công trình trồi lên, có hạt sáng, mũi tên chỉ 6 s và toast "Đã dựng…". Biển ✨ Mới tới lần dùng đầu (cờ `unlock-<id>-used`).
- Mốc tới giữa tutorial ép: chờ xong, toast "xong hướng dẫn" trước, 3 s sau mới dựng.
- Chạm Sạp, Bảng đơn, Nhà thợ: nhân vật quay mặt về vật, không đi bộ; huỷ việc tay đang làm.
- Lối tắt từ xa (≡, thẻ mục tiêu, ô xu, Cần xử lý, «Thuê robot thay»): lia camera tới công trình (650 ms) rồi mở; đóng thì camera về nhân vật.

Huy hiệu:
- Sạp `!` và cờ đỏ khi hết giống mà còn ô trống.
- Bảng đơn: `✓` khi có đơn giao được; không thì số đơn chờ; số tờ giấy trên bảng = số đơn chờ (≤ 4).
- Nhà thợ: ghế có bóng thợ đang tạm dừng (≤ 2).
- Cửa quán sáng đèn khi quán mở.
- `⬆` trên trạm, giếng, ao khi vừa đủ cấp vừa đủ xu nâng (`upTag`). Giếng bình đầy mà có ⬆ thì chạm mở khối nâng cấp giếng.

**Cổng Hội đồng** (`council`):
- Ẩn tới khi chuyên gia đầu có mặt, rồi trồi lên. Ba bệ hiện bóng chuyên gia đã có mặt; có người chờ thì có cầu sáng và biển «Mới».
- Chạm mở hội thoại đáy màn tại chỗ, không đi bộ. Đang làm việc tay thì báo bận (Auto thì vẫn mở).
- Chuyên gia có mặt (`councilCheck`):
  - Nông: xong `farm-intro` và đã hái.
  - Pha Chế: đã bán ly (nơi chỉ nông trại: đã bán ở Chợ).
  - Thương Hội: sau ca quán thường đầu tiên (nơi chỉ nông trại: ngày công kế tiếp sau khi Pha Chế có mặt).
- Mỗi lượt gặp 1 chuyên gia với các câu chưa gặp.
- Đúng: nhận mẹo. Sai: hỏi lại sau, tối đa 1 câu mỗi ngày công, hoặc ôn ở Sổ tay.
- Mẹo có tác dụng ở farm: `ripe` hái tay +5 chất lượng, `water` bình +2 lượt, `costs` +30 xu. Mẹo còn lại tác dụng ở quán.

## 10. Tutorial và gợi ý lần đầu

**Tutorial ép `farm-intro`** (`intro.js`, `syncIntro`). Save mới bị dẫn 4 bước. Chỉ dẫn gồm bàn tay chỉ, viền sáng/mũi chỉ 3D trên đích và một dòng chữ. Bước suy ra từ state, không lưu bước dở.

| Bước | Dẫn | Xong khi |
|---|---|---|
| Gieo | Chạm 1 ô trống, chọn túi hạt; sau đó kéo túi hạt qua 2 ô liền kề | Có 3 cây con (`INTRO_SOW`), hoặc ô trống còn ≤ 1, hoặc hết hạt |
| Hái | Chạm cây chín | `stats.harvested ≥ 1` |
| Phơi | Chạm sân phơi, «Bắt đầu»; xong thì chạm giỏ nhận | `stats.dried ≥ 1` |
| Rang | Như phơi, ở lò rang | `stats.roasted ≥ 1` |

- Save mới có 8 cây quà ở ruộng 1: 4 cây chín, 4 cây đang lớn; còn 4 ô trống.
- Ở bước gieo, chạm cây quà chín không hái, chỉ nhắc lại chỉ dẫn.
- Trong lúc ép:
  - Khoá Vào quán, Cửa hàng, ô xu, thẻ mục tiêu, các công trình.
  - Ẩn nút Auto (không trừ lượt).
  - Không hỏi lại câu Hội đồng; toast mở khoá chờ tới khi xong.
- Không kẹt: bước không làm được thì bỏ ép và ghi xong. Ví dụ: hết hạt, hết cây chín, trạm không đủ nguyên liệu cho 1 mẻ.
- Save đã chơi qua (đã bán, giao, mở ruộng, hoặc đã phơi và rang) coi như xong (`introPlayed`).
- Save cũ thiếu dấu `farm-intro-new`, hoặc nơi chỉ quán: không ép.
- Xong: toast "Xong bước đầu", các nút trở lại bình thường.

**Gợi ý điều khiển lần đầu** (cờ `controls`):
- Khung nhỏ theo thiết bị: chuột (bấm đất, WASD, cuộn, kéo) hoặc cảm ứng (joystick, chạm cây, kéo màn).
- Tắt khi đã đi > 1 đơn vị và làm xong một việc, sau 15 s, hoặc bấm ×. Không hiện lại.

**Dải ⛏️ lần đầu** (cờ `tools`): một dòng hướng dẫn kéo. Tắt sau lần thả công cụ ⛏️ đầu; kéo-gieo không bật cờ này.

## 11. Nhân viên farm

### Slot và việc

| | Người | Robot vườn |
|---|---|---|
| Ứng viên | An, Bình, Chi, Dũng, Hà, Linh, Minh, Nam | `robo-n1`…`robo-n3` |
| Phí tuyển | 150–180 xu | 0 |
| Lương mỗi ngày công | 30 + 10 × (cấp − 1) xu | 15 xu cố định |
| Trả trước | 1 ngày công | Gói 1 / 5 / 10 ngày công = 15 / 68 / 113 xu |
| Việc | 1 mảng; cấp 4 → 2 mảng; cấp 7 → cả 3 | Đúng 1 việc: tưới, làm cỏ, chế biến hoặc giao |
| Cấp | 1–10; đào tạo 40 × cấp xu; mỗi cấp +2 mọi chỉ số; +5 XP mỗi việc xong | Luôn cấp 1, không đào tạo |
| Sự cố, lười | Có | Không |

Nguồn: `WORKER_CANDIDATES`, `workerWage`, `packPrice`, `groupLimit`, `activeJobs`.

- Farm có 3 slot chung, trộn người/robot tuỳ ý (`FARM_SLOTS = 3`). Thuê là vào làm ngay; không có đội dự bị.
- Mảng việc: chăm cây (trồng, tưới, bón, làm cỏ, tỉa, hái) · chế biến · giao hàng.
- Thuê mới tự nhận mảng (người) hoặc việc (robot) mà đội đang thiếu.
- Bật mảng vượt giới hạn cấp thì bị từ chối. Robot bật việc mới thì việc cũ tự tắt.
- Robot không trồng, bón, tỉa, hái. Robot vẫn tính là thợ để farm nhận đơn quán.
- Robot speed 70, dexterity 70: nhanh hơn Nam cấp 1 khoảng 5–6% ở việc vặt; Nam bằng robot ở cấp 6, vượt từ cấp 7.
- Cho nghỉ việc (× trên ô thợ hoặc trong hồ sơ): không hoàn phí tuyển và ngày đã trả. Người đã cho nghỉ không thuê lại được; robot thì được.
- Lương tự trả khi còn < 30 s nếu bật Tự gia hạn (mặc định bật) và đủ xu. Trả thêm thì cộng dồn từ lúc hết hạn. Thất bại thì thử lại mỗi 10 s.
- Hết hạn: thợ dừng an toàn, trả lại việc đang giữ, Cần xử lý báo gia hạn.
- Vắng mặt (tắt game/ẩn tab > 60 s): thời gian đã trả và ngày ốm được dời, không tiêu.
- Tốc độ đi = 0,75 + 0,5 × speed/100. Tốc độ làm = 0,7 + 0,35 × speed/100 + 0,25 × dexterity/100 (`crew.js`).

### Chỉ thị nông trại

Tab Chỉ thị trong Nhân viên (`directives`, mặc định bật hết):
- Tự chăm vườn.
- Trồng lấp ô trống (chọn giống).
- Dùng phân bón.
- Tự chế biến: phơi hết quả chín; chỉ rang đủ đơn đang mở và phần quán thiếu.

Thợ làm theo chỉ thị cả khi không có đơn. Đơn quán chỉ cộng ưu tiên cho người phụ trách.

### Chia việc và di chuyển

- Phân công lại mỗi 0,65 s hoặc khi dữ liệu đổi (`crew.js`).
- Mỗi thợ rảnh lấy 6 việc điểm cao nhất. Duyệt mọi cách gán cho tối đa 3 thợ, không hai người cùng mục tiêu; chọn tổng điểm cao nhất.
- Điểm = ưu tiên × 10 + thưởng chờ lâu (≤ 36) + 15 nếu thuộc đơn được giao + 2 nếu đúng vai + kỹ năng/100 − 1,2 × thời gian đi + 8 nếu đứng sát; thêm 25 cho bắt đầu mẻ khi kho còn < 15%.
- Việc ngoài mảng đang bật bị loại.
- Bảng giữ chỗ chung (`reserve`): thợ không nhận việc người khác giữ và nhường việc người chơi đang đi tới.
- Vùng cây (≥ 2 thợ đang làm): đủ ruộng thì mỗi người một ruộng, không thì chia cột. Thợ khác chỉ vào vùng khi chủ vùng không làm được việc đó.
- Bị người chặn: người rảnh tránh sang bên. Chặn > 0,8 s thì đi xuyên người 1,2 s; đứng chờ người > 1,5 s thì xuyên 1,5 s. Không bao giờ xuyên tường, rào.
- Kẹt vật cố định quá 3 lần tính lại đường thì bỏ việc 4 s.

### Lười, mệt (chỉ người; `shared/game/morale.js`)

- Năng lượng E 0–100, sống theo phiên. Tính cách cố định theo id (1 : 2 : 1): siêng (gốc 0,02, hao × 0,8) · thường (0,05, × 1) · lười (0,14, × 1,3). Mỗi người ghét 1 mảng.
- Mỗi việc xong E −1,5 × hệ số hao; rảnh E +0,1/s; nghỉ mệt xong +30.
- Đầu mỗi việc quay: p = gốc + 0,4 × (1 − E/100)² + 0,15 nếu mảng ghét, trần 0,6. Trúng thì nghỉ: 😮‍💨 mệt (E < 35) 10 s · 🙅 ghét việc 3 s · 🥱 lười 8 s.
- Mệt làm chậm: thời gian × (1 + 0,4 × (1 − E/100)), tối đa × 1,4.

### Sự cố (chỉ người)

Quay 1 lần khi trả mỗi ngày công (`signContract`, `rollIncident`).

| Sự cố | Xác suất gốc | Khi nào | Tác dụng |
|---|---|---|---|
| Mải chơi 📱 | 0,12 | 20–80% ngày công | Đứng yên, nhả việc, tối đa 40 s. «Nhắc» (chạm thợ hoặc trên toast) cho làm lại ngay |
| Nghỉ ốm 🤒 | 0,04 | Đầu ngày công | Nghỉ trọn 1 ngày công, không mất lương (hạn đã trả dời thêm 1 ngày) |

- Xác suất × max(0,4; 1 − 0,07 × (cấp − 1)) (`INCIDENTS`, `incidentOdds`).
- Không có sự cố khi:
  - Thợ mới ở 2 ngày công đầu.
  - Người chơi đang ở quán.
  - Uy tín quán < 30.
  - Thời điểm sự cố đã qua > 10 s mà farm không chạy (huỷ, không dời).
- Nghỉ ốm được miễn khi farm chỉ có đúng 1 thợ và thợ đó đang giữ đơn quán mở.
- Thợ ốm vẫn trả lương tay được; trạng thái ốm giữ qua tải lại.
- «Giao đội làm đơn» bỏ qua người đang ốm.
- «Thuê robot thay» hiện khi farm còn slot trống (`canHireRobotCover`); bấm thì lia tới Nhà thợ và mở tab Robot.

Modal Nhân viên có 4 tab: Farm hiện tại · Người · Robot · Chỉ thị. Chạm đúng hình thợ trên bản đồ mở hồ sơ.

## 12. Chế độ Auto

- 3 lượt miễn phí × 10 phút (`AUTOPLAY`); giờ chỉ trôi khi Auto chơi. Chỉ ⏸ hoặc hết giờ mới dừng.
- Khi bật: camera vẫn kéo/zoom được; chạm bản đồ, joystick, phím di chuyển bị bỏ qua; chạm thợ và công trình vẫn mở tại chỗ (Cửa quán vào thẳng). Mở modal không dừng Auto; Auto không đóng cửa sổ người chơi mở.
- Auto đi bằng luồng chạm thật của người chơi, nên luật và nhiệm vụ tính như tự làm (nguồn `via:'auto'` chỉ dùng cho mẫu giải mã).
- Việc ruộng/trạm (`pickAutoTask`): điểm = ưu tiên × 10 − 1,2 × khoảng cách. Ưu tiên: hái 6 · nhận mẻ 5 · tưới, lấy nước 4,5 · đảo 4 · bắt đầu mẻ 3,5 · làm cỏ 3 · trồng 2,5 · bón 2 · tỉa 1. Bỏ việc thợ đang giữ; trạm có ≥ 3 mẻ chờ thì không xếp thêm.
- Hậu cần khi hết việc ruộng (`pickAutoErrand`), bàn tay chỉ vào công trình trước khi làm: (1) chuyển đơn quán đủ hàng · (2) giao đơn Chợ · (3) kho quán < 400 g thì gửi hạt rang dư (nơi chỉ nông trại: bán hạt rang dư) · (4) hết giống mà còn ô trống thì mua giống (giữ 20 xu, ≤ 12 hạt). Hạt dư = hạt rang trừ lượng đơn đang mở, cần ≥ 100 g.
- Auto không nâng cấp, không thuê, không tự đổi cảnh, không trả lời câu Hội đồng. Việc thất bại nghỉ 15 s.

## 13. Nâng cấp

Giá cấp L → L+1:
- L < 10: ⌈gốc × 1,42^(L−1)⌉.
- L ≥ 10: ⌈gốc × 1,42⁹ × (1 + 0,15 × (L − 10))²⌉ (`upgradePrice`).
- Lên cấp N cần nông trại cấp N.
- Cấp tối đa 20, riêng Quán 10 (`ASSET_MAX_LEVEL`). Cấp nông trại vẫn tới 999.

Hệ số (`rules.js`):
- Tốc độ `efficiency` = 1 + 0,07 × (cấp − 1), × 2,33 ở cấp 20.
- Sức chứa `capacityScale` = 1 + 0,18 × (cấp − 1), × 4,42 ở cấp 20.

| Hạng mục | id | Giá gốc | Tác dụng |
|---|---|---|---|
| Đất | `soil` | 90 | Nước giảm chậm (÷ tốc độ) |
| Hàng rào | `fence` | 80 | Độ bền giảm chậm |
| Ao | `pond` | 100 | Bể giếng 60 × sức chứa |
| Giếng | `well` | 60 | Bình +4 lượt/cấp, bể hồi nhanh hơn |
| Dụng cụ | `tools` | 75 | Thao tác người chơi nhanh hơn |
| Sân phơi | `dryer` | 100 | Mẻ nhanh hơn, chứa nhiều hơn |
| Lò rang | `roaster` | 160 | Mẻ nhanh hơn, chứa nhiều hơn |
| Kho | `storage` | 90 | 60 kg × sức chứa |
| Giao hàng | `delivery` | 100 | Chuyến nhanh hơn, chở nhiều hơn |
| Quán | `cafe` | 140 | Số bàn 3 → 10 (tối đa cấp 10) |

- Diện mạo theo bậc: Cơ bản (cấp 1), Cải tiến (10), Chuyên nghiệp (20). Mỗi bậc một slot `farm/<id>/tier-<n>`.
- Nâng cấp mở ở mục Nâng cấp trong ≡ và ngay trong modal từng trạm, kho, giếng, ao, quán.

## 14. Xây dựng trang trí

| Món | Giá | Thời gian xây |
|---|---|---|
| Bồn hoa `flowers` | 25 xu | 5 s |
| Đèn vườn `lamp` | 40 xu | 6 s |
| Biển tên `sign` (≤ 24 ký tự) | 30 xu | 5 s |

Nguồn: `DECORATIONS`, `decorationError`, `act('decorations')`.

- Đặt: bóng xanh/đỏ, xoay (nút/R), huỷ (nút/Esc); bấm đất chốt chỗ, xác nhận mới trừ xu.
- Không đặt: cách mép vùng < 1, cách ruộng < 1, cách đường < 1,15, trong 3,5 m quanh trạm/công trình (`nearBuilding`; nơi không có quán bỏ vùng của Cửa quán, Bảng đơn), cách món khác < 1,3, đã đủ 100 món.
- Xây: nhân vật tới khung thi công, chỉ cộng tiến độ khi đứng gần. Món xong là vật cản. Phá dỡ có xác nhận, 3,5 s, không hoàn xu. Chưa di chuyển được món.
- Save cũ có món trong vùng cấm: tự dời tới chỗ hợp lệ gần nhất; hết chỗ thì hoàn đủ giá (`relocateDecorations`).
- Trang trí không cộng năng suất.

## 15. Save mới và quà

Save mới (`createFarm`):
- 200 xu, 6 hạt vối, 6 phân, bình 6 lượt, bể giếng 60.
- Ruộng 1 có 8 cây quà (4 chín, 4 đang lớn).
- Kho quán có sẵn 600 g vối rang + 300 g chè rang (chất lượng 70).

Quà khởi đầu (áp một lần, cờ `giftApplied`):
- Save mới luôn nhận Túi hạt giống: +6 hạt vối, +6 phân.
- Quà `tools` (Gói mở rộng quán, quán lên cấp 2) và `capital` (+150 xu) chỉ còn ở save cũ.
- Quà không dùng được ở loại nơi đổi thành +150 xu.

Lưu và an toàn:
- Mỗi thao tác thành công lưu ngay; ngoài ra lưu mỗi ≥ 5 s.
- Mọi tiền, hàng, lương đi qua `act` của model. Hover, đổi tab hay mở xác nhận không trừ gì.
- Trần xu 5 × 10¹³. Không tự reset kho, tiền, ruộng, mẻ khi tải.
- Đồng hồ máy lùi > 60 s: mọi mốc giờ dời theo, bộ đếm giữ thời gian còn lại.
