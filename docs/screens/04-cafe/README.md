# 04 · Quán cà phê

Người chơi vận hành một quán 3D: nhận order, tự pha từng ly theo công thức thật (tỉ lệ, độ xay, nhiệt, thời gian) ở bàn pha, bưng ra bàn, thuê nhân viên và nâng cấp quán. Quán là đầu ra của hạt rang từ [03 · Nông trại](../03-farm/README.md) và là nơi học pha cà phê. Quán không có model riêng: mọi kho, tiền, lô hạt đi qua model farm bằng `farm.act('cafe', …)`. Luật và số liệu: [rules.md](rules.md).

## Vào / ra

| Vào từ | Điều kiện |
|---|---|
| Nông trại: chạm công trình 3D Cửa quán (`cafe-entrance`) | Nơi có cả farm và quán; mở khi đã nhận nhiệm vụ Hái, hoặc đã bán ly, hoặc quán có doanh thu (`HUD_UNLOCKS` `cafe-play`). Nhân vật đi tới cửa rồi vào; Auto bật thì vào thẳng |
| Nông trại: nút ☕ trên HUD (`enterCafe`) | Như trên; khi Cửa quán đã dựng thì nút dẫn nhân vật tới cửa |
| Tải game ở nơi chỉ có quán | Tự vào quán, không có đường về farm |

| Ra tới | Khi nào |
|---|---|
| Nông trại | Nút 🌱 Nông trại, hoặc Esc hai lần trong 2,5 s (`exitCafe`). Quán tạm dừng; vào lại chơi tiếp đúng chỗ. Nhân vật đứng trước Cửa quán |
| Hội thoại Hội đồng (tại chỗ) | Chạm vật Hội đồng khi cửa đóng, hoặc nút ở báo cáo ca thường |

Farm vẫn chạy khi người chơi ở quán. Cảnh quán được giữ lại để vào lại nhanh.

## Luồng chơi

1. Lần đầu vào: đứng ở hiên. **Ca tập** tự mở nếu kho có ≥ 15 g chè rang; một khách gọi Pour-over V60 đứng sẵn ở quầy thu ngân. Thẻ quán dẫn 3 bước: nhận order → pha V60 (ly làm mẫu) → bưng ly. Bán ly đầu là xong ca tập, báo cáo có nút «🚪 Mở ca mới».
2. Ca thường 4 phút: mở cửa → khách xếp hàng hoặc dùng kiosk → nhận order → pha (tay, ⚡ Pha nhanh, hoặc 🤖 Auto pha) → bưng ra → thu tiền và tip.
3. Hết ca: báo cáo, thưởng theo mốc Đồng/Bạc/Vàng, mở ca mới hoặc nghỉ.
4. Giữa các ca: nhập hạt và vật tư, đặt giá món, nâng cấp, thuê và đào tạo nhân viên, ghi Sổ tay cà phê.

## Điều khiển

| Thao tác | Chạm | Chuột / phím |
|---|---|---|
| Đi | Joystick, hoặc chạm sàn/vật | Bấm sàn/vật, W A S D / mũi tên |
| Tương tác | Chạm quầy, bàn, kệ, kho, bảng thực đơn, sổ tay, cửa, biển ô trống | Bấm |
| Nhận order | Đứng sau quầy thu ngân (tự nhận mỗi 0,5 s) | Như chạm |
| Xoay / phóng camera | Kéo màn hình | Kéo chuột / cuộn |
| Nhân viên | Chạm người: «Nhắc» khi đang mải chơi/sắp chửi khách, còn lại mở bảng nhân viên | Bấm |
| Rót ở bàn pha | Giữ nút rót, thả trong vạch xanh | Giữ chuột hoặc Space |
| Về farm | Nút 🌱 | Esc hai lần trong 2,5 s |

HUD: dải trạng thái (⏱ ca, 🚪 cửa/hàng chờ, 🪑 ghế, ⭐ uy tín/combo, 🖐 ly trên tay), dải phiếu order (tối đa 8, đếm giây), thanh nút 🚪 Mở/Đóng · 🧺 Kho · 🌱 Nông trại, ngăn kéo 🛠️ Nâng cấp · 👥 Nhân viên · 📦 Đơn hàng · 📖 Sổ công thức · ⚙️ Cài đặt. Mọi modal ở giữa màn hình, có nút đóng, khóa di chuyển (trừ khi Auto bật).

## Dữ liệu

Khóa `godbean-progress` → object `farm` (định nghĩa ở màn 03):

| Trường | Đọc/ghi ở quán |
|---|---|
| `cafe.open`, `cafe.reputation`, `cafe.served`, `cafe.lost`, `cafe.revenue`, `cafe.costs` | Trạng thái và số đếm quán |
| `cafe.lots`, `cafe.stock`, `cafe.shipments`, `cafe.reserve`, `cafe.reliefDay` | Hạt rang, chuyến hạt, giữ hạt, hạt cứu trợ |
| `cafe.supplies`, `cafe.prefs { milk, water }` | Vật tư, sữa/nước đang dùng |
| `cafe.gear`, `cafe.tables[12]`, `cafe.prices` | Thiết bị, cấp từng bàn, hệ số giá món |
| `cafe.crew[] { id, level, paidUntil, shifts, incident, rest, gift }`, `cafe.paid` | Đội, lương đã trả |
| `cafe.mastery[món] { best, made, tiers }` | Thành thạo |
| `cafe.shiftLog[]` (10 dòng) | Nhật ký ca thường |
| `robotGift` | Gói thử robot |
| `coins`, `xp`, `stats.served`, `upgrades.cafe`, `orders` | Tiền, XP, ly tự bán, cấp bàn ghế, đơn hạt gửi farm |
| `tutorial.seen`: `cafe-intro`, `bench-intro`, `v60-guided` | Ca tập, lần đầu bàn pha, ly V60 làm mẫu |
| `lessons` | Mẹo thiên đàng, Hội đồng (chỉ đọc ở quán) |

Khóa `godbean-memory` (Sổ tay cà phê): `{ version, entries[], setup { mode, kit } }`.

Khách, ly trên kệ, ca đang chạy và năng lượng nhân viên chỉ sống trong phiên, không lưu.

## Code

| File | Vai trò |
|---|---|
| `src/features/cafe/game.js` | Cảnh 3D, điểm tương tác, vào/ra phiên, chọn vật, Auto ở quán, cửa, vật Hội đồng |
| `src/features/cafe/service.js` | Khách, hàng chờ, ca, ca tập, bảng việc nhân viên, sự cố, máy pha, công thức khoảng cách khách và mốc ca, bố cục |
| `src/features/cafe/bench.js` | Bàn pha: bước, chấm điểm, Pha nhanh, Auto pha, làm mẫu, trí nhớ, nháp Memory |
| `src/features/cafe/recipes.js` | Dữ liệu món, vật tư, thiết bị, ứng viên, vai, bàn, hằng số giá/sao/hạn tươi |
| `src/features/cafe/ui.js` | HUD quán, thẻ hướng dẫn, modal Kho, Nâng cấp, Menu giá, Bàn, Nhân viên, Sổ công thức, báo cáo ca |
| `src/features/cafe/memory-ui.js` | Modal Sổ tay cà phê (Quick Taste, Nhật ký, Scientist, So sánh) |
| `src/features/cafe/art.js` | Hình SVG dụng cụ cho bàn pha |
| `src/features/cafe/street.js` | Phố ngoài quán (nhà ống, vỉa hè), chỉ để nhìn |
| `src/features/cafe/feedback.js` | Hình và tiếng phản hồi (cửa, ly, sao, khách giận…) |
| `src/features/cafe/debug.js` | `?debug=grid` (lưới ô, kiểm tuyến) và `?debug=incident` |
| `src/features/farm/model.js` | `farm.act('cafe', …)`: pha, bán, thưởng ca, thuê, nâng cấp, hạt, gói thử robot, sự cố |
| `src/features/farm/rules.js` | `CAFE_SHIFT_MS`, `INCIDENTS`, `supplierPrice`, `RELIEF_GRAMS`, `AUTOPLAY` |
| `src/features/farm/game.js` | `enterCafe` / `exitCafe`, Cửa quán, nơi chỉ quán |
| `src/state/memory.js` | Lưu Sổ tay (`godbean-memory`), giới hạn, so sánh, sự kiện |
| `src/shared/game/morale.js` | Mệt, lười, ghét việc của nhân viên |

## Asset

| Slot / file | Dùng cho |
|---|---|
| `cafe/room`, `cafe/surroundings` ← `models/cafe/room.glb`, `surroundings.glb` | Phòng, cảnh quanh |
| `fixtures.glb`, `props.glb`, `plant.glb`, `pastry-case.glb` | Đồ cố định, đồ trang trí, cây, tủ bánh |
| `cafe/bar/counter`, `cafe/bar/v60`, `cafe/bar/steamer`, `cafe/bar/mixer`, `cafe/espresso-machine` ← `espresso-machine.glb` | Quầy pha và thiết bị |
| `cafe/register/counter-0/1` ← `register-counter.glb`; `cafe/pickup/counter` ← `pickup-counter.glb`; `cafe/kiosk/unit-0/1` ← `kiosk.glb` | Quầy thu ngân, quầy nhận đồ, kiosk |
| `table.glb` | Bàn, ghế theo cấp |
| `guest-m.glb`, `guest-f.glb`, `staff.glb` | Khách, nhân viên |
| `cafe/robot-waiter`, `cafe/robot-cleaner`, `cafe/robot-barista` ← `robots.glb#node` | Robot quán (khối tạm có bánh xe) |

Khối tạm giữ vai trò vùng cản, nên thay hình không đổi lối đi hay điểm đứng.

## Analytics

| Sự kiện | Khi |
|---|---|
| `brew_started { recipe }` | Bắt đầu pha một món ở bàn pha |
| `brew_completed { recipe, mode: hand/quick/auto, score, stars, model_version }` | Ra ly ở bàn pha |
| `tutorial_completed { step: 'first_cup', ms_since_start }` | Bán ly tự pha đầu tiên của save |
| `shift_ended { learning, cups, tier, left, revenue, costs }` | Hết ca thường (ca tập không phát) |
| `taste_submitted`, `memory_saved`, `memory_compared` | Ghi Quick Taste, lưu mục sổ tay, so sánh A/B |

## Chưa làm / điểm mở

- Nguồn chè cho ca tập khi lô `starter` hết ở nơi chỉ quán (Nhập hạt ngoài và cứu trợ chỉ có vối; hiện chỉ còn van an toàn).
- `models/cafe/robots.glb` chưa có, robot quán vẫn là khối tạm.
- Chip «🎯 tiếp theo» (thiết bị/món/uy tín gần nhất) và popup đổi uy tín trên HUD.
- Góc rang +15% trên cả giá và tip, cần uy tín 60.
- Combo chỉ tính ly người chơi tự pha.
- Nhịp trong ca: giờ cao điểm, khách quen, khách sành.
- Cold brew ủ trước theo mẻ.
- Latte art.
- Ly hỏng khi sai nhiều bước.
- Sữa, trứng sản xuất từ nông trại.
- ⓘ điểm ly mở bằng chạm-giữ (hiện chỉ bấm).
