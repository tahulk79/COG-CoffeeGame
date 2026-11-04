# Thuê robot vs thuê nhân viên (farm + quán)

Trạng thái: **đã duyệt 03/11/2026 (vòng 2: robot farm dùng chung 2 chỗ, gói trả trước chỉ robot farm, ly robot không mất combo; vòng 3: miễn trừ 4 chỉ áp cho farm đúng 1 thợ và chỉ nghỉ ốm, Robot vườn speed 70 / dexterity 70), đã triển khai trong code (đối chiếu 04/11/2026, xem mục 0).** Chưa playtest; chỉ số/lương Robot vườn vẫn chỉnh theo số đo playtester (mục 12, "Đo sau triển khai"). Số thu nhập lấy từ `/balance-check` 03/11 (`scripts/balance-sim.mjs`); số lương/giá tính tay từ code. Hợp đồng dữ liệu: [contracts](contracts.md) mục 6. Luật farm: [farm-operations-guide.md](../screens/03-farm/rules.md) mục 3. Quán: [cafe-gameplay.md](../screens/04-cafe/gameplay.md).

> **Đã thay một phần (04/11/2026):** số slot (farm 2 → 3, tối đa 1 robot → nhiều robot, quán 10 → 3), robot làm đúng 1 việc, robot pha thuê được và sao theo người làm nằm ở [crew-autoplay](crew-autoplay.md). Sự cố (mục 4), gói trả trước (mục 3), gói thử robot (mục 5) giữ nguyên.

## 0. Đối chiếu code (04/11/2026)

Toàn bộ spec dưới đây **đã có trong code** (`farm/rules.js` `robo-n1`, `ROBOT_PACKS`, `INCIDENTS`; `farm/model.js` `rollIncident`, `robotGift`; `cafe/recipes.js` `robo-b*`, `robo-d1`, `gift-*`; `cafe/service.js`, `cafe/ui.js`, `farm/ui.js`). Đã đọc code, chưa chạy game hay test. Các câu sai so với code đã sửa thẳng trong file này. Những chỗ code **làm khác spec về hành vi** chưa sửa, chờ người dùng chốt bên nào đúng:

| # | Spec ghi | Code đang làm | Chỗ |
|---|---|---|---|
| C-1 | Ly robot bị chê: trần −2 uy tín **mỗi ca** | Trần −2 cho **cả gói** (`walkRep` không reset) | `farm/model.js` `loseCustomer` |
| C-2 | Farm: chạm thợ đang mải chơi → «Nhắc» ngay | Chạm thợ mở bảng chi tiết có «Nhắc» (2 bước), hoặc bấm «Nhắc» trên toast sự cố | `farm/game.js`, `farm/ui.js` |
| C-3 | Quán đóng / người chơi vắng lúc sự cố tới hạn → sự cố bị hủy | Sự cố bị **dời** tới lần mở quán sau (`paidUntil` được cộng bù); chỉ hủy khi hết ca lúc quán đóng | `cafe/service.js` `checkIncidents` |
| C-4 | (không nói) | Ly robot bị chê **vẫn trừ uy tín trong ca tập**, dù khách giận thường được miễn ở ca tập | `farm/model.js` |

Nghi lỗi code, cần xem lại (không phải chọn luật):

| # | Mô tả |
|---|---|
| B-1 | Giá hiển thị khi robot hết gói / `startTeam` dùng `contractPrice(w)` = lương × `contractPlan(w).price`; tiền thật trừ là `packPrice`. Nếu save robot có `plan` khác `day` thì hai số lệch (90/315 so với 15) |
| B-2 | Trả công khi sự cố đã quay nhưng chưa tới hạn → `signContract` quay sự cố mới **đè** sự cố cũ (tự gia hạn lúc còn < 30 s có thể xoá một lần mải chơi) |
| B-3 | Nút «Thuê robot thay» trên bong bóng (`canCover`) kiểm "Nhân viên đã mở", còn cờ `replace` trong `service.js` thì không; hai điều kiện lệch nhau |

## 1. Tóm tắt

- Danh sách ứng viên sẵn có thêm trường `kind: 'robot' | 'human'` (thiếu = `human`). Không làm hệ thuê mới: quán dùng lại `hire/fire/paidUntil`, farm dùng lại `shiftUntil/restUntil/waitUntil/waitReason`.
- **Robot:** rẻ (~½ lương người, không phí tuyển), không tăng tip, không đào tạo, không bao giờ gặp sự cố. Làm được ít việc hơn người. Robot quán (2,4 m/s) chậm hơn người phục vụ cấp 1 khoảng 11–24% tùy người (2,81–3,14 m/s); **Robot vườn làm việc vặt (tưới, cỏ, chế biến, giao) nhanh hơn Nam cấp 1 ~5–6%** (so sánh theo Nam 60/60; người có chỉ số gốc khác thì khác) nhưng không trồng/bón/tỉa/hái.
- **Farm:** robot **dùng chung 2 chỗ thợ với người, tối đa 1 robot**. Chọn (người, người) hay (người, robot) là quyết định thật. Robot farm mua theo **gói trả trước 1/5/10 ngày công** (15/68/113 xu, gói 10 rẻ 25%).
- **Quán:** robot bưng/dọn thuê **theo ca như người** (3 xu/ca, không có gói), thuê được khi nút Nhân viên mở.
- **Người:** như hiện nay + **sự cố ngẫu nhiên**, tối đa 1/ca mỗi người: Mải chơi 📱, Nghỉ ốm 🤒, Chửi khách 😤 (chỉ thu ngân/phục vụ). Người giỏi hơn (bưng 2 ly, tip theo Giao tiếp, hái/trồng/bón) nhưng phải trông.
- **Gói thử robot (quà một lần)** khi nút Nhân viên mở: 1 ca quán có robot pha + robot bưng, kèm 200 g hạt riêng và vật tư bù. Robot pha cố tình mắc lỗi pha thật; báo cáo cuối ca so sánh ly bạn pha với ly robot, có cả lãi sau hạt + vật tư. Ly robot **không làm mất combo** của người chơi. Sau gói, không thuê được robot pha.
- Kiosk = robot thu ngân, máy espresso tự động = robot pha espresso: **chỉ đổi tên/hình**, id và luật giữ nguyên.

Trụ cột: (2) quay lại — gói tặng + sự cố tạo lý do quay lại trông quán và luyện món; (3) hai màn phụ thuộc — robot farm lo tưới/cỏ/chế biến/giao cho quán nhưng không hái, nên chọn robot là đổi một tay hái lấy chi phí thấp; (4) học thật — bài so sánh ly robot sai thông số thật (và lỗ tiền) với ly mình pha; (1) cuốn ngay — quà ở phút 6–8, lần đầu thấy quán tự chạy.

## 2. Ứng viên và việc được làm

### Quán (`src/features/cafe/recipes.js`, `CANDIDATES`)

| id | Tên hiển thị | role | Thuê được | Việc | Lương/ca 4 phút | Hiệu ứng cố định (`fixedEffects`) |
|---|---|---|---|---|---|---|
| `robo-b1`, `robo-b2`, `robo-b3` | Robot bưng 01–03 | `waiter` | Có, khi nút Nhân viên mở | Bưng ly ở pass ra bàn; rảnh thì dọn bàn | 3 (cố định) | `speed 2.4` m/s, `tip 0`, `carry 1` |
| `robo-d1` | Robot dọn 01 | `cleaner` | Có, khi nút Nhân viên mở | Dọn bàn | 3 (cố định) | `speed 2.4`, `cleanMs 3200` |
| `gift-pha` | Robot pha (thử) | `barista` | **Không** (`giftOnly: true`) | Chỉ Phin đen nóng, Cà phê sữa đá | – | `ms 14000`, `score 50`, `recipes ['phin-den','nau-da']`, `cups 10` |
| `gift-bung` | Robot bưng (thử) | `waiter` | **Không** (`giftOnly: true`) | Như robot bưng | – | như `robo-b*` |

- **Một điều kiện duy nhất để thuê robot quán:** `HUD_UNLOCKS` id `workers` đang mở (`content.js:93`: đã nhận `expand`, hoặc `workers.length > 0`, hoặc cấp ≥ 3). Không phụ thuộc trạng thái gói tặng. Thành viên gói dùng id riêng `gift-*` nên không bao giờ trùng `robo-b*`: đang có `gift-bung` vẫn thuê được `robo-b1`.
- Robot thuê theo ca như người: `hire` trả 1 ca, tự gia hạn trong `advance` khi quán mở (model.js:284), không trả trước được (`hire` khi đang trong ca bị từ chối như người).
- Lương robot cố định 3 xu, không nhân theo cấp (robot luôn cấp 1, không đào tạo).
- Robot tính vào giới hạn vai (`max`: phục vụ 3, tạp vụ 1) và `MAX_CREW` 10 như người. Không có robot thu ngân/quản lý/barista thuê được. Thu ngân tự động là **Kiosk** (đổi tên "Robot thu ngân (kiosk)"), pha tự động là **Máy espresso tự động** (đổi tên "Robot pha espresso", vẫn chỉ Espresso/Americano 70 điểm, 10 s).
- Người phục vụ đổi: **bưng tối đa 2 ly/chuyến** (`carry 2`): lấy ly thứ hai ở pass nếu có khách khác đang chờ đúng món đó và chưa ai giữ; giao gần trước. Đây là ưu thế chính của người so với robot.

### Farm (`src/features/farm/rules.js`, `WORKER_CANDIDATES`)

| id | Tên | Phí tuyển | Lương/ngày công 6 phút | Chỉ số cố định | Việc được làm |
|---|---|---|---|---|---|
| `robo-n1` | Robot vườn | 0 | 15 lẻ (cố định, không theo cấp); gói xem mục 3 | speed 70, intelligence 60, strength 60, dexterity 70, constitution 60 | `water`, `weed`, `processing`, `delivery` (gồm lấy nước, đảo phơi, nhận mẻ, cất hàng, giao đơn) |

- **2 chỗ thợ chung, tối đa 1 robot.** Mọi chỗ đang đếm "2 thợ" trong code giữ nguyên (đếm mọi thợ, gồm robot). Chỉ thêm một luật: đã có robot thì không thuê robot thứ hai. Không có ô robot riêng.
- Robot **không** trồng, bón, tỉa, hái: các nhóm việc đó bị khóa trong Thiết lập (ổ khóa "Robot không làm việc này"). Chỉ thị "Trồng lấp ô trống", "Dùng phân bón" bỏ qua robot.
- Robot **tính là thợ chính** để farm nhận đơn quán (điều kiện `workers.length > 0`). Robot giữ đơn mà không có quả để chế biến thì lý do chờ: "Robot không hái được · Hái tay hoặc thuê người".
- Chỉ số cố định (chốt vòng 3, 03/11/2026) cho công thức sẵn có trong `crew.js`: di chuyển `0,75 + 0,5 × speed/100` = **1,10** so với 1,05 của Nam (speed 60) → ×1,05; làm việc `0,7 + 0,35 × speed/100 + 0,25 × dex/100` = **1,12** so với 1,06 (speed 60, dex 60) → ×1,06. Khoảng: speed, dex ∈ [0, 100] → di chuyển [0,75; 1,25], làm việc [0,70; 1,30]; không chia, không âm. Người lên cấp +2 mỗi chỉ số: cấp 5 (68/68) di chuyển 1,09, làm việc 1,11 ≈ robot; cấp 6 (70/70) **bằng** robot; **từ cấp 7 vượt robot** cả việc vặt. Các mốc này tính theo Nam (60/60); Linh (speed 75) đi nhanh hơn robot ngay cấp 1, Minh (50/50) chậm hơn nhiều. Robot vẫn không tăng chỉ số (không đào tạo).
- Robot quán **giữ** luật chậm hơn người (2,4 m/s so với người phục vụ cấp 1 2,81–3,14 m/s theo `1,6 + 0,022 × speed`; số 2,96 cũ là của barista Phát, không phải người phục vụ); chỉ Robot vườn được đảo.
- Robot không bao giờ vào `rejectedCandidates` (cho nghỉ rồi thuê lại được), không có `xp`, `act('workers','train')` từ chối "Robot không đào tạo được".

## 3. Gói trả trước (chỉ Robot vườn)

`packPrice(W, n) = ceil(W × n × (1 − d[n]))`, `d = { 1: 0, 5: 0,10, 10: 0,25 }`.

| Biến | Kiểu | Khoảng | Ý nghĩa |
|---|---|---|---|
| `W` | số nguyên | 15 | Lương một ngày công lẻ của `robo-n1` (`candidate.wage`) |
| `n` | số nguyên | {1, 5, 10} | Số ngày công mua; giá trị khác bị từ chối |
| `d[n]` | số | 0–0,25 | Chiết khấu gói |

Kết quả: **15 / 68 / 113 xu** (gói 5: 67,5 → 68; gói 10: 112,5 → 113). Giá/ngày công: 15 / 13,6 / 11,3. Chặn: `n` ngoài tập → `fail`, không chia, không âm. Quán không có gói (`cafe/hire` bỏ qua `pack`).

- `shiftUntil = max(shiftUntil, at) + n × WORK_DAY_MS`, `paidDays += n`; vẫn tạm dừng khi vắng mặt > 60 s (model.js:278).
- Hết gói: tự gia hạn **1 ngày giá lẻ 15 xu** khi còn < 30 s nếu bật Tự gia hạn. Thiếu xu → robot dừng an toàn, Cần xử lý "{tên robot} hết gói · Gia hạn 15 xu". Gia hạn thất bại thì thử lại mỗi 10 s.
- Cho nghỉ không hoàn phần còn lại (như người). Vì robot chiếm 1 trong 2 chỗ, gói 10 (= 60 phút chơi liên tục) là **cam kết giữ chỗ**: muốn đổi sang người giữa chừng thì mất phần còn lại. Đây là cái giá của chiết khấu sâu.

## 4. Sự cố của người

### Luật

| Sự cố | Ai | Xác suất gốc/ca `p0` | Khi nào trong ca | Tác dụng | Cách xử lý |
|---|---|---|---|---|---|
| Mải chơi 📱 | Mọi người (farm, quán) | 0,12 | Ngẫu nhiên 20–80% ca | Đứng yên, nhả việc đang giữ (quán: ly trên tay về pass; farm: thợ không cầm hàng, chỉ nhả việc đã nhận), tối đa **40 s** | Quán: chạm người → «Nhắc» → làm lại ngay. Farm: chạm thợ mở bảng có «Nhắc», hoặc «Nhắc» trên toast (C-2). Không nhắc thì 40 s sau tự làm lại |
| Nghỉ ốm 🤒 | Mọi người | 0,04 | Đầu ca | Trống **1 ca**, **không mất lương** (giờ đã trả được dời) | Thông báo; nút «Thuê robot thay» theo điều kiện dưới |
| Chửi khách 😤 | Thu ngân, phục vụ (quán) | 0,05 | Ngẫu nhiên 20–80% ca, **tại lần nhận order/bưng ly** | Bong bóng 😤 báo trước **3 s**; không chạm kịp → khách đó bỏ về, **uy tín −2**, không trả tiền | Chạm người trong 3 s → chặn, không hậu quả. **Không reset combo** |

- Mỗi người tối đa **1 sự cố/ca** (một lần quay cho cả ca). Chửi khách: **cả quán tối đa 1 / ca mở cửa** (bộ đếm `shift.rude` trong `service.shift`, chỉ sống trong phiên).
- **Chửi khách tới hạn khi người đó chưa có việc phù hợp** (thu ngân không có khách ở quầy, phục vụ không bưng ly): giữ chờ, kích hoạt ở lần nhận order/bưng ly kế tiếp. Hết ca lương mà chưa kích hoạt → hủy (`done: true`).
- Farm: ca = ngày công 6 phút (`WORK_DAY_MS`). Quán: ca = ca lương 4 phút (`CAFE_SHIFT_MS`) của người đó.
- Mải chơi ở farm dùng `waitUntil = at + 40000`, `waitReason = '📱 Mải chơi điện thoại · Chạm để nhắc'`; thợ không nhận việc mới khi `incident.type === 'phone'` và `waitUntil > at`. Nghỉ ốm ở farm dùng `restUntil = at + WORK_DAY_MS` và `shiftUntil += WORK_DAY_MS` (crew.js:18, 147 đã loại người `restUntil > at`).
- **Giao đội khi có người ốm:** `startTeam` (model.js:233) và «Giao đội làm đơn» (`startCrew`) **bỏ qua** người đang ốm thay vì báo lỗi "đang nghỉ". Chỉ báo lỗi khi sau khi lọc không còn ai.
- Nghỉ ốm ở quán: `member.rest = CAFE_SHIFT_MS`, đếm lùi chỉ khi quán mở; trong lúc đó `paidUntil` được cộng bù như lúc quán đóng và người đó không làm việc.
- Lý do mất khách mới `'rude'` cho `act('cafe','lost')`: uy tín −2, câu "😤 <Tên> lỡ lời, khách bỏ về · Uy tín −2". Khác `'angry'`: không reset combo, không đếm vào `shift.angry` (đếm `shift.rude`).
- **Nút «Thuê robot thay»** chỉ hiện khi thuê được ngay: quán — người ốm là phục vụ hoặc tạp vụ **và** vai đó còn chỗ (`max` chưa đủ tính cả người ốm); farm — farm **chưa có robot và còn chỗ trống** (2 người, một người ốm thì cả 2 chỗ vẫn bị chiếm → không hiện nút; thông báo chỉ ghi "nghỉ ốm ngày công này, không tính lương"). Theo miễn trừ 4, farm 1 người chỉ ốm được khi người đó **không** giữ đơn, nên nút này chỉ xuất hiện trong trường hợp đó. Bấm → mở Nhân viên tab Robot.

### Không có sự cố khi (kiểm tra lúc quay và lúc kích hoạt)

1. 2 ca đầu sau khi thuê (quán `shifts ≤ 2`, farm `paidDays ≤ 2`).
2. **Chỉ quán:** quán đang mở **và** có ít nhất một thành viên `gift: true` còn trong ca (`paidUntil > now`, `rest === 0`). Chỉ áp cho `cafe.crew`; **farm không dùng điều kiện này**. Không dùng `robotGift.state` (state giữ `'active'` mãi nếu người chơi mở quán một lần rồi không mở lại, vì gói chỉ trôi khi quán mở → sẽ thành lỗ né sự cố farm vĩnh viễn).
3. Người chơi không ở màn đó (farm: đang ở quán; quán: quán không chạy/không mở). Điểm kích hoạt trôi qua lúc vắng thì sự cố bị **hủy**, không dời.
4. **Chỉ farm, chỉ Nghỉ ốm** (chốt vòng 3, 03/11/2026): farm có **đúng 1 thợ** (`workers.length === 1`, người đó là người, không có robot hay người thứ hai) **và** người đó đang giữ ít nhất một đơn quán mở (`order.workers` chứa id). Mải chơi **không** được miễn. Lý do: farm một người mà ốm thì đứt cả chuỗi đơn trong 1 ngày công; mải chơi chỉ mất ≤ 40 s và nhắc được.
5. Uy tín quán `cafe.reputation < 30` (dùng cho cả hai màn; uy tín farm đã bỏ theo quyết định 03/11).
6. Robot: không bao giờ.

### Công thức xác suất

`p(type) = p0(type) × max(F, 1 − k × (L − 1)) × M(type)`, quay một số `u ∈ [0,1)`: `u < p(sick)` → ốm; `u < p(sick) + p(phone)` → mải chơi; `u < p(sick) + p(phone) + p(rude)` (chỉ thu ngân/phục vụ) → chửi khách; còn lại → không.

| Biến | Kiểu | Khoảng | Ý nghĩa |
|---|---|---|---|
| `p0` | số | phone 0,12 · sick 0,04 · rude 0,05 | Xác suất gốc/ca |
| `L` | số nguyên | quán 1–5 (`STAFF_MAX`), farm 1–10 (`workerLevel`) | Cấp người |
| `k` | số | quán 0,12 · farm 0,07 | Mức giảm mỗi cấp |
| `F` | số | 0,4 | Sàn hệ số cấp |
| `M` | số | 0,5 hoặc 1 | 0,5 cho phone/rude khi quán có Quản lý ca đang trong ca (không ốm); còn lại 1 |

Khoảng kết quả: tổng `p` một người ∈ [0,052; 0,21] — min ở barista quán cấp 5 có quản lý (0,12 × 0,52 × 0,5 + 0,04 × 0,52 = 0,052), farm cấp ≥ 10 là 0,064; max ở thu ngân/phục vụ cấp 1 không quản lý (0,12 + 0,04 + 0,05). Không âm vì `F > 0`, không vượt 1 vì tổng `p0` = 0,21, không chia. Hệ số cấp: quán cấp 5 = 0,52 (chưa chạm sàn), farm cấp ≥ 10 = 0,37 → kẹp 0,4.

Ví dụ: phục vụ cấp 3, có Quản lý ca: hệ số 1 − 0,24 = 0,76 → phone 0,12 × 0,76 × 0,5 = 0,046; sick 0,04 × 0,76 = 0,030; rude 0,05 × 0,76 × 0,5 = 0,019; tổng 0,095/ca.

Kỳ vọng đủ đội quán (10 người cấp 1, có quản lý: 5 thu ngân/phục vụ × 0,125 + 5 người khác × 0,10) = **1,1 sự cố/ca**; không quản lý (9 người) 1,7/ca, nhưng chửi khách bị trần 1. Thay 3 phục vụ + tạp vụ bằng robot: còn 6 người ≈ 0,7/ca.

**Farm, sự cố kỳ vọng sau chốt vòng 3.** Hễ farm có thợ là luôn sinh đủ 2 đơn mở (model.js:184); người chơi giao đơn cho từng người (`assign`, game.js:271). Miễn trừ 4 giờ không phụ thuộc cách chia đơn khi có 2 thợ:

| Cấu hình farm (cấp 1, ca ≥ 3, uy tín ≥ 30, đang ở farm) | Sự cố/ngày công | Ghi chú |
|---|---|---|
| (người) giữ đơn | 0,12 (chỉ mải chơi) | Ốm được miễn → chuỗi đơn không đứt |
| (người) không giữ đơn | 0,16 | Ốm được → hiện «Thuê robot thay» (còn chỗ) |
| (người, robot) | 0,16 | Người không còn là thợ duy nhất → không miễn |
| (người, người), mọi cách chia đơn | 0,32 | 2 × 0,16 |
| (robot) | 0 | Robot không có sự cố |

Khoảng: cấp ≥ 10 nhân 0,4 → (người, người) 0,128, (người, robot) 0,064. Không có cách chia đơn nào né được sự cố khi có 2 thợ. Lỗ né vòng 3 (giao mỗi người một đơn → cả hai được miễn) đã đóng.

### Lưu và reload

- Quay khi **trả một ca mới** (quán: `hire` và tự gia hạn trong `advance`, tăng `shifts`; farm: `signContract`, tăng `paidDays`). Kết quả lưu `incident = { for, type, due, done }`: `for` = số ca gốc (`shifts`/`paidDays` sau khi tăng), `due` = số ms **còn lại của ca** tại thời điểm kích hoạt (ốm: bằng độ dài ca → kích hoạt ngay khi ca đã trả bắt đầu).
- Kích hoạt khi `paidUntil − now ≤ due` (quán) / `shiftUntil − now ≤ due` (farm) và `!done`. Vì `paidUntil/shiftUntil` được cộng bù khi tạm dừng nên `due` không lệch khi đóng quán, vắng mặt hay reload.
- Đã có `incident.for === shifts` thì **không quay lại** (reload không đổi kết quả). Kích hoạt hay hủy đều ghi `done: true` trước khi hiện bong bóng.
- Mải chơi ở quán, bong bóng 3 s của chửi khách và bộ đếm trần `shift.rude` chỉ sống trong phiên: reload giữa chừng → người đó làm lại bình thường, sự cố coi như đã qua (không phạt), trần chửi khách đếm lại từ 0.
- **Ốm farm qua reload:** hiện `createFarm` (model.js:53) đặt `restUntil: 0` cho mọi thợ và `signContract` (model.js:97) cũng gán `restUntil = 0`. Đổi: "đang ốm" là `incident.type === 'sick' && incident.done && restUntil > at`. Khi tải: `incident.type === 'sick' && incident.done` → giữ `finite(restUntil)`; còn lại → 0 như cũ. `signContract` không xoá `restUntil` khi đang ốm. Người chơi vẫn trả ngày công tay được lúc thợ ốm: tiền vào `shiftUntil` như thường, trạng thái ốm giữ nguyên. Không làm vậy thì reload hoặc trả công là hết ốm mà `shiftUntil` vẫn đã được dời (không công 1 ngày).

## 5. Gói thử robot (một lần)

### Khi nào

- Model kiểm tra mỗi lần tải và sau mỗi `act` thành công: `robotGift.state === 'locked'` và `HUD_UNLOCKS` `workers` mở (khoảng phút 6–8 với người mới) → **tặng ngay**, `state = 'ready'`. Không gắn với ly đầu tiên.
- **Thông báo:** không thêm toast riêng. Dòng quà gộp vào toast mở khóa Nhân viên sẵn có (onboarding-flow 3.3): "🔓 Mở: Nhân viên · Thuê thợ và robot · 🎁 Tặng 1 ca robot pha + robot bưng ở quán". Không bao giờ có 2 toast cùng lúc. Save cũ (đã mở Nhân viên lúc tải): không toast, 1 dòng Hoạt động + chấm "Mới" trên nút Nhân viên.
- Save cũ (kể cả `stats.served > 0`, đã có nhân viên) chưa có `robotGift` cũng được tặng một lần khi đủ điều kiện.
- **Không phá ca tập.** Với người mới, ca có gói thường là ca quán đầu tiên, đang ở chế độ tập (`learning()` ở service.js:66: chưa xem `cafe-intro` hoặc `stats.served === 0`). Ly `robot: true` **không** tăng `progress.stats.served` và `progress.xp` (chỉ tăng `cafe.served`, `cafe.revenue`), nên chế độ tập chỉ hết khi người chơi tự giao ly đầu.
- **Ly robot không tính vào mục tiêu ca.** `serve()` (service.js:146) bỏ qua ly `robot: true` khi cộng `shift.served`, `shift.stars`. Nếu tính: người chơi 10 ly 2★ + robot 7,5 ly 1★ → trung bình 1,57★ < 2, mất thưởng ca và uy tín −1 thay vì +3.
- **Ly robot không làm mất combo.** service.js:144 hiện đặt `combo = 0` khi ly < 2★. Với ly `robot: true` (giao được hay bị chê) service **bỏ qua** dòng cập nhật combo: combo giữ nguyên, không tăng, không reset. Ly robot gửi `combo: 0` vào `sell` (tip không ăn combo của người chơi).

### Gồm

| Thứ | Số | Ghi chú |
|---|---|---|
| Robot pha `gift-pha` | 1 ca (`paidUntil = at + CAFE_SHIFT_MS`, `gift: true`) | Tối đa **10 ly**, chỉ Phin đen nóng và Cà phê sữa đá, bỏ qua ngưỡng thành thạo, điểm cố định **50 = 1★** |
| Robot bưng `gift-bung` | 1 ca, `gift: true` | Như robot bưng thường. Đã đủ 3 phục vụ thì bỏ qua robot bưng |
| Hạt | 200 g vối rang, chất lượng 70, lô `origin: 'gift'` trong kho quán | Đúng 10 ly × 20 g. Robot pha **chỉ** lấy lô `gift`; ly người chơi lấy lô `gift` sau cùng. Vào kho kể cả khi vượt sức chứa (chỉ chặn chuyến giao tiếp theo) |
| Ly | +10 | = 10 ly × 1 |
| Sữa đặc | **+500 ml** | = 10 ly × 50 ml (trường hợp xấu nhất: cả 10 ly là sữa đá với lỗi gấp đôi sữa) |
| Đá | **+1.500 g** (có bù) | = 10 ly × 150 g (`nau-da.uses.ice`). Bù để vật tư khởi đầu (2.000 g) không bị robot ăn |

Robot pha toàn Phin đen thì sữa đặc và đá thừa ở lại kho quán, là lợi cho người chơi (tối đa 10 + 1,5 xu).

- Thành viên `gift: true` không tính vào `MAX_CREW`/giới hạn vai, không tự gia hạn (model.js:284 bỏ qua), không được đào tạo/cho nghỉ (nút ẩn).
- Gói chỉ trôi khi quán mở (luật `paidUntil` sẵn có, model.js:223). Chưa vào quán thì Cần xử lý giữ dòng "🎁 Gói thử robot đang chờ · Vào quán, Mở cửa".
- `state = 'active'` khi quán mở lần đầu có thành viên gift; `'done'` khi mọi thành viên gift hết ca. `state` chỉ dùng cho báo cáo/`tally`, **không** dùng làm miễn trừ sự cố (mục 4, miễn trừ 2).

### Lỗi pha cố định của robot (số thật)

| Món | Robot làm | Chuẩn | Nguyên nhân hiển thị |
|---|---|---|---|
| Phin đen nóng | Nước 100 °C, xay mịn | 92–96 °C, vừa thô, nhỏ giọt 4–5 phút | "Nước sôi 100 °C + bột mịn → chiết quá, đắng gắt" |
| Cà phê sữa đá | 50 ml sữa đặc (gấp đôi) | 25 ml (20–30) | "Gấp đôi sữa đặc → ngọt gắt, át vị cà phê" |

**Nhánh brew robot kiểm đủ vật tư trước khi trừ.** `brew` hiện kiểm `missingFor(recipe)` theo `recipe.uses` (sữa đặc 25 ml) rồi trừ. Nhánh `robot: 'gift'` kiểm riêng **trước khi trừ bất cứ thứ gì**: lô `gift` ≥ 20 g, ly ≥ 1, và với sữa đá: sữa đặc ≥ **50** ml, đá ≥ 150 g. Thiếu → `fail('Thiếu …')`, không trừ hạt/vật tư, không tăng `cups`. Đủ → trừ hạt lô `gift`, ly 1, (sữa đá) sữa đặc 50 ml + đá 150 g.

### Khách nhận ly robot (luật chỉ cho ly `robot: true`)

- Mỗi ly robot giao tới khách (ai bưng cũng vậy): **25%** khách chê, bỏ về, **không trả tiền**, uy tín **−0,5**; trần −2 uy tín từ luật này (`walkRep`; code tính trần cho **cả gói**, không reset mỗi ca — C-1). Không reset combo. Câu: "Khách chê ly robot: <nguyên nhân> · bỏ về".
- 75% còn lại trả như ly 1★. Chất lượng (model.js:401) = `score × 0,75 + chất lượng lô × 0,25 + gearBonus + beanFit` = 50 × 0,75 + 70 × 0,25 + 0 + 0 = **55** khi phin cấp 1, máy xay cấp 1 (`gearBonus` 0) và hạt vối đúng món (`beanFit` 0). Giá = `price × (0,6 + 0,4 × 55/100)` → Phin đen **2,05 xu**, sữa đá **2,46 xu**. Tip chỉ phần nhanh `(1 − wait) × 0,1 × price` (≤ 0,25/0,30). Uy tín từ bán ly: (1 − 1) × 0,6 = 0.
- Mỗi cấp phin trên 1 cộng +4 chất lượng, mỗi cấp máy xay trên 1 cộng +3 (`gearBonus`, recipes.js:238): save cũ đã nâng cấp sẽ thấy giá ly robot cao hơn một chút.
- So với ly người chơi 2★ (điểm 75, chất lượng ≈ 74): Phin đen ≈ 2,24 + tip 0,375 (+ nhanh) ≈ 2,7 xu, uy tín +0,6/ly.

### Chi phí mỗi ly (để tính lãi)

Hạt theo giá chợ gốc: `roasted.price × priceScale` = 0,07 × 1 = 0,07 xu/g (content.js:57, vối). Vật tư theo giá gói: ly 5/50 = 0,1; sữa đặc 6/300 = 0,02 xu/ml; đá 2/2000 = 0,001 xu/g.

| Ly | Hạt | Vật tư | Tổng chi phí | Thu khi khách nhận | Lãi/ly nhận |
|---|---|---|---|---|---|
| Phin đen, bạn 2★ | 20 g × 0,07 = 1,40 | 0,10 | 1,50 | ≈ 2,70 | ≈ +1,20 |
| Phin đen, robot | 1,40 | 0,10 | 1,50 | ≈ 2,15 | ≈ +0,65 |
| Sữa đá, bạn 2★ | 1,40 | 0,10 + 0,50 + 0,15 = 0,75 | 2,15 | ≈ 3,20 | ≈ +1,05 |
| Sữa đá, robot | 1,40 | 0,10 + **1,00** + 0,15 = 1,25 | 2,65 | ≈ 2,58 | ≈ **−0,07** |

Robot 10 ly (5 + 5), 25% bị chê: thu ≈ 0,75 × (5 × 2,15 + 5 × 2,58) ≈ 17,7 xu; chi phí 5 × 1,50 + 5 × 2,65 = 20,75 → **lãi ≈ −3 xu**. Đây là con số bài học: ly sai thông số vừa mất khách vừa lỗ.

### Hết gói

- `gift-pha` rời quán (hết ca hoặc đủ 10 ly, tùy cái nào trước) và **không bao giờ thuê được**. `gift-bung` rời khi hết ca. Không trừ tiền tự động. Robot bưng `robo-b*` vẫn thuê được như mọi lúc từ khi nút Nhân viên mở.
- Hạt `gift` còn dư thành hạt thường của quán.
- **Báo cáo cuối ca** (ca mở cửa có gói chạy) thêm khối "Ly bạn pha vs ly robot":

| Hàng | Bạn | Robot |
|---|---|---|
| Số ly, ★ trung bình | `robotGift.tally.you` | `tally.robot` |
| Khách chê bỏ về | 0 (luật chỉ áp ly robot) | `walked` |
| Xu thu | `paid` | `paid` |
| **Lãi sau hạt + vật tư** | `paid − cost` | `paid − cost` (gồm cả ly bị chê, vẫn tốn hạt/vật tư) |
| Lỗi chính | bước điểm thấp nhất bạn hay sai (nếu có) | 2 lỗi cố định ở trên |

`cost` = Σ (hạt g × 0,07 × `priceScale` + Σ vật tư × giá gói/`pack`) cho mọi ly đã pha, lưu cộng dồn trong `tally.*.cost` lúc `brew`. Kèm một dòng hành động: "Luyện Phin đen tới ★★ (70 điểm) để barista người tự pha thay robot."

## 6. Nguồn vào / nơi tiêu

Đơn vị: **xu/vòng**, 1 vòng = 6 phút farm + 1 ca quán 4 phút = 10 phút thực (nhịp người chơi mẫu của `balance-sim.mjs`: `FARM_PHASE 360`, `CAFE_PHASE 240`). Ngày công farm trôi liên tục khi game mở, kể cả lúc ở quán (model.js:221) → **1,67 ngày công/vòng**. Ca quán chỉ trôi khi quán mở (model.js:223) → **1 ca/vòng**.

| Dòng | Loại | Tốc độ | Cạn được? |
|---|---|---|---|
| Gói thử robot | Vào (một lần) | Vật phẩm theo giá nhập: hạt 200 g × 0,15 (`SUPPLIER_PRICE` 75/500 g) = 30 + ly 1 + sữa đặc 500 ml = 10 + đá 1.500 g = 1,5 + 1 ca robot bưng 3 = **45,5 xu**. Robot pha không có giá (không thuê được). Nếu robot pha đủ 10 ly: hạt + sữa + đá dùng cho robot đổi thành ≈ 17,7 xu thu; lợi ròng còn lại ≈ 17,7 + 3 (công bưng) + vật tư thừa 0–11,5 ≈ **21–32 xu** | Một lần |
| Robot farm | Tiêu | 25 xu/vòng lẻ · 22,7 gói 5 · **18,8 gói 10** | Không (định kỳ) |
| Người farm | Tiêu | 50 xu/vòng (cấp 1) … 117 (cấp 5) … 200 (cấp 10) + phí 150–180 một lần | Phí: một lần; lương: không |
| Robot quán | Tiêu | 3 xu/vòng/robot, ≤ 4 robot → ≤ 12 | Không |
| Người quán | Tiêu | 5–15 × (1 + 0,25 × (cấp − 1)) xu/vòng/người | Không |
| Chửi khách | Tiêu | ≤ 1/ca: mất 1 ly (2–5 xu) + uy tín −2 | Không |
| Ly robot trong gói | Tiêu | Lỗ ≈ 3 xu so với chi phí hạt + vật tư | Một lần |
| Nghỉ ốm | Không tiêu (lương dời) | Mất năng suất 1 ca | – |

Dự phóng (thu từ `/balance-check` 03/11: vòng 7 ≈ 683 xu, vòng 30 ≈ 1.155 xu ngoại suy ngoài sim 120 phút; vòng 1 ước tính tay):

| Mốc | Thu/vòng | Đội farm | Đội quán | Lương/vòng | Tỉ lệ | Dư đi đâu |
|---|---|---|---|---|---|---|
| Vòng 1 (0–10 phút) | ~50–100 (ước tính) | 0 | gói tặng | 0 | 0% | Ruộng 2, giống, phân |
| Vòng 7 (60–70 phút), A: 2 người cấp 1 | 683 | 100 | thu ngân 6 + barista 12 + 2 người bưng 12 = 30 | 130 | 19% | Nâng cấp farm/quán, bàn, thiết bị, đào tạo |
| Vòng 7, B: 1 người + robot gói 10 | 683 | 50 + 18,8 = 68,8 | thu ngân 6 + barista 12 + 2 robot bưng 6 = 24 | 92,8 | 14% | như trên; người chơi tự hái bù |
| Vòng 30 (290–300 phút), A: 2 người cấp 5, đủ 10 người quán cấp 5 | 1.155 | 234 | 24 + 72 + 36 + 10 + 30 = 172 | 406 | 35% | Đào tạo cạn dần (farm 1.800 xu/người tới cấp 10, quán 400 xu/người tới cấp 5) |
| Vòng 30, B: 1 người cấp 5 + robot, quán robot bưng/dọn | 1.155 | 117 + 18,8 = 135,8 | 24 + 72 + 9 + 3 + 30 = 138 | 274 | 24% | như trên |

**Đánh giá (sửa vòng 3):** bảng trên chỉ so lương, chưa tính sản lượng hái. Tính theo giá trị một lần hái (mỗi ô ra 1 vụ mỗi ngày công: `regrowMs = SEASON_MS = WORK_DAY_MS`):

`hoaVon(L) = (workerWage(L) − W_robot) / G`, `workerWage(L) = 30 + 10 × (L − 1)`, `W_robot = 15`.

| Biến | Kiểu | Khoảng | Ý nghĩa |
|---|---|---|---|
| `L` | số nguyên | 1–10 | Cấp người thứ hai |
| `G` | xu/vụ | 29,4 (vối) · ≈ 33 (chè) · ≈ 50 (mít) | Giá trị một vụ hái đem rang bán chợ. Vối: 3.000 g quả → 500 g nhân → 420 g rang × 0,07 = 29,4 |
| `hoaVon` | vụ/ngày công | 0,3–3,6 | Số vụ người thứ hai phải hái thêm mỗi ngày công để bù chênh lương |

Kết quả (vối): cấp 1 → 15/29,4 = **0,5 vụ**; cấp 5 → 55/29,4 = **1,9**; cấp 10 → 105/29,4 = **3,6** (mít 2,1). Không âm vì `workerWage ≥ 30 > 15`, `G > 0`. Farm có 24–48 ô cần 24–48 lần hái mỗi ngày công, nên ở farm lớn mà người chơi không hái thì người thứ hai thắng; lương robot rẻ (≈ 2,6% thu ở phút 300) không đủ bù.

**Đánh giá sau chốt vòng 3 (speed/dex 70):** Robot vườn giờ có 3 lợi thế người cấp 1–5 không có: việc vặt nhanh hơn ~5–6% (mục 2), không sự cố (người: 0,16/ngày công, mục 4), lương 15 so với 30–70. Đổi lại mất cả tay hái/trồng/bón/tỉa. Đây là đánh đổi theo quy mô, không áp đảo:

| Tình huống | Lựa chọn hợp lý (dự kiến) | Vì sao |
|---|---|---|
| 2 ruộng, người chơi ở farm tự hái | (người, robot) | Hái không thiếu tay; robot đẩy chế biến/giao nhanh hơn và rẻ hơn |
| 3–4 ruộng, người chơi ở quán lâu | (người, người) | Hái là nút cổ chai (0,5–1,9 vụ hòa vốn ≪ 24–48 lần hái cần) |
| Người thứ hai cấp ≥ 7 (theo Nam) | (người, người) | Người vượt robot cả việc vặt |

Phép tính trên là ước lượng tay; `scripts/balance-sim.mjs` chưa có mô hình thợ nên không đo bằng sim được. Speed/dex/lương robot **chỉnh theo số đo playtester** với ngưỡng chấp nhận ở mục 12 ("Đo sau triển khai"); không chặn triển khai.

Phần quán (robot bưng/dọn, gói tặng) giữ đánh giá cũ: duyệt. Tiền dư cuối game (sau khi nâng cấp/đào tạo cạn) vẫn chưa có đích: **chưa cân bằng ở tầm toàn game**, ngoài phạm vi spec này, ghi cho đợt cân bằng chung.

## 7. Chiến lược áp đảo và cách chặn

| Nghi vấn | Kết luận | Cách chặn |
|---|---|---|
| Robot rẻ, không sự cố → thuê toàn robot | Quán: chỉ có robot bưng/dọn; thu ngân/barista/quản lý vẫn là người. Farm: tối đa 1 robot, robot không hái/trồng/bón. | Phạm vi việc hẹp + trần 1 robot farm |
| Người thứ hai luôn hơn Robot vườn | Vòng 3 thấy áp đảo (robot chậm ×0,81, sự cố farm ≈ 0 do miễn trừ 4 cũ). **Đã sửa (chốt vòng 3):** robot việc vặt nhanh hơn người cấp 1–5 (×1,05–1,06), không sự cố trong khi (người, người) chịu 0,32/ngày công; người giữ ưu thế hái và vượt robot từ cấp 6. Thành đánh đổi theo quy mô (mục 6) | Đo playtester theo ngưỡng mục 12; lệch thì chỉnh speed/dex trước, lương sau |
| Robot vườn 70/70 thành áp đảo ngược | Không ở farm lớn: robot không hái, farm cần 24–48 lần hái/ngày công. Nguy cơ ở farm nhỏ khi người chơi tự hái — đó là trường hợp robot **nên** thắng | Ngưỡng 4 ruộng ở mục 12: robot thắng → speed/dex 70 → 60 hoặc lương 15 → 20 |
| Robot bưng luôn lời hơn người phục vụ (chênh 3 xu/ca) | Lời khi quán vắng. Giờ đông (≥ 8 khách/phút) robot bưng 1 ly + chậm 20% → thông lượng ~40% người phục vụ cấp 1 (2 ly × 2,96/2,4 m/s), ly tồn ở pass, khách chờ lâu mất tip nhanh và bỏ về. Người còn +tip Giao tiếp ~0,055 × giá/ly. | `carry` 1 vs 2 là đánh đổi chính; **đo bằng sim** (mục 12). Robot vẫn áp đảo giờ đông → `speed` 2.4 → 2.2 hoặc lương 3 → 4 |
| Gói 10 luôn tốt nhất | Nếu đã định giữ robot thì đúng (rẻ 25%). Cái giá: khóa 1 trong 2 chỗ ~60 phút, không hoàn khi cho nghỉ, và 113 xu trả trước (đầu game thiếu xu nên gói 1/5). | Cam kết chỗ + khóa tiền. Chiết khấu là núm (mục 12) |
| Ly robot làm hỏng combo | Không: service bỏ qua cập nhật combo với ly robot. Ly robot cũng không tăng combo nên không thể dùng robot để nuôi combo. | – |
| Né sự cố bằng luôn giữ 1 thợ duy nhất có đơn | Vòng 3 thấy áp đảo. **Đã đóng (chốt vòng 3):** miễn trừ 4 chỉ khi farm có đúng 1 thợ và chỉ cho ốm. (người, robot) và (người, người) với mọi cách chia đơn đều chịu đủ sự cố. Farm 1 người vẫn mải chơi 0,12/ngày công, và 1 người thì mất cả tay thứ hai — không đáng để né | – |
| Né sự cố farm bằng mở quán một lần cho gói tặng chạy rồi không mở lại | Đã chặn: miễn trừ 2 chỉ áp cho `cafe.crew` khi quán đang mở và có thành viên gift trong ca, không dùng `robotGift.state` | – |
| Né sự cố bằng hạ uy tín < 30 | Uy tín < 30 làm khách tới chậm, mất món mở → lỗ hơn nhiều. | – |
| Ở farm suốt để quán không có sự cố | Quán không chạy thì không bán, người không làm. Không lợi. | – |

## 8. Vòng phản hồi

- **Dương có chủ đích:** giàu → thuê robot cho việc lặp → chủ rảnh tay pha/hái → giàu hơn. Hãm bằng chỗ giới hạn (farm 2 chỗ chung, 1 robot; quán theo `max` vai), robot quán chậm, Robot vườn không hái/trồng/bón/tỉa và không lên cấp (Nam cấp ≥ 7 vượt).
- **Dương cần hãm:** đào tạo người → ít sự cố → càng nên đào tạo. Hãm bằng sàn `F = 0,4` và lương người tăng theo cấp.
- **Âm có chủ đích:** đông người → nhiều sự cố cần trông (≈ 1/ca đủ đội). Quản lý ca giảm ×0,5 phone/rude — lý do thật để thuê quản lý. Thay người bằng robot cũng giảm sự cố, đổi lại mất tip/carry/tay hái.
- **Âm cần tránh xoáy:** uy tín thấp → chửi khách → uy tín thấp hơn. Chặn bằng miễn sự cố khi uy tín < 30 và trần chửi khách 1/ca.

## 9. Tiến trình mở khóa

| Mốc | Thời điểm người mới | Mở |
|---|---|---|
| Nút Nhân viên mở | Phút 6–8 (mua ruộng 2) | Gói thử robot; farm tab Người + tab Robot (Robot vườn, chung 2 chỗ); quán thuê được Robot bưng/dọn |
| Mở quán ca có gói | Phút 8–12 | Thấy robot pha/bưng, báo cáo so sánh + lãi |
| Thuê người lần đầu + 2 ca | ~10–20 phút sau thuê | Sự cố bắt đầu có thể xảy ra |
| Quản lý ca | Khi đủ xu (lương 15) | Giảm sự cố ×0,5 |

Không có cú nhảy: robot farm thay chứ không cộng thêm chỗ; nhanh hơn người cấp 1 chỉ ~5–6% ở việc vặt và mất tay hái, nên tổng năng suất farm không tăng vọt. Quãng trống không đổi so với hiện nay (hệ này không thêm món mua theo cấp).

## 10. Ngân sách chú ý

- Farm: vẫn tối đa 2 thợ (đồng hồ hợp đồng, lý do chờ). Chọn robot làm một chỗ không cần trông sự cố. Sự cố farm 0,12–0,32/ngày công (bảng mục 4), chỉ khi đang ở farm: tức khoảng 1 sự cố mỗi 3–8 ngày công (18–50 phút) — đủ hiếm để không thành việc trông liên tục. Không thêm thứ theo dõi.
- Quán: trước hàng chờ, phiếu order, quầy pha, pass, đồng hồ ca, 💤. Sau: thêm 1 bong bóng sự cố cùng lúc (≈ 0,7–1,1/ca, chửi khách trần 1). Bù lại robot thay việc bưng/dọn cần trông. Chỉ chửi khách cần phản xạ 3 s.
- Gói tặng: một lần, gộp vào toast mở khóa sẵn có, không thêm thứ theo dõi lâu dài.

## 11. Trường hợp biên

| Tình huống | Xử lý |
|---|---|
| Thiếu xu mua gói robot farm | `fail('Còn thiếu x xu.')`, không trừ gì |
| Hết xu khi tự gia hạn | Robot dừng an toàn (farm: trả việc/vật tư đang giữ, luật cũ), Cần xử lý "Hết gói" |
| Thuê robot farm khi đủ 2 thợ | `fail('Đã đủ 2 thợ. Cho một người nghỉ trước khi thuê robot.')` |
| Thuê robot farm thứ 2 | `fail('Farm chỉ thuê được 1 robot.')` |
| Thuê người khi đã có 1 người + robot | `fail` như luật 2 thợ hiện có |
| Thuê robot quán khi nút Nhân viên chưa mở | `fail('Mở Nhân viên ở farm trước.')` |
| `cafe/hire` gửi kèm `pack` | Bỏ qua `pack`, trả 1 ca như người |
| Thuê `gift-*` | `fail('Robot này chỉ có trong gói thử.')` |
| Đủ 3 phục vụ (người + robot) | `fail('Đã đủ 3 phục vụ.')` (luật vai sẵn có) |
| Kho quán đầy khi tặng 200 g | Vẫn thêm; chuyến giao sau bị chặn tới khi dưới sức chứa (luật kho sẵn có) |
| Đủ phục vụ khi tặng | Bỏ `gift-bung`, vẫn tặng robot pha + hạt + vật tư |
| Hết hạt `gift` trước 10 ly | Robot pha dừng, rời khi hết ca |
| Hết vật tư khi robot pha | Nhánh robot kiểm trước khi trừ (sữa đặc ≥ 50 ml cho sữa đá); thiếu → không nhận ly, phiếu ❓ "Thiếu …", không trừ gì |
| Không có phiếu Phin đen/sữa đá | Robot pha đứng chờ; không ăn món khác |
| Ly robot giao lúc combo x3 | Combo vẫn x3 (giao được hay bị chê) |
| Chửi khách tới hạn khi chưa có việc phù hợp | Chờ tới lần nhận order/bưng ly kế; hết ca lương → hủy |
| Chửi khách lần 2 trong một ca mở cửa | Hủy (`skip: true`) |
| Reload trong ca mở cửa sau một lần chửi khách | Trần `shift.rude` reset (bộ đếm phiên); người đã chửi không bị lại (`incident.done`), người khác có thể. Tối đa thêm 1 lần mỗi reload, chấp nhận |
| Reload giữa ca gói | `paidUntil`, `robotGift.cups`, `tally` đã lưu → tiếp tục |
| Reload giữa sự cố | Không quay lại (`incident.for`). Ốm farm giữ `restUntil`; mải chơi farm giữ `waitUntil`; mải chơi/chửi khách ở quán hết khi reload |
| Trả ngày công tay khi thợ đang ốm | Cho phép, trừ tiền, `shiftUntil` cộng như thường; `restUntil` **không** bị xoá |
| Giao đội làm đơn khi một người ốm | `startTeam`/`startCrew` bỏ qua người ốm, giao cho người còn lại; không còn ai → lỗi cũ |
| Người ốm, farm đủ 2 chỗ hoặc đã có robot | Không hiện «Thuê robot thay» |
| Phục vụ ốm, vai phục vụ đã 3/3 | Không hiện «Thuê robot thay» |
| Reload khi 1 người + 1 robot | Vẫn 2 thợ, xu không đổi |
| Save lạ có > 2 thợ hoặc > 1 robot | Giữ theo thứ tự cũ tới 2 thợ, tối đa 1 robot; phần dư hoàn phí tuyển như luật hiện có (robot phí 0 → không hoàn), 1 dòng Hoạt động (contracts mục 6 bước 6) |
| Offline lâu (≤ 8 giờ) | `shiftUntil`, `paidUntil` cộng bù (cũ); **`restUntil` cũng cộng bù** khi `restUntil > lastTick`. Không có sự cố nào kích hoạt khi vắng |
| Đang ở quán, sự cố farm tới hạn | Hủy (done, không tác dụng) |
| Cho nghỉ người đang ốm/mải chơi | Cho phép, không hoàn (luật cũ) |
| Cho nghỉ robot giữa gói 10 | Cho phép, không hoàn phần còn lại |
| Ốm khi farm có đúng 1 thợ (người) và người đó giữ đơn | Ốm bị hủy lúc kích hoạt (miễn trừ 4, `done: true`); mải chơi vẫn có tác dụng |
| Ốm đã quay khi farm 1 người, tới hạn lúc đã thuê thêm robot/người | Kích hoạt bình thường (miễn trừ kiểm lại lúc kích hoạt, farm không còn đúng 1 thợ) |
| Đang ốm (farm 2 thợ), cho nghỉ người kia → còn 1 người đang ốm | Ốm giữ nguyên tới hết `restUntil` (miễn trừ không xóa sự cố đã kích hoạt) |
| Quản lý ca đang ốm | Không tính `M = 0,5` |

## 12. Núm chỉnh

| Hằng | Giá trị | Khoảng an toàn | Tác động | File |
|---|---|---|---|---|
| Số chỗ thợ farm / robot tối đa | 2 / 1 | 2 / 1 (đổi là đổi luật) | Robot thay người, không cộng thêm | `farm/model.js` (`hire`) |
| Lương robot farm | 15 xu/ngày công | 10–20 | Sức nặng lựa chọn robot vs người | `farm/rules.js` (`WORKER_CANDIDATES`) |
| Chiết khấu gói farm `d` | 0 / 0,10 / 0,25 | gói 10: 0,15–0,30 | Lý do cam kết chỗ lâu | `farm/rules.js` (`ROBOT_PACKS`) |
| Chỉ số robot farm | speed 70, dex 70 | 60–80 (cả hai cùng bước 10) | 60/60 = ngang người cấp 1 (×1,00); 70/70 = ×1,05–1,06; 80/80 = ×1,10–1,13. > 80 thì robot vượt người cấp 10 → áp đảo việc vặt cả game | `farm/rules.js` (`WORKER_CANDIDATES`) |
| Lương robot quán | 3 xu/ca | 2–4 | Chênh với người 6; < 2 thì robot áp đảo lúc vắng | `cafe/recipes.js` (`CANDIDATES`) |
| Tốc độ robot quán `speed` | 2,4 m/s | 2,0–2,6 | Thông lượng bưng/dọn | `cafe/recipes.js` |
| `carry` robot / người | 1 / 2 | 1 / 2–3 | Đánh đổi chính giờ đông | `cafe/recipes.js`, `cafe/service.js` |
| `cleanMs` robot | 3200 | 2800–4000 | Tốc độ dọn | `cafe/recipes.js` |
| `p0` phone/sick/rude | 0,12 / 0,04 / 0,05 | phone 0,06–0,15, sick 0,02–0,06, rude 0,03–0,08 | Số việc phản xạ/ca | `farm/rules.js` (`INCIDENTS`) |
| `k` quán / farm, `F` | 0,12 / 0,07, 0,4 | k 0,05–0,15, F 0,3–0,6 | Giá trị đào tạo | `farm/rules.js` |
| `M` quản lý | 0,5 | 0,4–0,7 | Giá trị quản lý ca | `farm/rules.js` |
| Miễn ca đầu | 2 | 1–3 | Không phạt ngay khi vừa thuê | `farm/rules.js` |
| Ngưỡng uy tín miễn | 30 | 20–40 | Chặn xoáy âm | `farm/rules.js` |
| Mải chơi tối đa | 40 s | 20–60 s | Thiệt hại nếu không nhắc | `farm/rules.js` |
| Báo trước chửi khách | 3 s | 2–5 s | Độ khó phản xạ; < 2 s trên điện thoại khó chạm | `cafe/service.js` |
| Uy tín chửi khách | −2 | −1…−3 | Hình phạt | `farm/model.js` (`lost`) |
| Gói tặng: ly / hạt / sữa đặc / đá | 10 / 200 g / 500 ml / 1.500 g | 6–12 ly; vật tư = ly × định mức robot | Độ dài bài học | `farm/model.js` |
| Điểm robot pha | 50 | 40–60 (phải 1★: 40–69) | Mức tệ của ly robot | `cafe/recipes.js` |
| Khách chê ly robot | 25%, −0,5, trần −2/gói (code) | 15–35% | Độ đau bài học | `farm/model.js` |

**Còn phải đo bằng sim (quán):** (a) thông lượng robot bưng vs người ở 3, 6, 10 bàn; (c) số sự cố/ca thực tế với đội điển hình.

### Đo sau triển khai: Robot vườn (playtester, không chặn triển khai)

`scripts/balance-sim.mjs` chưa có mô hình thợ (không mô phỏng `crew.js`), nên mục này đo bằng playtester sau khi farm-dev xong. Speed/dex/lương robot là núm chỉnh theo số đo, không phải điều kiện để bắt đầu làm.

**Cách đo** (mỗi lượt 1 ngày công = 6 phút, vối, Tự chế biến bật, 2 đơn quán mở, lượt nào có sự cố thì bỏ và đo lại): Nam cấp 1 + (a) Robot vườn hoặc (b) người thứ hai cấp 1. Ghi 3 số:

- `T_cb`: thời gian chế biến trung bình một mẻ, từ lúc quả chín vào kho tới lúc hạt rang vào kho (giây).
- `R`: gram hạt rang hoàn thành trong ngày công.
- `Lời = R × 0,07 − lương ngày công` (lương: (người, người) 30 + 30 = 60; (người, robot) 30 + 15 = 45).

**Hai kịch bản và ngưỡng chấp nhận:**

| # | Kịch bản | Ngưỡng | Lệch thì chỉnh (theo thứ tự, đo lại sau mỗi bước) |
|---|---|---|---|
| N1 | Bất kỳ, chỉ so việc vặt | `T_cb(người, robot) / T_cb(người, người)` ∈ **[0,88; 1,00]** (robot nhanh 0–12%) | > 1,00 → speed/dex +10; < 0,88 → −10 |
| N2 | 2 ruộng, người chơi ở farm suốt ngày công và tự hái | `Lời(người, robot) ≥ Lời(người, người)` | Lương robot 15 → 12 (sàn 10); vẫn thiếu → speed/dex 80 |
| N3 | 4 ruộng, người chơi ở quán suốt ngày công (không hái) | `Lời(người, người) ≥ 1,10 × Lời(người, robot)` | Speed/dex 70 → 60; vẫn thiếu → lương robot 15 → 20 |
| N4 | Tổng hợp | Không cấu hình nào thắng cả N2 và N3 | Nếu một cấu hình thắng cả hai → coi là áp đảo, quay lại N2/N3 |

Chỉ số ngoài khoảng an toàn (speed/dex 60–80, lương 10–20) mà vẫn chưa đạt → ghi Nhật ký quyết định và mở lại thiết kế Robot vườn, không chỉnh tiếp bằng số. Khi `balance-sim.mjs` có mô hình thợ thì chạy lại N2/N3 bằng sim ở 2, 3, 4 ruộng.

## 13. Kịch bản liên màn

1. **Mua ruộng 2 → quà → quán.** `act('expand')` thành công → model thấy `workers` mở → `robotGift.state='ready'` (ghi trước), thêm `cafe.crew` `gift-pha` + `gift-bung`, lô `gift` 200 g, ly +10, sữa đặc +500, đá +1.500. Người chơi thấy **một** toast "🔓 Mở: Nhân viên · … · 🎁 Tặng 1 ca robot pha + robot bưng ở quán", chấm Mới. Ca gói thường là ca tập đầu: ly robot không tăng `stats.served`, chế độ tập còn tới khi người chơi tự giao ly. Chỗ gãy: tặng hai lần nếu `act` và tải cùng kiểm tra → chỉ khi `state === 'locked'`, ghi state trước khi thêm đồ.
2. **Ca gói tặng.** Mở cửa → `state='active'`, robot pha nhận phiếu Phin/sữa đá → `act('cafe','brew',{…, robot:'gift'})` (model kiểm `cups < 10` và đủ vật tư trước khi trừ, lấy lô `gift`, cộng `tally.robot.cost`) → robot bưng giao → `act('cafe','sell',{…, robot:true, combo:0})` (model quay 25%: chê → `walked`, `walkRep`). Service không đụng `combo`. Người chơi giữ combo x3 từ 3 ly 2★ trước đó, ly robot xen giữa không làm mất. Hết ca → báo cáo so sánh có hàng lãi (bạn +1,2/ly, robot ≈ −3 xu cả gói). Chỗ gãy: farm `crew.update` vẫn chạy khi ở quán — không đụng `cafe.crew`; chỉ model ghi.
3. **Nghỉ ốm ở farm, chọn robot thay.** Farm chỉ có An (người, ca ≥ 3) giữ đơn → nếu quay ra ốm thì bị hủy (miễn trừ 4), nhưng mải chơi vẫn có. Người chơi thuê thêm Bình (farm 2 thợ, miễn trừ 4 hết áp, chia đơn kiểu nào cũng vậy); ngày công mới của An → `incident.type='sick'` → crew gọi `act('workers','incident',An)` (model thấy farm có 2 thợ → không miễn → áp) → `restUntil`, dời `shiftUntil`. Farm đủ 2 chỗ → không có nút «Thuê robot thay». Người chơi bấm «Giao đội làm đơn» → `startCrew` bỏ qua An, giao Bình. Ngày hôm sau, farm vẫn 2 ruộng và người chơi định ở farm tự hái, nên cho Bình nghỉ, thuê Robot vườn gói 10 (−113 xu): robot chế biến/giao nhanh hơn Bình một chút, rẻ hơn 15 xu/ngày công, không sự cố; An vẫn có thể mải chơi/ốm (0,16/ngày công). Chỗ gãy: `startTeam` báo lỗi "đang nghỉ" làm kẹt đơn → đã đổi thành bỏ qua; miễn trừ phải kiểm lại lúc kích hoạt (số thợ có thể đã đổi từ lúc quay).
4. **Chửi khách lúc đông.** Phục vụ người tới hạn `due` khi đang rảnh → chờ; lần bưng ly kế → service gọi `act('cafe','incident',id)` (model kiểm miễn trừ, ghi `done`) → bong bóng 😤 3 s trên HUD (chạm được khi modal pha mở). Không chạm → `act('cafe','lost','rude')`, ly về pass, combo giữ nguyên. Chỗ gãy: modal pha khóa thao tác thế giới → bong bóng phải là phần tử HUD.
5. **Offline 2 giờ giữa ca ốm.** `advance` cộng bù `shiftUntil`, `paidUntil`, `restUntil`. Quay lại: thợ vẫn còn nguyên phần ốm, không có sự cố mới. Robot gói 10 không bị tiêu ngày công khi vắng. Chỗ gãy: quên cộng `restUntil` → thợ hết ốm mà vẫn được thêm một ngày công.

## 14. Checklist nghiệm thu

Debug: chỉ khi URL có `?debug=incident` mới có `window.__forceIncident(id, type)` (đặt `incident` cho ca hiện tại với `due` = ngay bây giờ, bỏ qua xác suất nhưng **vẫn** kiểm miễn trừ) và `window.__incidentOdds(id)` (trả `{ phone, sick, rude }` tính theo công thức mục 4). Không có trong chơi thường.

| # | Kịch bản | Bước | Trước → sau mong đợi |
|---|---|---|---|
| 1 | Nhận gói tặng | Save mới, hái, mua ruộng 2 | Xu chỉ trừ giá ruộng. Kho quán: **lô `gift` +200 g, lô `starter` không đổi**. Ly +10, sữa đặc +500 ml, đá +1.500 g. `cafe.crew` có `gift-pha`, `gift-bung` (`gift:true`). `robotGift.state` `locked → ready`. Chỉ **một** toast (toast mở Nhân viên có dòng 🎁) |
| 2 | Gói chờ khi chưa vào quán | Ở farm 3 phút | `paidUntil − now` của robot gift vẫn 240 s. Cần xử lý có "Gói thử robot đang chờ" |
| 3 | Ca gói | Phin cấp 1, máy xay cấp 1 (`gearBonus` 0), hạt vối (`beanFit` 0). Vào quán, Mở cửa, không pha gì | Robot pha chỉ làm Phin đen/sữa đá, mỗi ly ★1, chất lượng 55, giá 2,05/2,46 xu khi khách nhận. Tối đa 10 ly; lô `gift` 200 → 0 g; lô `starter` không giảm; mỗi ly sữa đá trừ 50 ml sữa đặc + 150 g đá. Khoảng 25% ly bị chê (10 ly: thường 1–5), mỗi lần uy tín −0,5, tổng không quá −2. Save mới: `stats.served` vẫn 0, ca vẫn là ca tập; `shift.served` = 0 |
| 3b | Ca gói, người chơi 2★ | Tự pha đủ mục tiêu, mỗi ly đúng 2★; robot pha đủ 10 ly | Ca **đạt**: trung bình chỉ tính ly bạn (2,0★), thưởng ca, uy tín +3. Ly robot không có trong `shift.served/stars` |
| 4 | Pha song song + báo cáo | Trong ca gói, tự pha 3 Phin đen 2★ | Khối so sánh: Bạn 3 ly, Robot n ly, xu, ★, khách chê, **Lãi sau hạt + vật tư** (Bạn ≈ +3,6; Robot âm hoặc ≈ 0 nếu nhiều sữa đá), 2 lỗi robot |
| 4b | Combo với ly robot | Giao 3 ly 2★ (combo x3), để robot giao 2 ly (1 nhận, 1 bị chê), rồi giao 1 ly 2★ | Combo x3 → x3 → x3 → **x4**. Tip ly robot không có phần combo |
| 4c | Robot thiếu sữa đặc | Trong ca gói, giảm sữa đặc còn 30 ml, có phiếu sữa đá | Robot không nhận ly, phiếu ❓ "Thiếu sữa đặc"; hạt `gift`, ly, đá **không đổi**; `cups` không đổi |
| 5 | Hết gói | Sau báo cáo | `gift-pha`, `gift-bung` không còn trong đội, không có trong danh sách thuê. Xu không bị trừ tự động. `robotGift.state = done` |
| 6 | Save cũ | Tải save đã bán > 0 ly, đã mua ruộng 2, chưa có `robotGift` | Nhận gói ngay khi tải, 1 dòng Hoạt động, không toast. Tải lại lần 2: không nhận thêm |
| 7 | Thuê robot quán | Nút Nhân viên đã mở, 50 xu, thuê Robot bưng | Xu 50 → 47. `paidUntil` = now + 240 s (chỉ trôi khi mở). Không có lựa chọn gói. Robot mang 1 ly/chuyến, 2,4 m/s, không tip. Đang có `gift-bung` vẫn thuê được `robo-b1` |
| 7b | Robot quán trước mốc | Save mới chưa mua ruộng 2, cấp < 3, gọi `act('cafe','hire','robo-b1')` | `fail`, xu không đổi |
| 8 | Người bưng 2 ly | Thuê Tuấn, 2 bàn cùng chờ 2 ly có sẵn ở pass | Tuấn lấy cả 2, giao bàn gần trước |
| 9 | Thuê Robot vườn | Farm 1 người, 200 xu: thuê robot gói 10 | Xu 200 → 87 (113, không phí tuyển). Ô thợ **2/2**. Hồ sơ robot: speed 70, dexterity 70. Thiết lập robot: Trồng/Bón/Tỉa/Hái khóa. Robot không hái. Thuê thêm người → báo đủ 2 thợ. Farm 2 người: thuê robot → `fail('Đã đủ 2 thợ…')`. Gói 1 = 15, gói 5 = 68 |
| 9b | Reload với robot | Farm 1 người + Robot vườn, ghi số xu, reload 2 lần | Vẫn 2 thợ, xu không đổi, không có dòng "hoàn phí tuyển" |
| 10 | Robot giữ đơn một mình | Chỉ có robot, đơn mở, không quả | Đơn vẫn sinh (robot là thợ chính). Lý do chờ "Robot không hái được · Hái tay hoặc thuê người" |
| 11 | Mải chơi farm | `__forceIncident('an','phone')` khi An ca ≥ 3 | An đứng yên, nhãn 📱 trên thẻ nhân viên và toast có «Nhắc», `waitReason` đúng chữ. «Nhắc» → làm lại trong ≤ 1 s. Không nhắc: làm lại sau 40 s |
| 12 | Ốm farm, còn chỗ | Farm chỉ An, An **không giữ đơn nào** (bỏ An khỏi cả 2 đơn); `__forceIncident('an','sick')` | `restUntil` = now + 360 s, `shiftUntil` +360 s, xu không đổi. Toast có «Thuê robot thay» mở đúng tab Robot |
| 12a | Ốm farm, hết chỗ | Farm An + Bình, giao **mỗi người một đơn**; ép An ốm | Ốm **có** tác dụng (farm 2 thợ, miễn trừ 4 không áp dù An là người duy nhất của đơn mình). Toast không có nút «Thuê robot thay». «Giao đội làm đơn» giao cho Bình, không báo lỗi "đang nghỉ" |
| 12d | Miễn trừ 4 chỉ cho ốm, chỉ farm 1 thợ | Farm chỉ An (ca ≥ 3), An giữ 1 đơn. Ép `sick`; rồi ép `phone`. Thuê Robot vườn, ép `sick` cho An | Ốm lần 1: hủy, `restUntil`/`shiftUntil`/xu không đổi, `incident.done = true`. Mải chơi: **có** tác dụng (📱, 40 s). Sau khi có robot: ốm **có** tác dụng, không có «Thuê robot thay» (hết chỗ) |
| 12b | Ốm rồi reload | Sau #12, reload ngay | `restUntil`, `shiftUntil` không đổi (lệch ≤ 1 s), An vẫn 🤒 |
| 12c | Trả công lúc ốm | Sau #12, trả 1 ngày công cho An | Xu giảm đúng giá ngày công, `shiftUntil` +360 s, `restUntil` không đổi |
| 13 | Chửi khách | Ép rude cho phục vụ người đang rảnh | Không có bong bóng tới khi người đó cầm ly. Bong bóng 😤 3 s. Chạm kịp: không đổi uy tín/khách. Không chạm: `lost` +1, uy tín −2, combo giữ nguyên, câu "lỡ lời". Ép lần 2 cùng ca: hủy. Ép rồi để hết ca mà không bưng: hủy, `done: true` |
| 14 | Số xác suất | `?debug=incident`, `__incidentOdds` cho: phục vụ cấp 1 không quản lý; cùng người có Quản lý ca; phục vụ cấp 3 có quản lý; barista cấp 5 có quản lý; thợ farm cấp 1 | 0,12/0,04/0,05 · 0,06/0,04/0,025 · 0,046/0,030/0,019 · 0,031/0,021/0 · 0,12/0,04/0 (sai số ±0,001) |
| 15 | Miễn trừ | Vừa thuê (ca 1–2); uy tín 25; đang ở quán (sự cố farm); farm đúng 1 thợ người giữ đơn + ép `sick`; robot; quán đang mở có `gift-bung` trong ca (sự cố người quán) | Ép sự cố → bị hủy, không tác dụng. Đối chứng: farm (An, robot) cùng giữ đơn + ép `sick` cho An → **có** tác dụng |
| 15b | Gói tặng không che farm | Mở quán cho gói chạy 30 s, đóng quán, về farm (`robotGift.state` vẫn `'active'`); farm 2 thợ, thợ người ca ≥ 3; `__forceIncident('an','phone')` | Sự cố **có** tác dụng (miễn trừ 2 không áp cho farm). Quay lại quán, mở cửa, ép sự cố cho phục vụ người khi gift còn ca → bị hủy; sau khi gift hết ca → có tác dụng |
| 16 | Reload | Ép phone farm, reload trong 40 s; ép sick farm, reload | Không quay lại sự cố mới; `incident.for` giữ nguyên; `waitUntil` còn; `restUntil` còn nguyên |
| 17 | Offline | Thợ đang ốm, đóng game 1 giờ | `shiftUntil`, `restUntil` cùng +3600 s; phần ốm còn đúng như lúc tắt |
| 18 | Đổi tên thiết bị | Mở Nâng cấp › Tự động | "Robot thu ngân (kiosk)", "Robot pha espresso"; giá/luật như cũ; save có kiosk cấp 2 vẫn cấp 2 |
| 19 | Phục vụ ốm, vai đầy | 3 phục vụ, ép một người ốm | Không có «Thuê robot thay». Có 2 phục vụ: có nút, mở tab Robot |
| 20 | Robot vườn vs người (đo) | Theo mục 12 "Đo sau triển khai": N1 (2 ruộng), N2 (2 ruộng, tự hái), N3 (4 ruộng, ở quán); mỗi cấu hình (Nam + robot), (Nam + người cấp 1) ít nhất 2 lượt 6 phút | Ghi `T_cb`, `R`, `Lời` từng lượt. Đạt: N1 tỉ lệ ∈ [0,88; 1,00]; N2 (người, robot) lời ≥ (người, người); N3 (người, người) lời ≥ 1,10 × (người, robot). Không đạt → báo số đo + bước chỉnh đề xuất theo bảng mục 12, không coi là lỗi chặn |

## 15. Chia việc và thứ tự

1. **integrator** (trước tiên): `docs/shared/contracts.md` mục 6 (đã viết). `src/features/farm/model.js`: chuẩn hóa/chuyển save (`robotGift`, `incident`, `shifts`, `rest`, `gift`, `tally.*.cost`), giữ `restUntil` khi đang ốm (dòng 53, `signContract` dòng 97), `hire` farm thêm luật ≤ 1 robot + gói (dòng 322), vòng tải giữ ≤ 2 thợ như cũ + ≤ 1 robot (dòng 53, 95, 113–115), `startTeam` bỏ qua người ốm (dòng 233–235), `sell` với `robot: true` không tăng `stats.served`/`xp` (dòng 407), `brew` nhánh robot kiểm vật tư trước khi trừ (dòng 395–398), `cafe/hire` robot: điều kiện `workers` mở, lương cố định, từ chối `giftOnly` (dòng 418–425), tự gia hạn dùng lương robot + bỏ qua `gift` (dòng 225), `cafe/train` từ chối robot (dòng 426), `act` mới (`cafe/incident`, `workers/incident`, `workers/remind`, `lost` thêm `rude`/`robot`), quay sự cố khi trả ca, cấp gói tặng, cộng bù `restUntil` offline, `take` ưu tiên/loại lô `gift`. `src/features/farm/rules.js`: `INCIDENTS`, `ROBOT_PACKS`, `packPrice`, `robo-n1` (speed 70, dexterity 70), `workerWage` cho robot. `workers/incident`: miễn trừ 4 = `type === 'sick' && workers.length === 1 && kind người && giữ đơn mở`, kiểm lúc kích hoạt.
2. **farm-dev** ∥ **cafe-dev** (sau 1):
   - farm-dev (`src/features/farm/crew.js`, `worker-planner.js`, `game.js`): kích hoạt sự cố theo `due`, bỏ qua việc khi phone, khóa nhóm việc robot, lý do chờ robot, «Giao đội làm đơn» bỏ qua người ốm (game.js:270), điều kiện nút «Thuê robot thay», debug `__forceIncident`/`__incidentOdds` phía farm (chỉ `?debug=incident`).
   - cafe-dev (`src/features/cafe/recipes.js`, `service.js`, `game.js`): ứng viên robot + `gift-*` + `fixedEffects`, `staffWage(role, level, person)` trả `person.wage` cho robot, `serve()` bỏ ly `robot: true` khỏi `shift.served/stars` (service.js:146) và **bỏ qua cập nhật combo** (service.js:144), gửi `combo: 0` cho ly robot, `carry` 1/2, robot pha gift, khách chê ly robot, chửi khách 3 s chờ tới việc phù hợp + trần 1/ca, mải chơi + Nhắc, ốm (`rest`), báo cáo so sánh có hàng lãi, đổi tên kiosk/autoEspresso, debug phía quán.
3. **ui-stylist** (song song 2, dựa trên hợp đồng; `src/features/*/ui.js`, `src/ui/styles/*.css`): modal Nhân viên 2 tab Robot/Người (farm: chọn gói 1/5/10 có giá 15/68/113; quán: chỉ "Thuê · 3 xu/ca"), ô thợ farm vẫn "x/2" (robot hiện trong một ô, icon robot), bong bóng 📱🤒😤 (HUD chạm được trên modal pha), nút «Nhắc», dòng 🎁 trong toast mở khóa Nhân viên (không toast riêng), khối báo cáo so sánh có hàng lãi, ổ khóa nhóm việc robot.
4. **asset-3d** (song song, độc lập): robot khối tạm có điểm tương tác và chỗ bưng 1 ly: slot `farm/robot`, `cafe/robot-waiter`, `cafe/robot-cleaner`, `cafe/robot-barista`; hình mới cho `cafe/kiosk` và `cafe/auto-espresso` theo phong cách robot (id slot giữ nguyên nếu đã có). Ghi vào `docs/assets/scene-assets.md`.
5. Sau cùng: `/balance-check` (mục 12, phần quán) → playtester chạy checklist mục 14, gồm #20 đo Robot vườn. Kết quả #20 lệch ngưỡng → game-designer cập nhật núm (mục 12) → integrator đổi số trong `farm/rules.js`; không chặn bàn giao các phần khác.

Không còn mục chặn: phần farm (`robo-n1`, gói, miễn trừ 4) làm cùng lúc với phần quán.
