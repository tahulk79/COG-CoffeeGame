# 03 · Nông trại

Màn chính của game. Người chơi trồng, chăm, hái cà phê, phơi và rang hạt, bán ở Chợ hoặc chuyển sang quán, rồi mua ruộng, nâng cấp, thuê thợ. Farm giữ model dữ liệu cho cả game (`createFarm` trong `model.js`); quán (04) mở từ đây và dùng chung model này. Luật và số liệu: [rules.md](rules.md).

## Vào / ra

| Vào từ | Điều kiện |
|---|---|
| 02 · Thiên đàng | Xong thiên đàng (nhận quà khởi đầu) |
| Mở game | Save đã có `farm` hoặc `heaven.completed` (`app/game.js`) |
| 04 · Quán | Bấm rời quán; nhân vật đứng trên thảm Cửa quán |

| Ra tới | Khi nào |
|---|---|
| 04 · Quán | Chạm Cửa quán (đi tới thảm rồi vào) hoặc ☕ Vào quán trong ≡; chỉ nơi có cả farm và quán |
| 04 · Quán (ngay khi vào) | Nơi chỉ có quán: farm chỉ giữ dữ liệu, mở thẳng quán |
| Hội đồng (tại chỗ) | Chạm Cổng Hội đồng: hội thoại đáy màn, đóng là về farm, không đổi cảnh |

## Luồng chơi

1. Save mới: tutorial ép 4 bước gieo → hái → phơi → rang (rules mục 10).
2. Theo thẻ mục tiêu: hái, bán ly đầu ở quán, phơi, rang, bán ở Chợ, gửi hạt về quán, mua ruộng 2, tưới, làm cỏ (rules mục 8).
3. HUD và công trình mở dần: Cửa quán, Sạp, Bảng đơn, Nhà thợ, Nâng cấp, Xây dựng, dải ⛏️ (rules mục 9).
4. Vòng lặp: chăm cây → hái → chế biến → bán/chuyển quán → mở ruộng, nâng cấp, thuê thợ (rules mục 4–7, 11, 13).
5. Chuyên gia lần lượt có mặt ở Cổng Hội đồng; trả lời đúng nhận mẹo (rules mục 9).
6. Khi muốn rảnh tay: bật Auto, hoặc thuê đủ 3 thợ và đặt chỉ thị (rules mục 11–12).

## Điều khiển

| Thao tác | Chuột / bàn phím | Cảm ứng |
|---|---|---|
| Đi | Bấm mặt đất, WASD/mũi tên | Joystick, chạm mặt đất |
| Làm việc với cây | Bấm cây (Tự chọn); bấm cây chín là hái | Chạm cây |
| Gieo | Bấm ô trống → chọn giống ở dải dưới; kéo túi hạt qua nhiều ô | Như chuột |
| Công cụ nhiều ô | Chọn công cụ ở dải ⛏️, kéo qua các ô, thả | Như chuột; ngón tay sát mép màn thì camera trôi |
| Mua ruộng | Bấm ô/biển ruộng khoá → đi tới biển → xác nhận | Như chuột |
| Công trình | Bấm trạm, giỏ thành phẩm, Sạp, Bảng đơn, Nhà thợ, Cửa quán, Cổng Hội đồng | Chạm |
| Camera | Kéo (> 8 px) để dịch, con lăn hoặc +/− để zoom (0,8–1,65) | Kéo một ngón; nút +/− |
| Về nhân vật | Bấm avatar/tên | Chạm avatar/tên |
| Xây dựng | R xoay, Esc huỷ | Nút xoay, huỷ |
| Đóng hộp | Esc đóng hộp trên cùng | Nút × |

Khi Auto bật, chạm bản đồ, joystick và phím di chuyển bị bỏ qua; camera và công trình vẫn dùng được (rules mục 12).

## Dữ liệu

Lưu ở `localStorage` khoá `godbean-progress` (`state/storage-keys.js`), trường `farm` (object `version: 3`), ghi qua `saveFarm` (`state/progress.js`). `saveFarm` chép thêm `victories` và `awakening` lên gốc. Mỗi `act` thành công lưu ngay; ngoài ra lưu mỗi ≥ 5 s (`tick`).

Đọc khi tạo: `startingGift` / `heaven.gift`, câu đúng/đã gặp ở thiên đàng, `startingRegion`.

| Nhóm | Trường trong `farm` |
|---|---|
| Chung | `region`, `version`, `timingVersion`, `contractVersion`, `deploymentVersion`, `staffRoutineVersion`, `epoch`, `lastAt`, `sequence`, `workRevision` |
| Tiền, cấp | `coins`, `xp`, `upgrades`, `canLevel` |
| Đất, cây | `fields`, `plots[]` (`stage`, `cropId`, `mature`, `growthMs`, `water`, `weeds`, `fertilized`, `pruned`, `readyYield`, `quality`, `health`, `season`), `archivedLand` |
| Vật tư, nước | `seeds`, `fertilizer`, `water`, `reservoir`, `durability` |
| Kho | `lots[]`, `stock` (dựng lại từ `lots`) |
| Chế biến | `machines.dryer/roaster` (`batch`, `extraBatches`) |
| Đơn, chợ | `orders[]`, `order` (đơn Chợ), `orderIndex`, `lastOrderDay`, `market` (`day`, `sold`, `orders`, `xp`) |
| Nhân viên | `workers[]` (`jobs`, `shiftUntil`, `restUntil`, `paidDays`, `incident`, `autoPay`, `xp`…), `rejectedCandidates`, `directives` |
| Tiến trình | `stats`, `claimed`, `today`, `tutorial.seen`, `lessons` (`learned`, `granted`, `asked`, `met`, `arrived`…), `memoryXp`, `victories`, `awakening` |
| Khác | `decorations[]`, `autoplay` (`runs`, `leftMs`), `gift`, `giftApplied`, `journal`, `ledger`, `reputation`, `legacyBackup` |
| Quán | `cafe`, `robotGift`: thuộc màn 04 |

Cờ `tutorial.seen` của farm: `controls`, `quest-guide`, `tools`, `farm-intro`, `farm-intro-new`, `unlock-<id>`, `unlock-<id>-used`.

## Code

| File | Vai trò |
|---|---|
| `src/features/farm/game.js` | Khởi tạo cảnh farm, nối input ↔ model, tutorial, công trình, Hội đồng, Auto, vào/ra quán |
| `src/features/farm/model.js` | `createFarm`: state, luật, mọi `act`, lưu, tính bù vắng mặt, sự kiện |
| `src/features/farm/rules.js` | Hằng số và công thức: thời gian, giá, chợ, nâng cấp, lương, sự cố, slot, Auto, hệ số vùng |
| `src/features/farm/content.js` | Giống, chăm sóc, ruộng, ô, trạm, công trình, nhiệm vụ, mốc HUD, bảng cấp |
| `src/features/farm/progression.js` | Trần XP, XP luyện món/ký ức/giải mã, tài sản, mục tiêu thắng |
| `src/features/farm/intro.js` | Bước tutorial `farm-intro` suy ra từ state |
| `src/features/farm/autoplay.js` | Chọn việc ruộng/trạm và việc hậu cần cho Auto |
| `src/features/farm/crew.js` | Hình và vòng làm việc của thợ: phân công, vùng, đi lại, lười/mệt, sự cố, tự gia hạn |
| `src/features/farm/worker-planner.js` | Chọn giống thợ trồng, thưởng việc chờ lâu |
| `src/features/farm/activity.js` | Bong bóng trạng thái và đạo cụ trên đầu người làm |
| `src/features/farm/orders.js` | Các bước chuẩn bị đơn, lượng cần sản xuất |
| `src/features/farm/tools.js` | Giới hạn và điều kiện kéo công cụ |
| `src/features/farm/blockers.js` | Danh sách Cần xử lý |
| `src/features/farm/ui.js` | HUD, modal (kho, cửa hàng, trạm, đơn, nhân viên, nâng cấp), dải giống/công cụ, kéo |
| `src/features/farm/environment.js` | Khối tạm 3D: ruộng, trạm, đường, rào, ao, Cổng Hội đồng, công trình |
| `src/features/farm/assets.js` | Tải và gắn model GLB của farm |
| `src/features/farm/decorations.js` | Đồ trang trí, vùng cấm xây, dời đồ save cũ |
| `src/features/farm/decoration-builder.js` | Luồng đặt, xây, phá đồ trang trí |
| `src/features/farm/feedback.js` | Âm thanh và hiệu ứng theo hành động |
| `src/shared/world/scene.js` | Cảnh 3D dùng chung: camera, chạm, va chạm, tìm đường, hàng đợi ô |
| `src/shared/game/navigation.js` | A* lưới 0,35 |
| `src/shared/game/morale.js` | Tính cách, năng lượng, lười/mệt |
| `src/ui/hud-drawer.js` | Ngăn ≡ Quản lý |
| `src/ui/autoplay-hud.js` | Nút Auto, bàn tay chỉ, dòng giải thích |
| `src/ui/incidents.js` | Bong bóng sự cố nhân viên |
| `src/shared/analytics/wire.js` | Chuyển sự kiện model sang analytics |
| `src/state/progress.js` | `saveFarm`, đọc save |

## Asset

| Asset | Dùng cho |
|---|---|
| `public/models/farm/coffee-tree.glb` | Cây cà phê (quả chín; bản quả xanh tô lại trong code) |
| `dryer-tier-1.glb`, `roaster-tier-1.glb`, `well-tier-1.glb` | Sân phơi, lò rang, giếng bậc 1 |
| `grounds.glb`, `props.glb`, `decor.glb` | Đường/rào/ao, đạo cụ, cờ bậc và đồ trang trí |

Slot thay asset (khối tạm đang giữ chỗ, đổi asset không đổi luật):
- `farm/<id>/tier-<n>`: bậc trạm.
- `farm/<id>/art`: công trình.
- `farm/council`: Cổng Hội đồng.
- `farm/field-N/terrain`, `fence`, `gates`: ruộng.
- `farm/paths`, `farm/pond`, `farm/boundary`, `farm/surroundings`: cảnh.
- `farm/upgrades/<id>`: dấu nâng cấp.

## Analytics

Phát từ `farm.onEvent`, gửi qua `wireFarm`:

| Sự kiện | Khi |
|---|---|
| `field_bought` | Mua ruộng (`index`, `level`) |
| `workday_ended` | Hết một ngày công khi đang chơi (`level`, `coins_bucket`, `market_floor_hit`) |
| `challenge_completed` | Nhận thưởng nhiệm vụ (`quest`) |
| `auto_started` | Bật Auto (`runs_left`) |
| `victory_reached` | Đạt mục tiêu thắng (`type`) |
| `council_answered` | Trả lời câu ở Hội đồng (`expert`, `questionId`, `correct`) |
| `tutorial_completed` | Bán ly tự pha đầu (`step: first_cup`) |

`council_arrived` chỉ dùng trong game, không gửi analytics. Xong `farm-intro` chưa có sự kiện riêng.

## Chưa làm / điểm mở

- Công trình mở theo mốc cấp (pha 2); hiện dùng mốc `HUD_UNLOCKS`.
- Huy hiệu `!` ở Nhà thợ khi có sự cố (cần hàm `incidentExempt`).
- Kho đồ trang trí; di chuyển, xoay lại đồ đã đặt.
- Trạm phụ (sân phơi, lò rang, kho phụ) và công trình chức năng (bồn nước, ủ phân, trạm giao, chòi nghỉ).
- Chạy song song nhiều mẻ ở một trạm; gộp mẻ mới vào mẻ chờ; xem lại giới hạn hàng chờ 48.
- Dòng giống tên thật; tuổi cây (già cỗi, cưa đốn, tái canh, đất nghỉ).
- Máy sấy, phân loại hạt, ba mức rang, nghỉ hạt/độ tươi, ba mức xay.
- Sink cuối game: bảo trì theo cấp, cấp công trình trên 20, trang trí cao cấp.
- Hợp đồng tuần/tháng: `CONTRACT_PLANS` và action `contractPlan` còn trong code nhưng `contractPlan()` luôn trả gói ngày.
- Trả lương tay khi sự cố ngày công chưa tới hạn thì quay sự cố mới đè sự cố cũ (`signContract`).
- Nút "Thu tất cả"; pinch zoom trên cảm ứng.
- Lưu tuỳ chọn ẩn/hiện HUD qua lần mở game.
- Toạ độ công trình và Cổng Hội đồng ở khung 375 × 812 chưa chơi thử.
- Cân bằng giá, sản lượng, thời gian vụ, sức chứa, số đơn chưa chơi thử.
