# Hệ nông sản & vật nuôi cho rương bất ngờ

> Bản đề xuất để review (2026-11-06). Chưa code. 4 agent đọc code, 3 agent thiết kế theo 3 hướng (gọn trước / vui trước /
> kinh tế trước), 1 agent ghép bản tốt nhất, 1 agent rà soát với code thật. Các lỗi rà soát tìm ra đã được sửa trong
> bản này (xem mục 10).

> ⚠️ **Phát hiện quan trọng:** trong code hiện tại, sự cố Lv10 chỉ xảy ra **một lần cho mỗi save**
> (`story.level10Done`). Nơi thứ 2 trở đi chơi qua Lv10 mà không bị xoá nữa. Như vậy rương Lv10 và Lv15 ở nơi thứ 2
> **vẫn mở được**, và đồ trong đó giữ mãi. Bạn từng nói "bao giờ mở Round 2 thì mới hết sự cố". Nếu muốn vậy thì phải
> sửa: sự cố lặp lại ở **mỗi** nơi cho tới khi mở Round 2 (xem câu hỏi 12).

## So sánh 3 hướng thiết kế

| Tiêu chí (1-10) | A. Produce MVP | B. Farm Album | C. Economy-first |
|---|---|---|---|
| Vui với founder | 7 | 9 | 8 |
| Đơn giản trên điện thoại | 9 | 5 | 6 |
| Hợp code hiện tại (tái dùng) | 9 | 6 | 8 |
| Cân bằng kinh tế | 8 | 6 | 8 |
| Sẵn cho tương lai (Round 2, Lv100) | 7 | 8 | 9 |
| **Tổng** | **40** | **34** | **39** |

Chọn **A làm nền**. Ghép thêm từ C: rương đầu tiên ở mỗi nơi chắc chắn có đồ mới, danh sách "đã khám phá" giữ qua sự cố, heo bán thẳng ra xu tại chuồng. Ghép thêm từ B: Sổ khám phá (chỉ để trang trí), bong bóng trạng thái, tên con vật, mèo quán cà phê, trứng chờ mãi không mất.

---

## 1. Kết luận nhanh

- Rương Lv5 ở mỗi nơi mới **luôn có một thứ MỚI**: khoai tây, cà rốt, gà mái hay heo con (nông trại), hoặc Cà phê trứng hay mèo quán (quán cà phê).
- Cà phê vẫn là cây chính. Đồ mới cho **thêm xu mỗi giây**, còn **XP mỗi giây giữ nguyên hoặc thấp hơn**. Nhờ vậy nhịp Lv10 khoảng 20 phút gần như không đổi.
- Cây mới dùng lại toàn bộ luồng ô đất (trồng, lớn, thu). Chỉ cần thêm một điểm tổng quát: thu hoạch thì ghi vào `inventory[product]`.
- Mọi hàng dùng chung một sức chứa của kho (silo). Bán bằng một nút "Bán hết".
- Chuồng gà và chuồng heo đặt **cố định, miễn phí** trên bãi cỏ đông nam. Không cần menu xây, không cần bước đặt.
- Rương lọc theo game đang chơi. Người chơi quán không bao giờ nhận đồ nông trại.
- Sự cố Lv10 xóa sạch đồ mở khóa, hàng trong kho và vật nuôi (đúng luật "khởi động lại toàn bộ"). Chỉ giữ lại danh sách đã khám phá trong `story.seen`. Danh sách này đẩy rương ở nơi sau về phía thứ chưa thấy.
- Làm theo 4 giai đoạn: nền an toàn, cây trồng, gà, heo.

## 2. Nông sản & vật nuôi

Mốc so sánh là robusta: hạt giống 2 xu, lớn 15 giây, ra 2 hạt × 2 xu. Mỗi ô lãi 0,133 xu/giây và 0,067 XP/giây.

| id | Loại | Giai đoạn | Chi phí | Thời gian | Sản lượng | Giá bán | XP | Xu/giây | XP/giây | Ở đâu |
|---|---|---|---|---|---|---|---|---|---|---|
| `potato` | cây | 1 | hạt giống 4 | 30 giây | 3 khoai | 3/củ | 2 | 0,167/ô (×1,25) | 0,067 (bằng) | ô đất bất kỳ |
| `carrot` | cây | 1 | hạt giống 5 | 60 giây | 4 cà rốt | 4/củ | 4 | 0,183/ô (×1,4) | 0,067 (bằng) | ô đất bất kỳ |
| `eggCoffee` | đồ uống | 1b | 2 bean | pha 5 giây | 1 ly | 28 | 5 | hơn milk khoảng 27% | ít | menu quán |
| `chicken` | vật nuôi | 2 | thức ăn 2/con | 60 giây | 2 trứng/con | 4/trứng | 1/con | 0,10/con, chuồng 3 con = 0,30 | 0,017/con | chuồng gà cố định (17,14) |
| `shopCat` | vật nuôi | 2 | 0 | - | +5% giá đồ uống, vuốt ve +1 xu/60 giây | - | 0 | khoảng 0,05 | 0 | trong quán |
| `pig` | vật nuôi | 3 | thức ăn 8 | 150 giây (3 bậc lớn) | bán thẳng 40 xu | - | 3 | 0,21/chuồng | 0,02 | chuồng heo cố định (23,14) |

Vòng chơi:

- **Khoai tây:** cây ngắn, hợp người hay chạm. Lá mọc thành bụi, khi chín thì củ nâu nhô lên mặt đất.
- **Cà rốt:** cây chậm, trồng xong đi làm việc khác rồi quay lại thu. Đỉnh cam ló ra ở mức lớn 0,45.
- **Gà (3 con, mỗi con một ô):** Đói (bong bóng 🌾) → bấm "Cho ăn hết" (2 xu × số con đói) → 60 giây → trứng nằm cạnh gà (bong bóng 🥚) → bấm "Nhặt" → trứng vào kho. Trứng **chờ mãi**, nên đi vắng không bị phạt. Gà không chết, không buồn.
- **Heo (1 ô):** Heo con đói → cho ăn 8 xu → lớn qua 3 bậc kích thước (0,6 / 0,8 / 1,0) trong 150 giây → bong bóng ⭐ → bấm "Bán ra chợ" được 40 xu. Xu vào thẳng ví, **không chiếm chỗ trong kho**. Ngay sau đó có heo con mới, đang đói. Lời thoại chỉ là "bán ra chợ", không có hình ảnh thịt.
- **Cà phê trứng:** chỉ cần bean, không cần nguyên liệu mới. Vì vậy người chơi chỉ có quán luôn pha được.
- **Mèo quán:** đi lang thang, ngủ trên bàn. Bấm vào để vuốt, tim bay lên. Mèo không có nhu cầu gì, chỉ để vui.

Thưởng sản lượng:

- Máy sấy (dryer) cộng cho **mọi cây**. Nếu chỉ cộng cho cà phê thì từ Lv2 (đã có máy sấy) khoai và cà rốt còn lãi kém robusta, nên rương thành "quà lỗ".
- `yieldBonus` của staff cộng cho mọi cây, làm tròn xuống.
- Vật nuôi không nhận bonus trong giai đoạn đầu.

Mỗi con vật có tên ngẫu nhiên lấy từ danh sách theo ngôn ngữ (vi: Bông, Mít, Na, Cốm; en: Biscuit, Pip, Clover). Tên được chọn bằng hash của `uid`, nên reducer vẫn thuần.

## 3. Rương bất ngờ

### 3.1 Cách bốc

`chestPrize(roll, ctx)` vẫn là hàm thuần, với `ctx = { game, owned, discovered, firstOfPlace }`.

- Mỗi giải có thẻ `games: ['farm'] | ['cafe'] | ['farm','cafe']`. Giải mở khóa có thêm `unlock: '<id>'`.
- Bốn giải cũ (jackpot 3, helpers 2, beans 2, auto 1) **giữ nguyên thứ tự và trọng số ở đầu mảng**. Giải mới thêm vào cuối.
- Gọi không có `ctx` thì chạy y như hôm nay. Nhờ vậy test `chestPrize(0)='jackpot'` và `chestPrize(0.99)='auto'` vẫn qua.

| Kho giải | Giải | Trọng số |
|---|---|---|
| Chung | jackpot, helpers, beans, auto | 3, 2, 2, 1 |
| Nông trại | potato, carrot (GĐ1); chicken (GĐ2); pig (GĐ3) | 4, 4; 4; 3 |
| Quán | eggCoffee (GĐ1b); shopCat (GĐ2); món sau này (GĐ3) | 4; 3; ... |

Luật bốc:

1. **Rương đầu tiên của mỗi nơi** (rương nhận đầu tiên kể từ sự cố gần nhất, tức Lv5 ở Round 1): chỉ bốc trong kho mở khóa của game đó, trừ các id đã có. Đây là bất ngờ được bảo đảm.
2. Trong kho đó, id **chưa có** trong `discovered` được nhân đôi trọng số. Mỗi nơi mới vì thế dễ ra thứ khác. Khi đã thấy hết thì trọng số về bình thường.
3. Các rương sau (Lv15 trở lên ở các vòng sau): bốc trong toàn bộ kho, gồm giải chung và giải mở khóa chưa có.
4. Không biết game nào (không có region): chỉ bốc giải chung.

Nội dung giải mở khóa:

- `[{kind:'unlock', id}, {kind:'coins', amount: 40×L}]`. Ở Lv5 là đồ mới + 200 xu.
- Giải gà và heo thêm `{kind:'animal', id, amount}`: tặng luôn chuồng và con vật.
- Giá trị đồ mới so với jackpot 750 xu: khoai tây hơn robusta khoảng 0,034 xu/giây × 18 ô × 600 giây ≈ 370 xu, cộng 200 xu thưởng, tổng khoảng 570 xu. Gần jackpot, cảm giác không thua thiệt. Sim sẽ kiểm lại.

### 3.2 Trùng lặp

- Id đã nằm trong `s.unlocks` bị loại khỏi kho **trước khi** bốc.
- Kho trống thì quay về giải chung.
- Nếu id trùng vẫn lọt tới `grantItems` (save cũ), nó đổi thành `60×L` xu. Rương không bao giờ rỗng.
- `grantItems` phải xử lý mọi `kind`. Có test kiểm tra mọi item trong `CHEST_PRIZES`.

### 3.3 Người chơi quán

- Không bao giờ nhận đồ nông trại. Ở Round 1 `bothGames()` là false, và đồ "để dành" sẽ bị sự cố xóa trước khi kịp dùng.
- Người chơi chỉ nông trại cũng không nhận đồ quán.
- GĐ1b quán chỉ có `eggCoffee`, nên bất ngờ ở mọi nơi đều giống nhau. Từ GĐ2 có thêm `shopCat` nên bắt đầu đa dạng.

### 3.4 Sự cố Lv10

Theo phương án A, khớp luật founder:

- `expiry/execute` đặt `s.unlocks = []` và đưa mọi khóa trong `GOODS` về 0.
- Chuồng và vật nuôi mất theo region.
- Trước khi xóa, ghi `story.seen['found:<id>'] = placeIndex`. `story` được giữ lại, nên dữ liệu này nuôi luật 2 và Sổ khám phá.
- `rewards.claimed` bị reset, nên Lv5 ở nơi mới được bốc lại.
- Snapshot ghi lại `unlocks` và hàng hóa để debug.
- Đổi sang phương án B (giữ đồ mở khóa vĩnh viễn) chỉ cần sửa một dòng, vì `unlocks` nằm ở cấp cao nhất.

## 4. Kho & bán

Bảng `GOODS` đặt trong `economy.js`, cạnh `BEANS`. `BEANS` giữ làm alias.

| good | sellPrice | icon | Ghi chú |
|---|---|---|---|
| `beans` | 2 | 🫘 | buyPrice 4, như cũ |
| `potato` | 3 | 🥔 | GĐ1 |
| `carrot` | 4 | 🥕 | GĐ1 |
| `egg` | 4 | 🥚 | GĐ2 |

Heo không phải hàng trong kho, xu vào thẳng ví.

Luật kho:

- `CROPS` có thêm `product` (mặc định `'beans'`) và `amount`. Các cây cà phê giữ trường `beans`. `yieldOf` đọc `amount ?? beans`.
- `inventory` mặc định là `{beans, potato, carrot, egg}`, tất cả bằng 0. `normalizeSave` kẹp mọi khóa `GOODS` thành số nguyên từ 0 đến 1e9 trong một vòng lặp.
- Chỉ thêm khóa, **không tăng SCHEMA**.
- **Một sức chứa chung:** `stored(s)` là tổng hàng trong kho. Mọi chỗ `inventory.beans >= cap` đổi thành `stored(s) >= cap`: thu hoạch, nhặt trứng, staff, autoplay, pill đầy, chấm toolbar.
- Giữ trần mềm: một lần thu được phép tràn, lần sau bị từ chối với `storageFull`.
- `beanBuyQuote`: chỗ trống = `cap - stored`.

Bán hàng:

- Action mới `farm/sell {good?}`. Không truyền `good` thì bán hết, có thì bán đúng hàng đó.
- `sellQuote(s, good)` tính giá. Event `goodsSold {lines, coins}`. Vẫn phát `beansSold` khi có bean, để tutorial không gãy.
- `farm/sellBeans` giữ làm alias.
- Thêm `animal/sellPig`.
- Mọi action mới phải khớp regex `PAUSABLE`.

Grace (cứu người kẹt): chỉ bật khi `stored(s) === 0`, không có trứng chờ nhặt và không có heo đã lớn. `freeCrop` vẫn chỉ là robusta.

Staff:

- `cropFor` giữ cách chọn cà phê như hiện tại. Staff **không tự trồng** cây từ rương, trừ khi người chơi đang chọn cây đó (`activeCrop`).
- Kiểm tra sức chứa bằng `stored()`.
- Staff chưa cho gà ăn trong bản đầu. Vật nuôi là lý do để người chơi tự quay lại.

## 5. Giao diện

**Mở rương** (`modal.js gift`):

- Giữ luồng hộp → mở → nhận.
- Item `unlock` hiện thành **một hàng chính** (`.hud-gift-item--unlock`): emoji lớn 64px nảy vào, viền vàng, ruy băng đỏ "MỚI!", tiêu đề `T('hud.gift.unlock.<id>')`, ví dụ "Khoai tây! Hạt giống mới cho ruộng của bạn".
- Dòng xu thưởng nằm bên dưới. Tối đa 3 dòng cho vừa thẻ 320px.
- Nút phụ "Xem ngay":
  - Cây: gọi `setActiveCrop(id)` rồi mở Seeds.
  - Gà/heo: camera lia tới chuồng, chuồng hiện lên với bụi và lấp lánh, gà nhảy ra kèm bảng tên trong 2 giây.
  - Quán: mở Menu.
- Lần đầu có vật nuôi, Teacher nói một câu qua `modals.dialogue`.

**Sau khi nhận:**

- Toast `giftOpened`, ví dụ "Khoai tây đã vào túi hạt giống".
- Chấm đỏ "MỚI" trên Seeds/Menu tự bật nhờ `seenKey`/`drinkSeenKey` sẵn có.

**Bảng Seeds:**

- Nhãn sản lượng dùng `GOODS[def.product].icon × amount` thay cho 🫘 cố định.
- Cây từ rương chưa có thì gộp thành **một hàng bí ẩn**: "? Hạt giống bí ẩn, có trong rương bất ngờ". Hàng này dạy người chơi rằng rương chứa đồ mới mà không lộ là đồ gì.

**Thẻ kho** (`action-bar.js`):

- Thanh `stored/cap`.
- Mỗi hàng đang có một dòng (icon, số lượng, xu). Chạm vào dòng để bán riêng hàng đó.
- Nút chính "Bán hết (+N xu)". Nút này giữ `data-hud-id 'sellBeans'` cho tutorial.

**Top bar:**

- Vẫn 2 pill.
- Ở nông trại, pill bean thành pill kho: 📦 `stored/cap` khi có hàng không phải bean. Id vẫn là `hud-beans`, nên hiệu ứng bay vẫn chạy.
- Ở quán vẫn là 🫘.
- Thu hoạch và nhặt trứng bay icon của đúng hàng đó.

**Bong bóng trong thế giới:** cập nhật theo nhịp badge 0,25 giây. 🌾 gà đói, 🥚 có trứng, 🍽 heo đói, ⭐ heo lớn, 📦 kho đầy.

**Thẻ chuồng:** cùng mẫu với `plotCard`.

- Gà: tên, trạng thái, đếm ngược, nút "Cho ăn hết (n × 2)" và "Nhặt trứng".
- Heo: bậc lớn, nút "Cho ăn 8" hoặc "Bán 40".

**Sổ khám phá** (GĐ2, trong bảng Progress): dãy sticker. Thứ chưa tìm thấy hiện màu xám kèm "?". Thứ đã tìm hiện màu kèm "Tìm thấy ở nơi #n". Chỉ để trang trí, không cho sức mạnh.

**Toolbar:** giữ đúng 4 công cụ + nút bean. Vật nuôi nằm trên bản đồ, không thành nút riêng.

**i18n:** chỉ sửa `v3-hud.js` và `v3-realm.js`, không thêm file `v3-*` mới. Mỗi khóa có cả en và vi:

- `crop.potato`, `crop.carrot`, `good.<id>`, `drink.eggCoffee`, `animal.<id>`, `building.coop`, `building.pen`
- `hud.gift.prize.<id>`, `hud.gift.unlock.<id>`, `hud.gift.item.unlock`
- `hud.seeds.mystery`, `hud.storage.sellAll`
- bong bóng, danh sách tên, `album.*`

Mở rộng các nhóm khóa động trong `i18n.test`: `gift.prize`, `gift.item`, `gift.unlock`, `good`, `animal`.

## 6. Hình ảnh 3D

Làm procedural trước, nên code không phải chờ art. Geometry và material dùng chung ở cấp module. Không cấp phát mới cho mỗi ô.

| Thứ | Dùng lại | Làm mới |
|---|---|---|
| Khoai tây | đường cong scale và nhún khi chín của `plots.js` | bụi lá từ 3-4 Icosahedron xanh, 2-3 khối cầu nâu dẹt khi chín |
| Cà rốt | như trên | lá mảnh dạng cone, đỉnh cone cam ló lên theo mức lớn |
| Vfx thu hoạch | burst `leaf` + `soil` | bỏ `cherry` cho cây củ |
| Gà | wander theo kiểu `staff.js` (chỉ trong hình chữ nhật của chuồng) | khoảng 5 primitive gộp làm 1 BufferGeometry (vertex color), 1 InstancedMesh tối đa 3 con, nhún/mổ procedural, không rig |
| Chuồng gà | hàng rào `world.js:357-390`, `market-tier-1.glb#crates` làm ổ, `grounds.glb#field_gates` | hộp + mái lăng trụ |
| Heo | như gà | khối bo + mõm cylinder + tai cone, màu hồng, scale theo bậc lớn |
| Chuồng heo | hàng rào procedural, `well-tier-1.glb` làm máng ăn, `decor.glb#decor_sign` làm bảng tên | vệt bùn |
| Mèo | wander trong `CAFE_BOUNDS` | capsule + tai cone + đuôi |
| Icon HUD | emoji 🥔 🥕 🥚 🐔 🐷 🐈 | SVG 24px hai tông `seed-potato`/`seed-carrot` (tùy chọn) |
| SFX | `farm.plant`, `farm.harvest`, `coin.gain`, `ui.pop` | tiếng cục tác, ụt ịt, rừ rừ (sau này) |

Art sau này: GLB tự làm trong Blender, theo quy ước node của `coffee-tree.glb` (`#plant`, `#crop_unripe`, `#crop_ripe`). Mỗi file dưới 150 KB, qua `scripts/optimize-models.mjs`, nạp qua `CROP_MODELS` và giữ bản procedural làm fallback. Không sao chép model hay tên của game khác.

## 7. Kế hoạch code

| Giai đoạn | Nội dung | File |
|---|---|---|
| **0. Nền an toàn** | Bảng `GOODS`. Vòng kẹp inventory. Bỏ plot có crop lạ. `stored()`. `farm/sell` + alias. Test mọi `kind` trong `grantItems`. Thêm đường bán cho sim | `economy.js`, `state.js`, `migrate.js`, `derive.js`, `game.js`, `economy-sim.mjs`, tests |
| **1. Cây từ rương** | `potato`/`carrot` (`rewardOnly`, `level: Infinity`). `s.unlocks`. `cropUnlocked` đọc `unlocks`. `yieldOf` theo product (dryer chỉ cho cà phê). `chestPrize(roll, ctx)` theo các luật ở mục 3. Kind `unlock`. Sự cố xóa và ghi `found:*`. Cây procedural. Hàng chính khi mở rương. Thẻ kho. Pill kho. Hàng bí ẩn trong Seeds | trên + `plots.js`, `realm/index.js`, `staff.js`, `modal.js`, `v3.css`, `action-bar.js`, `sheets.js`, `top-bar.js`, `toolbar.js`, `feedback.js`, `v3-hud.js` |
| **1b. Quán** | `DRINKS.eggCoffee` (`rewardOnly`). `drinkUnlocked` đọc `unlocks`. Kho giải quán | `economy.js`, `derive.js`, `sheets.js` (Menu) |
| **2. Gà + mèo + sổ** | `ANIMALS.chicken`, `region.animals`, `animalState` (tách helper `timerState` dùng chung với `plotState`). `animal/feed`, `animal/collect`. Chuồng cố định [15,12,19,16]. Module mới `animals.js`. Bong bóng. Thẻ chuồng. `shopCat`. Sổ khám phá | `economy.js`, `layout.js`, `state.js`, `derive.js`, `game.js`, `realm/animals.js` (mới), `cafe.js`, `action-bar.js`, `sheets.js`, `v3-realm.js` |
| **3. Heo + art** | `ANIMALS.pig`, chuồng [21,12,25,16], `animal/sellPig`. Thêm món quán (bánh cà rốt). GLB tự làm | như GĐ2 + `public/models/farm/*` |

Sim (`economy-sim.mjs`):

- Thêm lối chơi chỉ nông trại có bán hàng.
- Thêm kịch bản ép rương Lv5 ra từng giải, rồi trồng cây mới trên nửa số ô.
- Mục tiêu: chỉ nông trại đạt L10 trong 20 phút ± 10% với mọi giải. Chỉ quán vẫn nằm trong 22-30 phút khi có `eggCoffee`.

Test:

- `chestPrize` cũ không đổi khi gọi không có `ctx`.
- Quán không bao giờ nhận `potato`.
- Rương đầu mỗi nơi luôn là đồ mới. Id đã có bị loại. Thiên vị `discovered` có hiệu lực.
- Thu khoai vào `inventory.potato`. Kho chung chặn thu cà phê. Bán hết ra đúng xu.
- Sự cố xóa hàng và `unlocks`, nhưng giữ `found:*`.
- Grace không bật khi còn khoai chưa bán.
- Normalize kẹp hàng mới và bỏ id rác.

## 8. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Nhịp L10 nhanh lên vì thêm xu | XP/giây bằng hoặc thấp hơn, chặn bằng sim trước khi chốt số |
| `grantItems` bỏ qua `kind` lạ, rương ra mã khóa thô | Ra reducer, icon, i18n cùng lúc, có test phủ mọi `kind` |
| Đổi chữ ký `chestPrize` làm gãy test | Giữ đường không `ctx`, giải mới thêm vào cuối |
| Save có crop hoặc animal lạ làm `plotState` lỗi | Normalize bỏ chúng trước khi ra cây mới. Không bao giờ xóa id đã phát hành |
| Còn khoảng 20 chỗ đọc thẳng `inventory.beans` | Grep rà soát, dùng `stored()`, có test |
| Kho chung đầy làm farmhand đứng | Pill kho nhấp nháy, "Bán hết" một chạm, autoplay tự bán |
| Mesh procedural cấp phát cho mỗi ô làm chậm điện thoại | Dùng chung geometry/material, InstancedMesh, tối đa 3 gà + 1 heo + 1 mèo |
| Chuồng cố định đè lên decor cũ hoặc chắn đường tới silo | Lúc tặng chuồng thì chuyển decor đè sang kho hoặc hoàn tiền. Kiểm tra nav từ spawn tới silo |
| Mất khoai ở Lv10 thấy bất công | Cảnh sự cố hoặc Teacher nói "hạt giống cũng mất". Sổ khám phá vẫn giữ |
| Lời thoại "bán heo" lệch tông | Chỉ nói "bán ra chợ", không có hình ảnh thịt. Câu hỏi 4 có phương án thay |

## 9. Cần bạn chốt

1. **Đồ mở khóa có giữ qua sự cố Lv10 không?** Mặc định: xóa (A). Chỉ giữ danh sách đã khám phá và Sổ khám phá.
2. **Rương đầu mỗi nơi luôn có đồ mới, hay bốc ngẫu nhiên hoàn toàn?** Mặc định: luôn có đồ mới.
3. **Seeds hiện một hàng "Hạt giống bí ẩn", hay ẩn hẳn?** Mặc định: hiện một hàng bí ẩn.
4. **Heo "nuôi rồi bán ra chợ", hay heo đi đào nấm quý lặp lại?** Mặc định: bán ra chợ, lời thoại nhẹ nhàng.
5. **Giai đoạn đầu chỉ có cây, vật nuôi ra sau?** Mặc định: có. Gà ra ngay ở GĐ2.
6. **Quà quán GĐ1 là Cà phê trứng chỉ dùng bean?** Mặc định: có. Món cần mua nguyên liệu để sang Round 2.
7. **Thêm rương Lv8 để mỗi nơi có 2 bất ngờ?** Mặc định: chưa. Đo sim trước.
8. **Một sức chứa chung, hay kho riêng cho nông sản?** Mặc định: một sức chứa chung.
9. **Staff có cho gà ăn không?** Mặc định: không trong bản đầu.
10. **Round 2: trứng và cà rốt từ nông trại đi thẳng sang quán như bean?** Mặc định: có, nhưng chốt khi thiết kế Round 2.
11. **Có cần GLB tự làm trước khi ra mắt?** Mặc định: không. Ra bản procedural trước, art làm ở GĐ3.
12. **Sự cố Lv10 lặp lại ở mỗi nơi cho tới khi mở Round 2, hay chỉ một lần như code hiện tại?** Mặc định đề xuất: lặp lại ở mỗi nơi, đúng ý bạn. Khi đó mỗi nơi chỉ mở được rương Lv5 trước khi bị xoá.
13. **Người chơi quán có ít bất ngờ** (kho giải chỉ có Cà phê trứng, sau thêm mèo). Có làm thêm 2–3 món/đồ quán ngay giai đoạn đầu không? Mặc định: thêm 1 món bánh và 1 đồ trang trí quán.

## 10. Rà soát với code (đã sửa trong bản này)

| Vấn đề tìm ra | Đã sửa thế nào |
|---|---|
| Sự cố Lv10 chỉ xảy ra 1 lần/save (`level10Done`), không phải ở mỗi nơi | Ghi rõ ở đầu tài liệu, thêm câu hỏi 12 |
| Máy sấy chỉ cộng cà phê thì khoai/cà rốt lỗ hơn robusta | Máy sấy cộng mọi cây |
| Vật nuôi cộng thêm XP ngoài ô đất, làm nhanh nhịp Lv10 | Giảm XP: gà 1/con, heo 3; sim phải kiểm |
| `eggCoffee` thêm cuối `DRINK_ORDER` sẽ thành món được gọi nhiều nhất (khách chọn món theo vị trí) | Chèn cạnh `milk` hoặc cho trọng số gọi món thấp; đặt rõ `roaster` |
| Staff/auto sẽ tự trồng cà rốt nếu thêm vào cuối `CROP_ORDER` | Staff không tự chọn cây từ rương (mục 4) |
| Chấm đỏ "MỚI" không hiện lại khi nhận lại cùng đồ ở nơi sau (`story.seen` giữ qua sự cố) | Xoá khóa `hudCrop:`/`hudDrink:` của đồ từ rương khi sự cố |
| Gọi `chestPrize` không có `ctx` mà thêm giải vào cuối sẽ đổi kết quả test cũ | Khi không có `ctx`: chỉ bốc trong giải chung; `ctx` dựng trong reducer từ `regionGame` |
| Save không có bộ đếm "nơi thứ mấy" | Lưu `found:<id> = true`; nơi 1 / nơi 2+ suy từ `level10Done` |
| Action `animal/*` nằm ngoài regex `PAUSABLE` | Thêm `animal` vào `PAUSABLE` + test bị chặn khi đang sự cố |
| Quán có quá ít giải bất ngờ | Thêm câu hỏi 13 |
