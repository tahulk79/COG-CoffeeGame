# Hợp đồng dữ liệu giữa các màn

Mô tả đúng code hiện tại (lượt 1). Ai đổi một trường dưới đây phải sửa file này cùng lúc và ghi bước chuyển save cũ.

## 1. Kho lưu trình duyệt

Đổi tên 04/11/2026 (COG → Godbean): **không chuyển save cũ**, game chơi lại từ đầu. Khi tải, `src/state/storage-keys.js` xóa khóa cũ `cog-coffee-progress`, `cog-coffee-player`, `cog-coffee-progress-backup`.

| Key localStorage | Nội dung | Ghi | Đọc |
|---|---|---|---|
| `godbean-player` | `{ gender: 'male'\|'female', name: string ≤ 20 }` | `savePlayer` (app/game.js lúc vào game; `name` = `randomName(gender)` theo ngôn ngữ) | `readPlayer` (app/game.js) |
| `godbean-progress` | Save chính, `version: 1` (xem dưới) | `completeIntro`, `saveHeaven`, `saveFarm`, **`saveSettings` (mới)** | `readProgress`, **`readSettings` (mới)** |

Tất cả hàm nằm ở `src/state/progress.js`. Mọi hàm ghi đều đọc lại bản cũ rồi `{...previous, ...}` nên trường của màn khác được giữ nguyên. `readProgress` trả `{}` nếu `version !== 1`.

### Trường cấp 1 của `godbean-progress`

| Trường | Kiểu | Ai ghi | Ai đọc |
|---|---|---|---|
| `version` | `1` | mọi hàm ghi | `readProgress` |
| `introCompleted`, `chapter`, `accident` | bool, số, chuỗi | `completeIntro`, `saveHeaven`, `saveFarm` | app/game.js (chọn màn khởi động) |
| `startingRegion` | id địa điểm (`world-map/content.js`) | `saveRegion` (app/game.js khi bấm "Trùng sinh ở đây" trên bản đồ; có rồi thì bản đồ mở thẳng thẻ kết quả) | app/game.js → `createFarmGame(..., startingRegion)` → `createFarm`; chỉ dùng khi tạo save farm mới |
| `heaven`, `startingGift` | object, `'seeds'\|'tools'\|'capital'` | `saveHeaven` | heaven, app/game.js → `createFarm(saved, startingGift)`; **(spec 03/11)** app/game.js còn đọc `heaven.answers` qua `correctQuestionIds` để truyền `heavenLessons` (mục 5) |
| `farm` | object farm `version: 3` (mục 2) | `saveFarm` qua `onSave` của `createFarm` | `createFarm` |
| **`settings`** | object (mục 4) | **`saveSettings`** | **`readSettings`** |

## 2. Farm và quán dùng chung một model

Chỉ `src/features/farm/model.js` được sửa số liệu. Mọi màn khác gọi `farm.act(id, action, choice, at?, owner?)` → `{ ok, message, collected, quests, ...extra }`. Không màn nào tự trừ hay cộng tiền, kho.

- `farm.progress`: getter trả **bản sao sâu**, tốn công. Quán giữ `snap` và chỉ làm mới qua `service.refresh()`.
- `farm.peek()`: trả **state sống** cho chỗ đọc mỗi khung hình (vòng thợ `crew.update`, kiểm tra ruộng sở hữu). Chỉ đọc; muốn đổi phải qua `act`/`workerUpdate`.
- Lưu: `commit()` sau mỗi `act` thành công và mỗi ≥ 5 s trong `tick`. `flush()` khi rời màn.
- `farm.setCafeActive(bool)`: chỉ khi quán đang chạy và mở cửa thì lương nhân viên quán mới tự gia hạn trong `advance`.
- Offline: `advance` tính tối đa `OFFLINE_MS` (8 giờ), ghi `progress.offline = { seconds, message }`. Hiện chưa có UI nào đọc trường này.

### Trường dùng chung farm ↔ quán (trong `farm`)

| Trường | Ý nghĩa | Ghi (hàm `act`) | Đọc |
|---|---|---|---|
| `region` | Nơi trùng sinh (`'vn'`, `'ke'`, `'it'`…), cố định theo save. Save mới lấy `startingRegion`; save cũ thiếu / id lạ hoặc đang khóa → `'vn'`. Không đổi `version` | `createFarm` (6 tham số: `…, heavenLessons, startingRegion`) | `regionType()` ở farm/content (HUD mở dần, `questsFor`), farm/model (đơn quán tự sinh chỉ khi `both`), farm/game, cafe/ui ([02b-world-map](../screens/02b-world-map/README.md)) |
| `coins` | Ví chung, làm tròn 0,01 | `money()` trong mọi `act` | farm HUD, quán (giá, lương, nhập hàng) |
| `stock[product][crop]`, `lots[]` | Kho farm theo gram. `lots` là nguồn thật, `stock` dựng lại từ lots | thu hoạch, trạm, bán, `shipOrder`, `cafe/ship` | farm UI, đơn hàng |
| `cafe.stock`, `cafe.lots[]` | Kho quán (chỉ có `roasted`) | chuyến giao về tới nơi (`advance`), `cafe/supply`, `cafe/brew` (lấy ra) | bench (`missingFor`), service |
| `cafe.shipments[]` | `{ id, orderId?, lots[], startedAt, readyAt }`. Hàng đang đi đường, đã rời kho farm | `orders/shipOrder`, `cafe/ship` | `advance` (chuyển vào kho quán), `demand()` |
| `orders[]` | `{ id, day, cropId, grams, status: open\|transit\|delivered\|expired, workers[], deadline, source?: 'cafe'\|'shop', rating? }` | `refreshDaily`, `cafe/order`, `orders/*`, `advance` | farm Đơn hàng, quán (Đơn farm) |
| `cafe.supplies{}` | Vật tư theo đơn vị thật (ly, ml, g) | `cafe/buy`, `cafe/brew` | bench, service (quản lý tự nhập) |
| `cafe.gear{}`, `cafe.tables[10]`, `upgrades.cafe` | Thiết bị, cấp bàn, số bàn mở (`assetValue('cafe')`) | `cafe/gear`, `cafe/table`, `upgrade` | service, cafe/game.js (bố cục) |
| `cafe.crew[]` | `{ id, level, paidUntil }` tối đa 10. `paidUntil` cộng `CAFE_SHIFT_MS` (4 phút) mỗi lần trả; trong `advance`, khi quán không chạy/không mở hoặc vắng mặt > 60 s thì `paidUntil` được cộng bù đúng khoảng đó (giờ đã trả chỉ trôi khi quán mở) | `cafe/hire`, `train`, `fire`, `advance` (lương) | service (agent) |
| `cafe.mastery{recipeId}` | `{ best: 0–100, made }`. Chỉ ly người chơi pha (`staff` không có) mới cập nhật; ly Auto pha (`demo: true`) chỉ tăng `made`, không tăng `best` (04/11/2026) | `cafe/brew` | bench (★, pha theo trí nhớ khi best ≥ 90), service (barista cần best ≥ ngưỡng) |
| `cafe.reputation` (10–100) | Uy tín quán. **Khác** `reputation` của farm (0–100, theo đơn giao) | `cafe/sell`, `lost`, `shift` | service (tốc độ khách, món mở) |
| `cafe.open`, `reserve`, `served`, `lost`, `revenue`, `costs` | Trạng thái và thống kê quán | `cafe/*` | quán HUD |
| `market` | `{ day, sold, orders }`: ngày công hiện tại, xu giá gốc đã bán ở chợ và số đơn Chợ đã giao trong ngày công đó (`orders` tối đa `ORDERS_PER_DAY = 2`, mới 04/11/2026; save cũ thiếu → 0). Save cũ không có → tạo `{ day: -1, sold: 0, orders: 0 }` | `refreshDaily`, `market/sell` | `saleQuote` |
| (đã bỏ 03/11/2026) | `fish` (save cũ: bán 8 xu/con khi tải), `dailyTasks` (luôn `[]`), `machines.grinder` (mẻ chờ trả hạt rang), `upgrades.house`/`upgrades.grinder` (bỏ qua), worker `energy` (đặt 100), worker `restUntil` (đặt 0, **trừ** thợ đang ốm theo mục 6: giữ nguyên), worker `farmId:null` (đưa vào farm hoặc hoàn phí tuyển). Cấp công trình kẹp về tối đa 20 (quán 10) | `createFarm` khi tải | – |
| `stats{}` | Bộ đếm cho nhiệm vụ: `harvested`, `watered`, `weeded`, `dried`, `roasted`, `ground`, `sold` (gram mọi sản phẩm), `beansSold` (gram hạt phơi/rang/xay, không tính quả chín; mới 04/11/2026, save cũ = 0), `expanded`, `orders`, `delivered`, `served` (chỉ ly của chính người chơi, không tính ly nhân viên/robot). Không đổi `version` | `harvest`, trạm, `market/sell`, `order`, `expand`, `cafe/sell` | `rewards()` (nhiệm vụ), `HUD_UNLOCKS` |
| `upgrades.storage` | Sức chứa chung: kho farm, và khối lượng kho quán + hàng đang đi | `upgrade` | `harvest`, `collect`, `ship`, `supply` |

Chỉ tồn tại trong phiên của màn quán, không lưu (model xoá khi tải): khách, kệ ly, ly trên tay, combo, ca, agent nhân viên, `brew`, `nextCustomerAt`.

### Hành động `farm.act('cafe', …)` mà quán gọi

| action | choice | extra trả về |
|---|---|---|
| `toggle`, `reserve` | – | – |
| `ship` | `cropId` | – |
| `supply` | – | – |
| `brew` | `{ recipeId, cropId, score, staff?, demo? }` (`demo`: ly Auto pha) | `{ quality }` |
| `sell` | `{ recipeId, quality, stars, wait, combo, memory, table, charm, special, staff? }` | `{ price, tip }` |
| `lost` | `'angry' \| 'busy' \| 'rude' \| 'robot'` (mục 6) | – |
| `buy`, `gear`, `hire`, `train`, `fire` | id | – |
| `shift` | `{ served, goal, avg }` | `{ bonus, met }` |
| `table` | chỉ số bàn | – |
| `order` | `cropId` (đơn 252 g sang farm) | – |
| `upgrade` (id `'cafe'`) | – | nhánh nâng cấp chung |

## 3. Phản hồi hình + tiếng (lượt 1, không lưu)

Không có trường save. Hợp đồng là các hàm (chi tiết trong [round-1-foundation](ui-audio-vfx.md)):

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
  quality: 'high', // 'low' | 'medium' | 'high'
  lang: 'en'        // 'en' | 'vi' — mặc định 'en' (04/11/2026), xem i18n.md
}
```

| Việc | Ai | Hàm |
|---|---|---|
| Đọc và chuẩn hoá | `src/ui/settings.js` lúc khởi động | `readSettings()` luôn trả object đủ trường: số phải hữu hạn, kẹp về 0–1, sai thì lấy mặc định; `muted` phải đúng kiểu bool; `quality` ngoài danh sách thì về `'high'`; `lang` ngoài `'en'`/`'vi'` thì về `'en'` |
| Ghi | Chỉ `src/ui/settings.js` | `saveSettings(settings)` → `true/false`. Ghi khi thả thanh trượt hoặc đổi công tắc, không ghi trong lúc đang kéo |
| Áp dụng | `src/ui/settings.js` | `setVolume(bus, v)`, `setMuted(b)`, `setQuality(level)`. vfx phát `onQuality` → `applyRendererQuality(renderer)` trong app/game.js |

**Chuyển save cũ:** không tăng `version` của save chính hay của farm. Save chưa có `settings` → `readSettings` trả mặc định và không ghi gì cho tới khi người chơi đổi một mục. Mặc định `quality` theo thiết bị (03/11/2026, mobile first): `deviceMemory ≤ 2` hoặc `hardwareConcurrency ≤ 4` → `'low'`; màn cảm ứng (`pointer: coarse`) → `'medium'`; còn lại `'high'`. Save đã lưu `quality` giữ nguyên.

**Tự hạ chất lượng:** `src/app/game.js` đo khung hình ở farm/thiên đàng; nếu > 60% khung chậm hơn 1/25 s trong 2 s thì gọi `lowerQuality()` của `src/ui/settings.js` (Cao → Vừa → Thấp; **không lưu**, chỉ áp dụng trong lượt chơi). Khung > 250 ms bị coi là trình duyệt kìm/tạm dừng trang, không tính là máy chậm và bắt đầu lại cửa sổ đo. Không hạ nếu người chơi đã tự chọn mức trong lượt chơi. Thêm `?fps` vào URL để hiện fps · số draw call · mức chất lượng (đo trên điện thoại thật qua `npm run dev`, Vite mở `--host 0.0.0.0`); bỏ qua 3 s đầu sau chuyển cảnh/quay lại tab, chờ 5 s giữa hai lần hạ.

**Trường hợp biên**
- localStorage không ghi được: cài đặt vẫn áp dụng trong lượt chơi. Hộp cài đặt hiện một dòng `ui-alert--warn` “Chưa lưu được cài đặt” một lần.
- Lúc chưa có save (màn chọn nhân vật): `saveSettings` tạo `{ version: 1, settings }`. Không có `introCompleted/heaven/farm` nên app/game.js vẫn vào màn chọn nhân vật như cũ.
- **Ngôn ngữ:** `src/i18n/index.js` đọc `settings.lang` thẳng từ localStorage một lần lúc tải trang. Đổi ngôn ngữ trong hộp cài đặt thì `saveSettings` rồi `location.reload()`; ghi lỗi thì hiện dòng cảnh báo và không tải lại. Save cũ không có `lang` → tiếng Anh.
- Các bật/tắt HUD trong Cài đặt farm (Nhật ký, Nhắc việc) **vẫn chỉ trong lượt chơi**, không nằm trong `settings`.

## 5. Luồng người chơi mới: `farm.lessons`, `farm.tutorial` (03/11/2026, đã triển khai phần dữ liệu)

Spec: [onboarding-flow](onboarding-flow.md). Không tăng `version` của save chính (1) hay của farm (3). Phần dữ liệu đã có trong `farm/model.js`; UI (hỏi lại, Sổ tay, HUD mở dần, mũi chỉ theo `guideQuest`) do farm-dev/cafe-dev/ui-stylist nối.

### Trường mới trong `farm`

```js
lessons: {
  learned: ['ripe', 'recipe', ...],   // questionId đã thuộc (đúng ở thiên đàng hoặc khi hỏi lại)
  granted: ['ripe', 'costs', ...],    // questionId đã cấp thưởng một lần (xu, uy tín, ★ khởi đầu)
  asked: { water: 12, ... },          // questionId → ngày công (floor((t − epoch) / WORK_DAY_MS)) của lần trả lời sai gần nhất
  askedDay: 12, askedCount: 1         // ngày công + số câu hỏi lại đã hiện trong ngày công đó (giới hạn 1)
},
tutorial: {
  seen: ['controls', 'quest-guide', 'cafe-intro', 'bench-intro', 'tools', 'unlock-cafe-play', ...]
}
```

| Trường | Ghi | Đọc |
|---|---|---|
| `lessons.learned`, `granted` | `createFarm` (hợp từ `heavenLessons`, cấp thưởng), `act('lessons','answer')` | `model.js` (chất lượng hái tay, `waterCapacity`), farm UI (Sổ tay), `cafe/bench.js` (`adjust`: "Sửa bước này trước"), `cafe/service.js`/`cafe/game.js` (có cần hỏi lại không) |
| `lessons.asked`, `askedDay`, `askedCount` | `act('lessons','answer')` khi trả lời **sai** (asked) và mỗi lần trả lời (đếm) | farm game, cafe game (điều kiện hỏi lại), Sổ tay ("Ôn lại sau x phút") |
| `tutorial.seen` | `act('tutorial','seen',id)` | farm UI/game (gợi ý điều khiển, dẫn đường, chấm "Mới", toast mở khóa), cafe UI (4 bước), bench (`bench-intro`) |

Chỉ `model.js` sửa hai trường này. Mọi màn khác đọc qua `farm.peek()` và ghi qua `act`.

### Hành động mới

| act | choice | Trả về | Luật |
|---|---|---|---|
| `('lessons','answer')` | `{ questionId, optionId }` | `{ ok, correct, explanation, perk?: { id, name, effect } }` (+ `message`) | Chấm bằng `EXPERTS` trong `features/heaven/content.js` (nguồn duy nhất). Từ chối (`ok:false`, không ghi gì) nếu `questionId` lạ, đã thuộc, `asked[questionId] === ngày công hiện tại`, đã có 1 câu hỏi lại được trả lời trong ngày công này, hoặc `optionId` lạ. Đúng → thêm `learned`, cấp thưởng nếu chưa `granted`. Sai → ghi `asked`. Cả hai tăng `askedCount`. `explanation` cùng chữ với hộp kết quả thiên đàng (`answerText` của `heaven/journey.js`) |
| `('tutorial','seen')` | id trong `TUTORIAL_IDS` (`farm/content.js`: `controls`, `quest-guide`, `cafe-intro`, `bench-intro`, `tools`) hoặc chuỗi `unlock-` + `[a-z-]+` | `{ ok }` | Thêm nếu chưa có; id lạ bị từ chối. Không đổi tiền/kho, không ghi Hoạt động |

### Hàm đọc cho UI

| Hàm | Trả về |
|---|---|
| `farm.pendingLesson(ids = cả 6 câu)` | `{ expert, question }` (đối tượng gốc trong `EXPERTS`, chỉ đọc) của câu đầu tiên trong `ids` đang hỏi lại được, hoặc `null`. Hỏi được = chưa thuộc ∧ chưa sai trong ngày công hiện tại ∧ chưa có câu hỏi lại nào được trả lời trong ngày công này (4.1). Mỗi nơi kích hoạt truyền câu của mình, ví dụ hái tay `['ripe']`, giếng/mưa `['water']`, báo cáo cuối ca `['recipe','costs']`, ly < 70 `['adjust']`, khách bỏ về `['customer']`; Sổ tay truyền đúng câu được bấm. Hiện câu không ghi gì; chỉ `act('lessons','answer')` mới tính |
| `farm.onEvent(fn)` | `fn(type, props)`; trả hàm hủy đăng ký. Không lưu vào save. Lỗi trong listener bị nuốt (`console.error`). Loại: `field_bought {index,level}`, `workday_ended {level,coins_bucket,market_floor_hit}` (chỉ tick trực tiếp, không phát khi bù offline > 60 s), `victory_reached {type}`, `challenge_completed {quest}`, `auto_started {runs_left}`, `shift_ended {cups,tier,left,revenue,costs}` (từ `act('cafe','shift')`, scene gửi thêm `lost`,`revenue`,`costs`), `tutorial_completed {step:'first_cup',ms_since_start}` (khi `stats.served` 0→1), `discovery_saved {type,what}` (what = fragment/message/key; type = loại Fragment hoặc id Key), `question_ready {id}` (chỉ cho UI, không gửi analytics). Nối analytics ở `shared/analytics/wire.js` `wireFarm` |
| `LESSON_PERKS` (export của `farm/model.js`) | `{ [questionId]: { name, effect } }` cho toast "🎓 Mẹo mới", Sổ tay |
| `farm.waterCapacity` | Đã cộng +2 khi thuộc `water` |
| Ngày công | `floor((t − peek().epoch) / WORK_DAY_MS)` (`farm/rules.js`), dùng cho "Ôn lại sau x phút" |
| `world.setQuestArrow(id \| null)` (`shared/world/scene.js`) | Mũi chỉ nhiệm vụ (slot `<theme>/quest-arrow`; farm và quán đều là `farm/quest-arrow`, thiên đàng `heaven/quest-arrow`) nổi trên đối tượng tương tác `id`, nhún 1 Hz, ẩn khi `null` hoặc khi màn bị chặn (modal). Cùng marker với `setTarget` của thiên đàng |

### Chữ ký đổi

| Hàm | Trước | Sau |
|---|---|---|
| `createFarm` (`farm/model.js`) | `(saved, startingGift, onSave, now)` | `(saved, startingGift, onSave, now = Date.now(), heavenLessons = [])` |
| `createFarmGame` (`farm/game.js`) | `(player, gift, persistence)` | `(player, gift, persistence = {read, save}, heavenLessons = [])`: tham số thứ 3 `persistence` đã có sẵn (dùng bởi `tools/farm-preview`), nên `heavenLessons` là tham số thứ 4; app gọi `createFarmGame(player, gift, undefined, heavenLessons)` |
| mới: `correctQuestionIds(heaven)` (`heaven/journey.js`) | — | Trả mảng `questionId` có `correct: true` sau khi chuẩn hóa như `createJourney` (dùng chung hàm `normalizeAnswers`: v1 → v2; tính lại từ đáp án gốc). `heaven` thiếu/hỏng → `[]` |
| mới: `answerText(question, correct)` (`heaven/journey.js`) | — | Chữ giải thích dùng chung cho hộp kết quả thiên đàng và hỏi lại ở farm/quán |
| `enterFarm` (`app/game.js`) | `enterFarm(gift)` | `enterFarm(gift, heavenLessons = [])`; đường tải save truyền `correctQuestionIds(saved.heaven)`, đường qua cổng truyền `correctQuestionIds(readProgress().heaven)` (đọc lại sau khi heaven đã lưu) |

### Dữ liệu dẫn xuất, không lưu

- **Mở khóa HUD**: `HUD_UNLOCKS` trong `farm/content.js`; điều kiện tính từ `claimed`, `stats`, `level`, `fields`, `workers`, `orders`, `upgrades`, `decorations`, `cafe.revenue` (bảng 3.3 của spec).
- **Bước hướng dẫn quán**: từ `cafe.open`, có order đang chờ, `stats.served`.
- **Mục tiêu mũi chỉ nhiệm vụ**: cùng hàm tính đích với `guideQuest`.

### Chuyển save cũ (trong `createFarm`, chạy mỗi lần tải, không ghi đè dữ liệu đã có)

1. `lessons` thiếu/hỏng → `{ learned: [], granted: [], asked: {}, askedDay: -1, askedCount: 0 }`. Lọc mọi mảng/khóa theo `questionId` có trong `EXPERTS` (bỏ trùng); `asked`/`askedDay` phải là số nguyên, `askedCount` kẹp 0–99.
2. `learned = learned ∪ heavenLessons`.
3. Với mỗi `id ∈ learned \ granted` có thưởng một lần: `costs` → `money(30,'quest')`; `customer` → `cafe.reputation = min(100, +3)`; `recipe` → `best = max(best, 40)` cho `phin-den`, `nau-da` (tạo mục `{ best: 40, made: 0 }` nếu chưa có). Thêm id vào `granted`, ghi **một** dòng journal "Mẹo từ thiên đàng: <tên các mẹo mới>." cho cả lượt. `ripe`, `water`, `adjust` là tác dụng liên tục, chỉ ghi `granted`. Cùng hàm `grantLessons` chạy khi trả lời đúng ở `act('lessons','answer')`.
4. `tutorial` thiếu (farm save đã có nhưng chưa có `tutorial.seen`) → `{ seen: [] }`, rồi thêm sẵn: `controls` và `quest-guide` nếu `claimed` có `roast`; `cafe-intro` nếu `stats.served > 0`; `bench-intro` nếu `cafe.mastery` có mục nào (xét **trước** khi cấp mẹo `recipe`); `tools` nếu `claimed` có `expand` hoặc ≥ 2 ruộng hoặc cấp ≥ 3. Chỉ chạy một lần cho save cũ; save mới bắt đầu `seen: []`. `seen` có sẵn được lọc theo luật id, bỏ trùng, tối đa 100. UI đánh dấu `unlock-<id>` cho mọi mục đã mở ngay lúc tải mà không toast.
- Bình tưới đang lưu được kẹp theo `waterCapacity` đã tính mẹo `water`; farm mới bắt đầu đầy bình (8 nếu thuộc `water`).
5. Thứ tự `QUESTS` đổi (Bán ly đầu lên vị trí 2): `claimed` giữ nguyên theo id, không trả/xóa thưởng.

**Trường hợp biên:** chơi lại chương thiên đàng không xóa `farm.lessons`; `granted` chặn cấp lặp. localStorage không ghi được → hai trường chỉ sống trong lượt chơi (như phần còn lại của farm).

### Nhãn hiển thị chốt (để mọi màn dùng giống nhau)

«Cửa hàng» (tab «Cây giống» · «Vật tư» · «Chợ»), «Chuyển về quán · 2 xu» / «Chuyển hết» (gửi hàng sang quán), «Nhận hàng» / «Nhận tất cả» (chỉ lấy mẻ ở trạm), «Vào quán», «Đơn hàng».

## 6. Robot vs nhân viên: `kind`, `incident`, `robotGift` (03/11/2026, sửa vòng 3; model, `farm/rules.js` và UI quán/farm đã triển khai — đối chiếu code 04/11/2026)

Spec: [robot-staff](robot-staff.md). Vòng 3 chỉ đổi dữ liệu tĩnh `robo-n1` và luật kiểm trong `workers/incident`; không thêm/đổi trường save, không cần bước chuyển save. Không tăng `version` save chính (1) hay farm (3). Chỉ `farm/model.js` ghi các trường dưới; màn khác đọc qua `farm.peek()`/`progress`, ghi qua `act`.

### Dữ liệu tĩnh (không lưu)

| Nơi | Thêm | Ghi chú |
|---|---|---|
| `cafe/recipes.js` `CANDIDATES` | `kind: 'robot'`, `wage: 3`, `fixedEffects` cho `robo-b1..3` (waiter), `robo-d1` (cleaner); `giftOnly: true` cho `gift-pha` (barista) và `gift-bung` (waiter) — id gói riêng, không trùng `robo-b*` | Thiếu `kind` = `'human'`. `staffEffects(person, level)` trả `fixedEffects` nếu là robot; người phục vụ thêm `carry: 2`. **`staffWage(role, level, person?)` trả `person.wage` cố định cho robot** (không nhân cấp); mọi chỗ gọi (model.js:224 `hire`, :225 tự gia hạn, cafe UI) truyền `person` |
| `cafe/recipes.js` `GEAR` | Đổi `name`/`icon` của `kiosk` → "Robot thu ngân (kiosk)", `autoEspresso` → "Robot pha espresso" | id giữ nguyên, không cần chuyển save |
| `farm/rules.js` `WORKER_CANDIDATES` | `robo-n1`: `kind: 'robot'`, `fee: 0`, `wage: 15`, `jobs: ['water','weed','processing','delivery']`, chỉ số cố định speed 70, intelligence 60, strength 60, dexterity 70, constitution 60 (vòng 3) | `workerWage(w)` trả `wage` cho robot |
| `farm/rules.js` | `INCIDENTS = { phone: .12, sick: .04, rude: .05, kCafe: .12, kFarm: .07, floor: .4, manager: .5, grace: 2, minRep: 30, phoneMs: 40000 }` (dùng chung hai màn); `ROBOT_PACKS = { 1: 0, 5: .1, 10: .25 }`, `packPrice(W, n) = ceil(W × n × (1 − d))` → 15/68/113 | Gói **chỉ Robot vườn ở farm**; quán không có gói |

### Trường mới/đổi trong save

| Trường | Kiểu | Ghi (hàm) | Đọc |
|---|---|---|---|
| `workers[i].kind` | `'robot'\|'human'` | `workers/hire` (sao từ ứng viên) | crew.js, farm UI. Luôn dựng lại từ `WORKER_CANDIDATES` theo id khi tải |
| `workers[i].incident` | `{ for: int, type: 'none'\|'phone'\|'sick', due: ms, done: bool } \| null` | `signContract` (quay khi trả ngày công, `for = paidDays`), `workers/incident` (kích hoạt/hủy, `done`) | crew.js (kích hoạt khi `shiftUntil − at ≤ due`), farm UI (bong bóng) |
| `workers[i].waitUntil/waitReason` | sẵn có | thêm: `workers/incident` (phone, 40 s), `workers/remind` (xóa) | crew.js, `workerIdleReason` |
| `workers[i].restUntil` | sẵn có, dùng lại (đổi: không còn luôn bị xoá) | `workers/incident` (sick: `at + WORK_DAY_MS`, đồng thời `shiftUntil += WORK_DAY_MS`); `advance` cộng bù khi vắng > 60 s; `createFarm` và `signContract` chỉ đặt 0 khi **không** đang ốm (`incident.type === 'sick' && incident.done && restUntil > at`) | crew.js (loại khỏi team), UI "🤒 Nghỉ ốm · xs" |
| `cafe.crew[i].shifts` | int ≥ 0 | `cafe/hire`, tự gia hạn trong `advance` (+n) | model (miễn 2 ca đầu, `incident.for`) |
| `cafe.crew[i].incident` | `{ for, type: 'none'\|'phone'\|'sick'\|'rude', due, done } \| null` | quay khi trả ca; `cafe/incident` | service.js (kích hoạt khi `paidUntil − now ≤ due`), cafe UI |
| `cafe.crew[i].rest` | ms ≥ 0 | `cafe/incident` (sick: `CAFE_SHIFT_MS`), `advance` (trừ dần khi quán mở; trong lúc đó cộng bù `paidUntil`) | service.js (`active = … && rest === 0`) |
| `cafe.crew[i].gift` | bool | cấp gói tặng | model (`advance` bỏ qua tự gia hạn; không tính `MAX_CREW`/`max` vai; `train`/`fire` từ chối; `cafe/incident` hủy sự cố khi quán mở và có thành viên `gift` với `paidUntil > now`, `rest === 0`), UI. `workers/incident` (farm) **không** đọc trường này hay `robotGift.state` |
| `robotGift` (trong `farm`) | `{ state: 'locked'\|'ready'\|'active'\|'done', cups: 0–10, walkRep: 0–2, reported: bool, tally: { you: {cups, stars, paid, cost}, robot: {cups, stars, paid, cost, walked} } }` (`cost` cộng lúc `brew`: hạt g × 0,07 × `priceScale` + vật tư × giá gói/`pack`) | cấp gói (load + sau `act`), `cafe/toggle` (→ active), `cafe/brew` (`cups`), `cafe/sell`, `cafe/lost` (`tally`, `walkRep`), `advance` (→ done khi hết thành viên gift), `cafe/giftReport` (`reported`) | service.js, cafe UI (báo cáo), farm UI (toast, Cần xử lý) |
| `cafe.lots[]` `origin: 'gift'` | lô 200 g | cấp gói | `take`: robot gift chỉ lấy lô `gift`; người chơi/barista lấy lô `gift` sau cùng |

### Hành động mới / đổi

| act | choice | Luật |
|---|---|---|
| `('workers','hire')` | `id` hoặc `{ id, pack: 1\|5\|10 }` | **2 chỗ chung**: luật `workers.length >= 2` (model.js:322) giữ nguyên, đếm cả robot. Thêm: đã có robot mà thuê robot → `fail('Farm chỉ thuê được 1 robot.')`. Robot: `farmId: 'farm-0'`, trừ `packPrice(15, pack)`, không phí tuyển, `shiftUntil = at + pack × WORK_DAY_MS`, `paidDays += pack`, không vào `rejectedCandidates` khi cho nghỉ. `pack` với người bị bỏ qua |
| `('workers','shift')` | `id` hoặc `{ id, pack }` | Robot dùng `packPrice`; người như cũ. Tự gia hạn luôn gói 1 (15 xu). Cho phép khi thợ đang ốm: trừ tiền, cộng `shiftUntil`, **không** xoá `restUntil` (`signContract` model.js:97 bỏ `w.restUntil=0` khi đang ốm) |
| `('workers','train')` | id robot | `fail('Robot không đào tạo được.')` |
| `startTeam` (model.js:233) / «Giao đội làm đơn» | – | **Lọc bỏ** người đang ốm (`restUntil > at`) thay vì trả lỗi "đang nghỉ"; chỉ lỗi khi sau lọc không còn ai |
| `('workers','incident')` | `id` | Kích hoạt sự cố tới hạn: kiểm miễn trừ (spec 4) **tại lúc kích hoạt**; miễn trừ 4 (vòng 3) chỉ khi `type === 'sick'`, `workers.length === 1`, thợ đó là người và có trong `order.workers` của một đơn mở; hợp lệ → phone: `waitUntil/waitReason`; sick: `restUntil`, dời `shiftUntil`; không hợp lệ → hủy. Luôn `done = true`. Trả `{ ok, type, applied }` |
| `('workers','remind')` | `id` | Chỉ khi `incident.type === 'phone'` và `waitUntil > at`: xóa `waitUntil/waitReason` |
| `('cafe','hire')` | `id` (không có gói; `pack` gửi kèm bị bỏ qua) | Robot thuê **theo ca như người**: 1 ca, lương `candidate.wage` 3 cố định, `paidUntil = at + CAFE_SHIFT_MS`, đang trong ca thì từ chối (luật cũ). Điều kiện duy nhất cho robot: `HUD_UNLOCKS` `workers` đang mở, không thì `fail('Mở Nhân viên ở farm trước.')`. `giftOnly` luôn từ chối. Tăng `shifts`, quay sự cố (người). Tự gia hạn (model.js:225) dùng `staffWage(role, level, person)` và bỏ qua thành viên `gift` |
| `('cafe','train')` | id robot | `fail('Robot không đào tạo được.')` (model.js:426) |
| `('cafe','incident')` | `{ id, skip? }` | Như farm; `skip: true` (service báo đã đủ 1 chửi khách/ca) → hủy. sick → `rest = CAFE_SHIFT_MS` |
| `('cafe','brew')` | thêm `robot?: 'gift'` | Chỉ khi có `gift-pha` đang trong ca và `robotGift.cups < 10`, món ∈ {`phin-den`, `nau-da`}. **Kiểm đủ trước khi trừ bất cứ thứ gì:** lô `gift` ≥ 20 g, ly ≥ 1, sữa đá: sữa đặc ≥ 50 ml, đá ≥ 150 g; thiếu → `fail('Thiếu …')`, không trừ, không tăng `cups`. Đủ → điểm ép 50, trừ lô `gift`, ly, (sữa đá) 50 ml sữa đặc + 150 g đá, `cups++`, cộng `tally.robot.cost` |
| `('cafe','sell')` | thêm `robot?: true` | Model quay 25%: chê → không cộng tiền, coi như `lost` lý do `robot` (trả `{ walked: true, reason }`). Ghi `tally` khi `robotGift.state === 'active'`. Ly robot **không** tăng `progress.stats.served` và `progress.xp` (model.js:407; giữ chế độ ca tập `learning()` ở service.js:66), chỉ tăng `cafe.served`, `cafe.revenue`. service gửi `combo: 0` cho ly robot. service.js `serve()` **không** cộng ly robot vào `shift.served`/`shift.stars` (dòng 146) và **bỏ qua dòng cập nhật `combo`** (dòng 144) với ly robot, giao được hay bị chê: combo người chơi giữ nguyên |
| `('cafe','lost')` | thêm `'rude'`, `'robot'` | `rude`: uy tín −2. `robot`: −0,5, cộng `walkRep`, dừng trừ khi `walkRep` đạt 2 |
| `('cafe','giftReport')` | – | Đặt `reported = true` sau khi hiện khối so sánh |

### Chuyển save cũ (trong `createFarm`, mỗi lần tải)

1. `workers[i].kind` dựng lại theo id; `incident` thiếu/hỏng → `null` (quay ở lần trả ngày công tiếp). Có `incident.for` thì giữ nguyên (không quay lại). `type` lạ → `'none'`.
2. `cafe.crew` map thêm: `shifts = integer(m.shifts)` (thiếu → 0, tức người đang có được miễn 2 ca tới), `incident` như trên, `rest = clamp(finite(m.rest), 0, CAFE_SHIFT_MS)`, `gift = m.gift === true`. Lọc id theo `candidateById` như cũ (id robot mới hợp lệ).
3. `robotGift` thiếu → `{ state: 'locked', cups: 0, walkRep: 0, reported: false, tally: null }`; rồi chạy kiểm tra cấp gói (save đã qua mốc Nhân viên nhận ngay, 1 dòng journal, không toast). `cups` kẹp 0–10, `walkRep` 0–2, `state` lạ → `'done'` (không cấp lại).
4. `state === 'active'|'ready'` mà không còn thành viên `gift` trong `cafe.crew` → `'done'`.
5. `rejectedCandidates` bỏ mọi id robot.
6. **2 chỗ chung, tối đa 1 robot** (vòng 2, thay luật "chỗ robot riêng"). Vòng giới hạn khi tải hiện có (model.js:53, 95, 113–115: giữ tối đa 2 thợ theo thứ tự cũ, hoàn phí tuyển người dư) **giữ nguyên và đếm cả robot**. Thêm một bước trước vòng đó: đếm robot theo thứ tự; robot thứ 2 trở đi bị bỏ (phí tuyển 0 nên hoàn 0, gói trả trước không hoàn), 1 dòng journal. Save lạ nhiều hơn 2 thợ: giữ 2 thợ đầu theo thứ tự cũ, hoàn phí phần dư như luật hiện có. Không có chỗ nào trong `model.js`, `game.js`, `ui.js` phải đổi cách đếm "2 thợ"; ô robot hiện trong một trong 2 ô thợ.
7. **`restUntil` khi tải:** giữ `finite(restUntil)` nếu `incident?.type === 'sick' && incident.done` (không so với `now` lúc tải: `advance` còn cộng bù thời gian vắng sau đó; `restUntil` đã qua thì vô hại vì crew chỉ loại `restUntil > at`); còn lại 0 (như cũ, model.js:53). Save cũ chưa có `incident` → luôn 0, không đổi hành vi.

8. `tally.*.cost` thiếu → 0. Save đã ghi `robo-pha` (bản nháp trước vòng 2) trong `cafe.crew` → đổi id thành `gift-pha`, giữ `paidUntil`; `robo-b*` có `gift: true` → đổi thành `gift-bung`.

### Chi tiết đã triển khai (model)

- `farm/rules.js` thêm export: `ROBOT_PACKS`, `packPrice(wage, n)`, `INCIDENTS`, `incidentOdds(level, k, manager = false, rude = false)` → `{ phone, sick, rude }`. `workerWage(w)` đọc lương robot từ `WORKER_CANDIDATES` theo id (không đọc save). `workerIdleReason`: "🤒 Nghỉ ốm · xs", robot "Hết gói · Gia hạn {price} xu" (Cần xử lý: "{tên} hết gói · Gia hạn {price} xu"), "Robot không hái được · Hái tay hoặc thuê người" (robot giữ đơn chưa đủ hàng, không còn quả/nhân của giống đó, không có mẻ).
- Hàm mới trên `farm`: `debugIncident(scope: 'farm'|'cafe', id, type, at?)` → bool (chỉ dùng khi `?debug=incident`; đặt sự cố ca hiện tại, `due` = thời gian còn lại → tới hạn ngay, miễn trừ vẫn kiểm lúc kích hoạt); `incidentOdds(scope, id, at?)` → `{ phone, sick, rude }` (robot 0). `workerUpdate` bỏ qua `xp` của robot.
- `act('workers','incident', id)` → `{ ok, type, applied }`; `fail('Chưa tới lúc.')` khi `shiftUntil − at > due`. Ngoài miễn trừ ở spec: trễ hơn 10 s so với điểm kích hoạt → hủy (điểm đó trôi qua khi vòng farm không chạy). Miễn trừ 3 farm = `setCafeActive(true)` (đang ở màn quán).
- `act('cafe','incident', { id, skip? })` → `{ ok, type, applied }`; `fail('Chưa tới lúc.')` khi `paidUntil − at > due`.
- `act('cafe','sell', { …, robot: true })`: bị chê → `{ ok, walked: true, reason: 'robot' }` (không có `price/tip`). Nhận → `{ price, tip }`, tip chỉ phần nhanh, bỏ `special`/`memory`/bàn/`charm`/combo.
- `robotGift.tally.*.stars` là **tổng** sao của ly khách nhận. `tally.robot.cups` gồm cả ly bị chê → ★ trung bình robot = `stars / (cups − walked)`, bạn = `stars / cups`. `tally.you` chỉ đếm ly **người chơi tự pha** bán ra khi `state === 'active'` (`sell` nhận cờ `staff`, ly barista không tính); `tally.you.cost` chỉ cộng ly `brew` không có `staff`.
- `gift-pha` không rời đội khi đủ 10 ly (model chỉ từ chối `brew` thứ 11); thành viên gift bị xoá khỏi `cafe.crew` khi `paidUntil ≤ now` trong `advance`. Cấp gói chờ tới khi `CANDIDATES` có `gift-pha`.
- `take(product, cropId, grams, location, only)`: lô `gift` luôn lấy sau cùng; `only = 'gift'` chỉ lấy lô gift.

**Trường hợp biên:** cấp gói chỉ khi `state === 'locked'`, đặt `state = 'ready'` trước khi thêm crew/lô để không cấp đôi. Thành viên `gift` thừa (`fire` từ dev tools) → bước 4 dọn. Gói tặng không thêm toast: dòng 🎁 gộp vào toast mở khóa `workers` sẵn có (`farm/game.js:536–539`, onboarding-flow 3.3).

## 7. 3 slot đội, giới hạn việc, Auto (04/11/2026, đã code, chưa kiểm chứng)

Spec: [crew-autoplay](crew-autoplay.md). Ghi đè mục 6: hàng `('workers','hire')` (không còn "2 chỗ, tối đa 1 robot") và bước chuyển save 6 (không còn xóa robot thứ hai). Không tăng `version`.

| Nơi | Thêm / đổi | Ghi chú |
|---|---|---|
| `farm/rules.js` | `FARM_SLOTS = 3`, `AUTOPLAY = { runs: 3, runMs: 600000 }`, `CARE_JOBS`, `JOB_GROUPS`, `jobGroupOf`, `groupLimit`, `nextGroupLevel`, `activeJobs(w)` | `activeJobs` là nguồn duy nhất cho "thợ làm việc gì" (crew.js, Thiết lập) |
| `farm/rules.js` `WORKER_CANDIDATES` | `robo-n1`, `robo-n2`, `robo-n3` (cùng chỉ số, bio dùng khóa `robo-n1`) | Nhiều robot cùng lúc |
| `cafe/recipes.js` | `MAX_CREW = 3`; ứng viên `robo-p1` (barista robot, `wage 4`, `fixedEffects { ms 15000, score 50, only 'phin-den', speed 2.2 }`); `STAR_CAP = { robot 1, staff 2, player 3 }` | `fixedEffects.only` = món duy nhất robot pha |
| save `farm.autoplay` | `{ runs: 0–3, leftMs: 0–600000 }`; thiếu → `{ runs: 3, leftMs: 0 }` | Ghi bằng `act('autoplay','start')` (còn `leftMs` thì chạy tiếp, không thì `runs − 1`, `leftMs = runMs`; hết lượt → fail) và `act('autoplay','spend', ms)` (trừ, kẹp 0; ms kẹp 0–60000) |
| save `workers[i].jobs` | không đổi kiểu | Thuê mới: người bật **1 mảng** đội đang thiếu, robot bật **1 việc**. `('workers','permission')` robot: bật việc mới tắt hết việc khác; người: bật mảng mới vượt `groupLimit` → fail. `permissionGroup care` kiểm như vậy |
| `cafe/service.js` | `isClaimed(key)` | Auto đọc bảng giữ chỗ |
| Không lưu | năng lượng `energy`, `slackUntil`, `slack` trên actor farm/agent quán | Mỗi lần tải bắt đầu lại 100 |

Quán (F-31): `cafe.supplies` bỏ `milk`, thêm `milk-dalat` (đầu 1000), `milk-meiji`, `lavie`, `matcha`; `cafe.gear.chasen` (0–1); save mới `cafe.prefs = { milk: 'milk-meiji'|'milk-dalat', water: 'tap'|'lavie' }` (thiếu/lạ → `milk-dalat`, `tap`). Act mới `('cafe','prefs', { milk? , water? })`, `('cafe','autoBrew')` (−`AUTO_BREW_COST` 2 xu). Công thức vẫn ghi `milk`/`water`; `resolveUses(uses, cafe)` đổi thành vật tư thật, `ingredientBonus` cộng chất lượng. Không cần chuyển save (đổi tên game đã xóa save cũ).

Quán: `('cafe','sell')` nhận thêm `cold?: true` → giá × 0,7 (service đã trừ 1★ trước khi gửi). Ly trong phiên có `madeAt` (ms, không lưu; dời khi quán tạm dừng). Báo cáo ca có `wasted` (số ly bỏ). `recipes.js` thêm `QUICK_MS`, `quickScore`, `FRESH_MS`, `freshFor`.

Chuyển save: `workers[i].jobs` cắt còn đúng `activeJobs` (người cấp thấp có mọi việc bật → chỉ còn mảng chăm cây; robot → 1 việc), nên dữ liệu lưu luôn khớp việc thợ thật sự làm; `orders/requestDelivery` và lý do chờ dùng `activeJobs`. Act `autoplay` không ghi nhật ký hoạt động. `farm.workers` lấp đủ 3 slot trước khi hoàn phí người dự bị; `cafe.crew` quá 3 người (không tính `gift`) → giữ 3 người đầu, bỏ người dư (bộ lọc `MAX_CREW` sẵn có).

## Bổ sung 04/11/2026 (triển khai audit)

| Trường / khóa | Ý nghĩa | Mặc định save cũ |
|---|---|---|
| `farm.coins` | Trần khi nạp save **5e13** (trước 1e12) để cent vẫn là số nguyên chính xác; kho, XP, thống kê vẫn trần 1e12 | — |
| `farm.cafe.reliefDay` | Ngày công đã nhận **hạt cứu trợ** (nơi chỉ quán: tiền < `SUPPLIER_PRICE` và hạt rang quán < 10 g → tặng `RELIEF_GRAMS = 300` g robusta chất lượng 65, nguồn `relief`, mỗi ngày công 1 lần) | −1 |
| `ledger[].type = 'gift'` | Hành trang bị đổi thành 150 xu nay ghi sổ cái | — |
| `godbean-progress-corrupt` | Bản thô của save hỏng/version lạ, chép **một lần** trước khi game ghi save mới (`readProgress`) | không có |
| Hành động `lessons/defer` | «Để sau»/Esc ở câu mẹo tính là đã hỏi hôm nay (`askedDay`, `askedCount`) | — |
| `supplierPrice(region)` (`farm/rules.js`) | Giá nhập hạt 500 g: 75 (`SUPPLIER_PRICE`) hoặc 45 ở nơi chỉ quán (`SUPPLIER_PRICE_CAFE_ONLY`); ngưỡng hạt cứu trợ dùng cùng giá | — |
| Chỉ đọc khi mở 2 tab (`state/progress.js`) | Tab khác ghi `godbean-progress` (event `storage`) → tab này bật `readOnly`, mọi hàm save thành no-op, farm báo «Game đang mở ở tab khác — tải lại để chơi tiếp ở đây». Định dạng save không đổi | — |

## 8. Dữ liệu mới theo tài liệu chuẩn (chốt 04/11/2026, CHƯA CODE)

Kế hoạch trường cho F-33…F-43. Khi code, sửa mục này thành "đã code" và ghi chuyển save cụ thể. Mọi trường mới: save cũ thiếu → tạo mặc định, không ghi đè dữ liệu đã có.

| Trường / khóa | Ý nghĩa | Mặc định save cũ | Spec |
|---|---|---|---|
| Khóa `godbean-memory` (**đã code 04/11**, `src/state/memory.js`) | `{ version: 1, entries: [entry], setup: {...} }` — sổ tay Coffee Memory, **tách khỏi** `godbean-progress` | không có → `{ version: 1, entries: [], setup: {} }` | [coffee-memory](coffee-memory.md) mục 6, 8 |
| Khóa `godbean-analytics` | Hàng chờ sự kiện (≤ 500) + `anonymous_player_id` | tạo khi mở game lần đầu | [analytics](analytics.md) |
| `settings.analytics` | Bật/tắt gửi thống kê ẩn danh | `true` | [analytics](analytics.md) mục 1 |
| `godbean-memory.setup.mode` | `quick` / `journal` / `scientist` (đã code 04/11; `scientist` chỉ dùng khi có Key Curiosity, không có Key thì UI coi như `journal`). Mục Scientist ghi thêm nhóm `equipment`, `preparation`, `ingredients`, `environment`, `personal`, `intended` (trường đã có trong mục Memory). Không thêm trường tiến trình mới: 10 mẻ gần nhất đọc từ `awakening.samples.batches`; doanh thu theo món chỉ nằm trong báo cáo ca (bộ nhớ, không lưu). Lưu trong sổ tay, **không** ở `settings` vì `normalizeSettings` bỏ trường lạ | `quick` | [coffee-memory](coffee-memory.md) mục 5 |
| `awakening` (**đã code 04/11**, `features/awakening/rules.js`) | Nguồn ghi: `farm.awakening` (model), `saveFarm` chép lên cấp 1 như `victories`. Dạng: `{ version:1, questions:{[id]:{state:'open'\|'trying'\|'ready'\|'solved', since, evidence:[ref], facts?:{số}, wrong?}}, fragments:[{id,type,questionId,at,tag}], messages:[type], messageAt:{type:at}, applied:[type], keys:[{id,at}], firstKey:{step 0–7, entries:[memoryId], variable, direction, attribute, after, rejected:[{id,vars}]}, samples:{harvests≤20, batches≤20, floorDays≤6, market} }`. `samples` là số liệu ngắn do người chơi tạo (hái, nhận mẻ, bán chợ), không có chữ riêng tư | save cũ thiếu → mặc định, 6 câu thiên đàng `open` | [decode-awaken](decode-awaken.md) mục 7 |
| `victories` (cấp 1) | `{ economic: at\|null, discovery: at\|null }` | cả hai `null` | [progression](progression.md) mục 4 |
| `farm.memoryXp` | `{ day, xp }` XP Memory đã nhận trong ngày công (trần 30) | `{day:-1,xp:0}` | [progression](progression.md) mục 2 |
| `farm.victories` | Bản sao của `victories` trong save farm (nguồn đọc khi tải); `saveFarm` chép lên cấp 1 | cả hai `null` | [progression](progression.md) mục 4 |
| `farm.market.xp` | XP chợ đã nhận trong ngày công (trần 40) | `0` | [progression](progression.md) mục 2 |
| `farm.mastery[recipe].tiers` | Mốc ★★/★★★ đã thưởng XP | suy ra từ `best` hiện có, **không** thưởng bù | [progression](progression.md) mục 2 |
| `farm.cafe.shiftLog` (**đã code 04/11**) | 10 ca gần nhất: `{ id, at, cups, revenue, costs (vật tư), wages, beans (hạt nhập), left, avgWait (giây), tier, meanPrice, crew, menu, milk, water, staffN, tiredN, staffStars, staffSecs }` (4 trường cuối: số ly nhân viên người pha, số ly pha lúc năng lượng < ngưỡng mệt F-29, sao TB và giây/ly của các ly đó; ca cũ = 0), ghi trong `act('cafe','shift')` (cảnh gửi thêm `avgWait`, `meanPrice`, `menu`, `staffN`, `tiredN`, `staffStars`, `staffSecs`). `farm.cafe.paid = {wages,beans,markW,markB}` cộng dồn lương/hạt để tính phần của từng ca | `[]` | [decode-awaken](decode-awaken.md) mục 7 |
| `farm.cafe.prices` | `{ [recipeId]: p }`, p 0,8–1,3 bước 0,05; chỉ lưu p ≠ 1; load/set đều clamp + làm tròn, món lạ bị bỏ; đổi bằng `act('cafe','prices',{recipeId,p})`, từ chối khi quán mở | `{}` (= 1,0) | [04-cafe/gameplay](../screens/04-cafe/gameplay.md) "Chủ quán tự đặt giá" |
| Lô `starter` save mới | Thêm 300 g hạt chè rang + 40 giấy lọc (F-40) | save cũ không đổi | [04-cafe/gameplay](../screens/04-cafe/gameplay.md) "Pour-over" |
| `SCORE_MODEL_VERSION` (hằng, không lưu riêng) | Ghi vào `entry.simulated.modelVersion` và sự kiện `brew_completed` | — | F-39 |
| Hệ số vùng (dữ liệu tĩnh) | `REGION_CROP[region][crop] = { yield, quality, growth }` | — | [02b-world-map](../screens/02b-world-map/README.md) "Vùng ảnh hưởng trồng trọt" |
