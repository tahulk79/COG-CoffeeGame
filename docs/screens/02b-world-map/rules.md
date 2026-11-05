# 02b · Bản đồ thế giới — Luật

Luật hiện hành của việc chọn nơi và ảnh hưởng của nơi lên nông trại, quán. Màn tổng quan: [README.md](README.md).

## 1. Tám nơi

Nguồn: `RAW` trong `src/features/world-map/content.js`. Cả 8 nơi đều chọn được.

| id | Nơi | Loại | Nghĩa |
|---|---|---|---|
| `vn` | Việt Nam | `both` | Nông trại + quán |
| `br` | Brazil | `both` | Nông trại + quán |
| `co` | Colombia | `farm` | Chỉ nông trại |
| `ke` | Kenya | `farm` | Chỉ nông trại |
| `id` | Indonesia (Sumatra) | `farm` | Chỉ nông trại |
| `it` | Ý | `cafe` | Chỉ quán |
| `jp` | Nhật Bản | `cafe` | Chỉ quán |
| `us` | Mỹ (Seattle) | `cafe` | Chỉ quán |

Màu loại (`TYPE_COLOR`): `both` vàng `#e0a93a`, `farm` xanh `#5f9a3c`, `cafe` đỏ đất `#b5523a`. Icon (`TYPE_ICON`): 🌱☕ / 🌱 / ☕.

## 2. Chọn nơi

- **Loại nơi bị ẩn tới khi chốt.** Trước khi chốt, nhãn và thẻ chỉ có tên, nơi chốn (`place`), câu gợi (`teaser`) và 5 dòng địa lý: địa hình, khí hậu, nhiệt độ, lượng mưa, độ cao (`FACTS`). Chữ trước khi chốt không được nhắc cà phê, trồng, uống hay quán.
- **Chọn sẵn Việt Nam lần đầu.** Save chưa có `startingRegion` thì `src/app/game.js` truyền `preselect: DEFAULT_REGION` (`vn`). Mọi ngôn ngữ đều là `vn`.
  - Bản đồ giữ toàn cảnh (tâm x 2, z −1,5, khoảng cách 20) trong `PRESELECT_HOLD` = 0,8 giây, rồi chọn VN: camera lướt tới, khối VN trồi lên, không phát âm thanh.
  - Thẻ thu gọn: tên, nơi chốn, câu gợi, dòng gợi `world.preselectHint`, nút **Xem thêm** và **Chọn nơi này**. Dòng địa lý hiện khi chạm cờ bất kỳ (kể cả VN) hoặc **Xem thêm**.
  - Không có nhãn "khuyên dùng", không lộ loại, không có nút bỏ qua xác nhận.
  - Kéo, phóng, bấm phím di chuyển hoặc chạm cờ trước khi hết 0,8 giây thì hủy chọn sẵn.
  - Đóng rồi mở lại khi chưa chốt thì VN lại được chọn sẵn.
- **Chặn chạm sót.** Nút **Chọn nơi này** chỉ nhận chạm/Enter sau `CHOOSE_DELAY` = 1,2 giây kể từ lúc mở bản đồ.
- **Xác nhận.** **Chọn nơi này** → cảnh báo không đổi được → **Trùng sinh ở đây** / **Quay lại**.
- **Chốt.** **Trùng sinh ở đây** lưu `startingRegion` ngay, trước thẻ kết quả. Không lưu gì trước bước này.
- **Khóa vĩnh viễn.** Một save một nơi. Đã chốt thì mở lại bản đồ chỉ thấy thẻ kết quả của nơi đó.
- **Save cũ.** Không có `farm.region`/`startingRegion` hoặc id lạ → `vn` (`regionId`).

### Thẻ kết quả (sau khi chốt)

Huy hiệu loại, ✓/✕ Nông trại, ✓/✕ Quán, 💰 bán gì, 🛒 mua gì, giống trồng thực tế, đặc trưng vùng, 🎯 hai nhiệm vụ riêng kèm xu, một dòng cân bằng, nút **Bắt đầu**. Có Key Nature thì thêm mục "Hệ số vùng theo giống" (mục 5).

## 3. Luật theo loại nơi

| Phần | `both` | `farm` | `cafe` | Nguồn |
|---|---|---|---|---|
| Vào game | Nông trại | Nông trại | Tự vào quán ngay khi tải | `farm/game.js` |
| Công trình Cửa quán (`cafe-entrance`) và Bảng Đơn hàng (`order-board`) | Dựng khi tới mốc | Không dựng | Không dựng | `BUILDINGS` (cờ `both`), `HUD_UNLOCKS` |
| Vùng cấm xây quanh hai công trình trên | Có | Không | Không | `nearBuilding`, `decorations.js` |
| Nút 🌱 Nông trại trong quán, Esc rời quán | Có | — | Không có | `onExit`, `cafe/ui.js` |
| Ô 📦 Đơn hàng trong ngăn kéo quán | Có | — | Ẩn | `farmless`, `cafe/ui.js` |
| Kho quán | "Đặt farm" + "Nhập hạt ngoài" | — | Chỉ "Nhập hạt ngoài" | `cafe/ui.js` |
| Giá Nhập hạt ngoài (500 g) | 75 xu | 75 xu | 45 xu | `supplierPrice` |
| Cứu trợ hạt | Không | Không | 300 g vối rang miễn phí, mỗi ngày công một lần | `RELIEF_GRAMS`, `reliefReady` |
| Đơn quán tự sinh khi có thợ ở `farm-0` | Có | Không | Không | `farm/model.js` |
| Giữ 252 g hạt rang cho nhiệm vụ Gửi hạt khi bán nhanh | Có | Không | — | `keepForCafe`, `farm/game.js` |
| Auto (crew) với hạt rang dư | Gửi về quán | Bán chợ | — | `pickAutoErrand`, `autoplay.js` |
| Tutorial `farm-intro` | Có | Có | Bỏ qua | `farm/model.js` |
| Thẻ mục tiêu khi hết nhiệm vụ | "Bán ly" | "Bán hạt" (mở Cửa hàng → Chợ) | "Bán ly" | `farm/game.js` |
| Hội đồng | Cổng ở nông trại | Cổng ở nông trại | Mở từ quán, không có cổng ở farm | `openCouncil`, `farm/game.js` |
| Bán / mua | Bán ly ở quán, hạt dư ra chợ; mua giống, phân, vật tư quán | Chỉ bán hạt (chợ); mua mọi đầu vào | Chỉ bán ly; nhập toàn bộ hạt, sữa, ly, vật tư | thẻ kết quả `world.sell/buy.*` |

### Cứu trợ hạt (chỉ `cafe`)

Hiện nút 🆘 trong Kho quán khi đủ cả bốn điều kiện (`reliefReady`):

- Nơi loại `cafe`.
- Xu < giá nhập hạt (45).
- Hạt rang trong quán < 10 g.
- Chưa nhận cứu trợ trong ngày công này (`cafe.reliefDay`).

Nhận: +300 g vối rang, chất lượng 65. Kho quán đầy thì từ chối.

### Quà thiên đàng theo loại

Quà chọn trước khi biết loại nơi. Quà nơi đó không dùng được thì đổi thành 150 xu (`farm/model.js`):

| Quà | `both` | `farm` | `cafe` |
|---|---|---|---|
| `seeds` (+6 cây con vối, +6 phân) | Giữ | Giữ | Đổi 150 xu, có câu log riêng |
| `tools` (quán lên cấp 2) | Giữ | Đổi 150 xu | Giữ |
| `capital` (150 xu) | Giữ | Giữ | Giữ |

Save mới luôn nhận quà `seeds`.

### Chuỗi nhiệm vụ theo loại

`questsFor(region)` trong `farm/content.js`:

| Loại | Chuỗi |
|---|---|
| `both` | Chuỗi chung đầy đủ + 2 nhiệm vụ riêng |
| `farm` | Chuỗi chung bỏ "Bán ly đầu" (`serve`) và "Gửi hạt" (`ship`) + 2 nhiệm vụ riêng |
| `cafe` | Chỉ "Bán ly đầu" (`serve`) + 2 nhiệm vụ riêng |

### Hội đồng theo loại

Chuyên gia đến theo mốc (`councilCheck`, `councilArrive` trong `farm/model.js`):

| Chuyên gia | `both` | `farm` | `cafe` |
|---|---|---|---|
| Nông (`growing`) | Xong tutorial `farm-intro` và đã thu hoạch | Như `both` | Đã bán ly đầu (tutorial bị bỏ qua) |
| Pha Chế (`brewing`) | Đã bán ly đầu | Đã bán hạt lần đầu | Đã bán ly đầu |
| Thương Hội (`business`) | Kết thúc ca quán thường | Ngày công đầu sau khi Pha Chế đã đến | Kết thúc ca quán thường |

### Điều kiện thắng kinh tế theo loại

`economicStatus`, `farm/progression.js`. Phải đạt tất cả các dòng của loại đó:

| Điều kiện | `both` | `farm` | `cafe` |
|---|---|---|---|
| Tổng tài sản ≥ 300.000 xu (`VICTORY_ASSETS`) | ✓ | ✓ | ✓ |
| Mở đủ mọi ruộng | ✓ | ✓ | — |
| Mọi công trình farm (trừ quán) cấp ≥ 15 | — | ✓ | — |
| Danh tiếng quán ≥ 85 | ✓ | — | — |
| Quán cấp 10, danh tiếng ≥ 90, đủ mọi máy tự động | — | — | ✓ |

## 4. Nhiệm vụ riêng

Hai nhiệm vụ nối sau chuỗi chung (`REGION_QUESTS`, `farm/content.js`). Nơi chỉ một bên thưởng cao hơn vì không có nguồn hạt rẻ hoặc không có đầu ra giá cao.

| Nơi | Nhiệm vụ 1 (chỉ số ≥ mốc · xu · XP) | Nhiệm vụ 2 |
|---|---|---|
| `vn` | Bán 30 ly phin (`served` 30 · 25 · 10) | Gửi 1 kg hạt về quán (`delivered` 1000 g · 25 · 10) |
| `br` | Phơi nắng 1 kg (`dried` 1000 g · 25 · 10) | Bán 40 ly cafezinho (`served` 40 · 25 · 10) |
| `co` | Hái tay 15 lần (`harvested` 15 · 45 · 12) | Xuất khẩu 1,5 kg (`beansSold` 1500 g · 60 · 15) |
| `ke` | Rang 1 kg (`roasted` 1000 g · 45 · 12) | Bán 1 kg cho nhà xuất khẩu (`beansSold` 1000 g · 60 · 15) |
| `id` | Phơi 1,5 kg qua mùa mưa (`dried` 1500 g · 45 · 12) | Khai hoang thêm 2 ruộng (`expanded` 2 · 60 · 15) |
| `it` | Pha 10 ly espresso (`served` 10 · 45 · 12) | Qua giờ cao điểm 40 ly (`served` 40 · 60 · 15) |
| `jp` | Pha tay 12 ly (`served` 12 · 50 · 12) | Thành kissaten 30 ly (`served` 30 · 70 · 15) |
| `us` | Bán 25 ly mang đi (`served` 25 · 45 · 12) | Mở chuỗi 60 ly (`served` 60 · 70 · 15) |

Thẻ mục tiêu dẫn đường theo chỉ số: `sold`/`beansSold` → Cửa hàng/Chợ, `served` → quán, `dried`/`roasted` → trạm, `delivered` → Đơn hàng, `expanded` → biển ruộng.

## 5. Hệ số vùng trồng trọt

Mọi giống trồng được ở mọi nơi có farm. Giống không hợp vùng bị phạt. Nguồn: `REGION_CROP`, `regionCrop`, `regionFit` trong `farm/rules.js`; áp trong `farm/model.js`.

- **Sản lượng**: nhân hệ số.
- **Chất lượng**: cộng vào chất lượng gốc. Chất lượng = `55 + sức khỏe × 0,25 + chăm sóc + vùng`, kẹp 0–100.
- **Thời gian lớn**: nhân hệ số (> 1 là chậm hơn).
- Áp cùng lúc với bón/tỉa. Nơi chỉ quán không có trong bảng; nơi không có trong bảng dùng ×1 · +0 · ×1.

Đọc ô: *sản lượng · chất lượng · thời gian lớn*.

| Nơi | Vối (`robusta`) | Chè (`arabica`) | Mít (`liberica`) |
|---|---|---|---|
| `vn` | ×1,10 · +0 · ×1,0 | ×0,95 · +3 · ×1,0 | ×1,00 · +0 · ×1,0 |
| `br` | ×1,05 · −3 · ×1,0 | ×1,10 · +0 · ×1,0 | ×0,85 · −5 · ×1,1 |
| `co` | ×0,80 · −8 · ×1,1 | ×1,00 · +8 · ×1,1 | ×0,80 · −8 · ×1,1 |
| `ke` | ×0,80 · −8 · ×1,1 | ×0,95 · +10 · ×1,1 | ×0,80 · −8 · ×1,1 |
| `id` | ×1,05 · +0 · ×1,0 | ×0,95 · +2 · ×1,0 | ×1,10 · +3 · ×0,95 |

**Nhãn hợp vùng** (`regionFit`):

| Nhãn | Điều kiện |
|---|---|
| ✓ Hợp vùng | Sản lượng ≥ 1,05 hoặc chất lượng ≥ +5 |
| ✗ Kém hợp | Không hợp vùng và sản lượng ≤ 0,9 |
| – Trung tính | Còn lại |

Nơi hiện nhãn:

- Thẻ giống trong Cửa hàng luôn hiện nhãn (chữ + icon). Có Key Nature thì thêm số hệ số (`farm/game.js`).
- Thẻ kết quả trên bản đồ chỉ hiện mục "Hệ số vùng theo giống" khi đã có Key Nature (`hasNature`). Bản đồ chỉ mở từ cổng thiên đàng, nên mục này chỉ thấy ở lần trùng sinh sau khi đã mở Key Nature.
