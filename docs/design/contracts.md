# Hợp đồng dữ liệu giữa các màn

Mô tả đúng code hiện tại (lượt 1). Ai đổi một trường dưới đây phải sửa file này cùng lúc và ghi bước chuyển save cũ.

## 1. Kho lưu trình duyệt

| Key localStorage | Nội dung | Ghi | Đọc |
|---|---|---|---|
| `cog-coffee-player` | `{ gender: 'male'\|'female', name: string ≤ 20 }` | `savePlayer` (app/game.js lúc vào game) | `readPlayer` (app/game.js) |
| `cog-coffee-progress` | Save chính, `version: 1` (xem dưới) | `completeIntro`, `saveHeaven`, `saveFarm`, **`saveSettings` (mới)** | `readProgress`, **`readSettings` (mới)** |

Tất cả hàm nằm ở `src/state/progress.js`. Mọi hàm ghi đều đọc lại bản cũ rồi `{...previous, ...}` nên trường của màn khác được giữ nguyên. `readProgress` trả `{}` nếu `version !== 1`.

### Trường cấp 1 của `cog-coffee-progress`

| Trường | Kiểu | Ai ghi | Ai đọc |
|---|---|---|---|
| `version` | `1` | mọi hàm ghi | `readProgress` |
| `introCompleted`, `chapter`, `accident` | bool, số, chuỗi | `completeIntro`, `saveHeaven`, `saveFarm` | app/game.js (chọn màn khởi động) |
| `heaven`, `startingGift` | object, `'seeds'\|'tools'\|'capital'` | `saveHeaven` | heaven, app/game.js → `createFarm(saved, startingGift)` |
| `farm` | object farm `version: 3` (mục 2) | `saveFarm` qua `onSave` của `createFarm` | `createFarm` |
| **`settings`** | object (mục 4) | **`saveSettings`** | **`readSettings`** |

## 2. Farm và quán dùng chung một model

Chỉ `src/features/farm/model.js` được sửa số liệu. Mọi màn khác gọi `farm.act(id, action, choice, at?, owner?)` → `{ ok, message, collected, quests, ...extra }`. Không màn nào tự trừ hay cộng tiền, kho.

- `farm.progress`: getter trả **bản sao sâu**, tốn công. Quán giữ `snap` và chỉ làm mới qua `service.refresh()`.
- Lưu: `commit()` sau mỗi `act` thành công và mỗi ≥ 5 s trong `tick`. `flush()` khi rời màn.
- `farm.setCafeActive(bool)`: chỉ khi quán đang chạy và mở cửa thì lương nhân viên quán mới tự gia hạn trong `advance`.
- Offline: `advance` tính tối đa `OFFLINE_MS` (8 giờ), ghi `progress.offline = { seconds, message }`. Hiện chưa có UI nào đọc trường này.

### Trường dùng chung farm ↔ quán (trong `farm`)

| Trường | Ý nghĩa | Ghi (hàm `act`) | Đọc |
|---|---|---|---|
| `coins` | Ví chung, làm tròn 0,01 | `money()` trong mọi `act` | farm HUD, quán (giá, lương, nhập hàng) |
| `stock[product][crop]`, `lots[]` | Kho farm theo gram. `lots` là nguồn thật, `stock` dựng lại từ lots | thu hoạch, trạm, bán, `shipOrder`, `cafe/ship` | farm UI, đơn hàng |
| `cafe.stock`, `cafe.lots[]` | Kho quán (chỉ có `roasted`) | chuyến giao về tới nơi (`advance`), `cafe/supply`, `cafe/brew` (lấy ra) | bench (`missingFor`), service |
| `cafe.shipments[]` | `{ id, orderId?, lots[], startedAt, readyAt }`. Hàng đang đi đường, đã rời kho farm | `orders/shipOrder`, `cafe/ship` | `advance` (chuyển vào kho quán), `demand()` |
| `orders[]` | `{ id, day, cropId, grams, status: open\|transit\|delivered\|expired, workers[], deadline, source?: 'cafe'\|'shop', rating? }` | `refreshDaily`, `cafe/order`, `orders/*`, `advance` | farm Đơn hàng, quán (Đơn farm) |
| `cafe.supplies{}` | Vật tư theo đơn vị thật (ly, ml, g) | `cafe/buy`, `cafe/brew` | bench, service (quản lý tự nhập) |
| `cafe.gear{}`, `cafe.tables[10]`, `upgrades.cafe` | Thiết bị, cấp bàn, số bàn mở (`assetValue('cafe')`) | `cafe/gear`, `cafe/table`, `upgrade` | service, cafe/game.js (bố cục) |
| `cafe.crew[]` | `{ id, level, paidUntil }` tối đa 10 | `cafe/hire`, `train`, `fire`, `advance` (lương) | service (agent) |
| `cafe.mastery{recipeId}` | `{ best: 0–100, made }`. Chỉ ly người chơi pha (`staff` không có) mới cập nhật | `cafe/brew` | bench (★, pha theo trí nhớ khi best ≥ 90), service (barista cần best ≥ ngưỡng) |
| `cafe.reputation` (10–100) | Uy tín quán. **Khác** `reputation` của farm (0–100, theo đơn giao) | `cafe/sell`, `lost`, `shift` | service (tốc độ khách, món mở) |
| `cafe.open`, `reserve`, `served`, `lost`, `revenue`, `costs` | Trạng thái và thống kê quán | `cafe/*` | quán HUD |
| `upgrades.storage` | Sức chứa chung: kho farm, và khối lượng kho quán + hàng đang đi | `upgrade` | `harvest`, `collect`, `ship`, `supply` |

Chỉ tồn tại trong phiên của màn quán, không lưu (model xoá khi tải): khách, kệ ly, ly trên tay, combo, ca, agent nhân viên, `brew`, `nextCustomerAt`.

### Hành động `farm.act('cafe', …)` mà quán gọi

| action | choice | extra trả về |
|---|---|---|
| `toggle`, `reserve` | – | – |
| `ship` | `cropId` | – |
| `supply` | – | – |
| `brew` | `{ recipeId, cropId, score, staff? }` | `{ quality }` |
| `sell` | `{ recipeId, quality, stars, wait, combo, memory, table, charm, special }` | `{ price, tip }` |
| `lost` | `'angry' \| 'busy'` | – |
| `buy`, `gear`, `hire`, `train`, `fire` | id | – |
| `shift` | `{ served, goal, avg }` | `{ bonus, met }` |
| `table` | chỉ số bàn | – |
| `order` | `cropId` (đơn 252 g sang farm) | – |
| `upgrade` (id `'cafe'`) | – | nhánh nâng cấp chung |

## 3. Phản hồi hình + tiếng (lượt 1, không lưu)

Không có trường save. Hợp đồng là các hàm (chi tiết trong [round-1-foundation.md](round-1-foundation.md)):

- `src/shared/audio/index.js`: `sfx`, `loop`, `setListener`, `setVolume`, `setMuted`, `playMusic`, `playAmbience`, `hasContent`.
- `src/shared/vfx/index.js`: `createVfx`, `flyTo`, `popNumber`, `shake`, `setQuality`, `getQuality`, `onQuality`, `applyRendererQuality`.
- Cầu nối mỗi màn: `src/features/farm/feedback.js`, `src/features/cafe/feedback.js` (mới). Chỉ **đọc** kết quả `act`, không gọi `act`.
- `createCafeService(farm, { notice, reward, route, onShiftEnd, fx })`: thêm callback `fx(event, data)`. Mặc định `() => {}`.

## 4. Trường mới `settings` (cài đặt người chơi)

```js
settings: {
  version: 1,
  master: 0.8, music: 0.6, ambience: 0.7, sfx: 0.8, ui: 0.6, // 0–1
  muted: false,
  quality: 'high' // 'low' | 'medium' | 'high'
}
```

| Việc | Ai | Hàm |
|---|---|---|
| Đọc và chuẩn hoá | `src/ui/settings.js` lúc khởi động | `readSettings()` luôn trả object đủ trường: số phải hữu hạn, kẹp về 0–1, sai thì lấy mặc định; `muted` phải đúng kiểu bool; `quality` ngoài danh sách thì về `'high'` |
| Ghi | Chỉ `src/ui/settings.js` | `saveSettings(settings)` → `true/false`. Ghi khi thả thanh trượt hoặc đổi công tắc, không ghi trong lúc đang kéo |
| Áp dụng | `src/ui/settings.js` | `setVolume(bus, v)`, `setMuted(b)`, `setQuality(level)`. vfx phát `onQuality` → `applyRendererQuality(renderer)` trong app/game.js |

**Chuyển save cũ:** không tăng `version` của save chính hay của farm. Save chưa có `settings` → `readSettings` trả mặc định và không ghi gì cho tới khi người chơi đổi một mục. Mặc định `quality: 'high'` giống hệt renderer hiện tại (pixel ratio ≤ 1,5, có bóng), nên save cũ không bị đổi hình.

**Trường hợp biên**
- localStorage không ghi được: cài đặt vẫn áp dụng trong lượt chơi. Hộp cài đặt hiện một dòng `ui-alert--warn` “Chưa lưu được cài đặt” một lần.
- Lúc chưa có save (màn chọn nhân vật): `saveSettings` tạo `{ version: 1, settings }`. Không có `introCompleted/heaven/farm` nên app/game.js vẫn vào màn chọn nhân vật như cũ.
- Các bật/tắt HUD trong Cài đặt farm (Nhật ký, Nhắc việc) **vẫn chỉ trong lượt chơi**, không nằm trong `settings`.
