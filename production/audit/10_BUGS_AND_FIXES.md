# 10 · Lỗi và hướng sửa

## Từ phân tích code — Exploit / toàn vẹn trạng thái

Phạm vi: `src/state/progress.js`, `src/features/farm/model.js` (toàn bộ hàm `act`), `src/features/cafe/service.js`, `src/features/cafe/game.js`, `src/features/farm/crew.js`, `src/app/game.js`, `src/ui/settings.js`.
Cách làm: đọc code, rồi chạy script node gọi `createFarm` thật (không qua trình duyệt):
- `production/audit/evidence/exploit/probe.mjs` → kết quả ở `probe-output.txt`
- `production/audit/evidence/exploit/order-loop.mjs` → kết quả ở `order-loop-output.txt`

Chưa sửa code nào. Không phải human playtest.

### EX-1 · P2 · Save hỏng một phần làm game kẹt ở màn lỗi, không có lối thoát
- **Bằng chứng (runtime, probe.mjs mục 1):** `createFarm` ném `TypeError` khi một phần tử mảng là `null`: `plots` (model.js:73), `lots` (model.js:157), `workers` (model.js:63), `decorations` (model.js:50), `orders` (model.js:245), `cafe.shipments` (model.js:91), `machines.*.extraBatches` (model.js:86), hoặc khi `cafe` không phải object (model.js:91–96). Các trường sai kiểu khác (`today=null`, `coins="abc"`, `lessons=null`, thiếu `cafe.stock`) thì load vẫn chạy.
- **Đường lỗi:** `app/game.js:179–181` có `saved.farm` thì vào `enterFarm` → `createFarm` ném lỗi → `fail()` (game.js:149) chỉ cho nút «Tải lại» và «Thử đồ họa thấp». `game.css:69` ẩn nút ⚙️ khi màn lỗi hiện, nên người chơi không bấm được «Xoá và chơi lại» (settings.js:116). Tải lại thì lỗi lặp lại mãi.
- **Tự phản biện:** luồng chơi hợp lệ không tạo ra `null` trong mảng (JSON chỉ ghi `null` khi gặp NaN/Infinity, và các mảng này chứa object). Rủi ro thực tế là save bị cắt ngang, extension, hoặc bản game sau đổi schema. Mức P2 vì hậu quả là kẹt vĩnh viễn với người không biết devtools.
- **Hướng sửa (nhỏ nhất):** (a) trong `createFarm`, lọc phần tử không phải object trước khi dùng (`list.filter(x=>x&&typeof x==='object')`) cho 7 mảng trên và kiểm `saved.cafe` là object; (b) trong `fail()` thêm nút «Chơi lại từ đầu» khi có save. Nút này chép chuỗi save cũ sang key backup rồi mới gọi `resetProgress()`.
- **Rủi ro sửa:** thấp. **Cần quyết định thiết kế:** có (giữ backup hay không, chữ trên nút).

### EX-2 · P3 · Lùi đồng hồ máy cho thêm giờ làm miễn phí (hợp đồng farm, ca quán, gói robot)
- **Bằng chứng (runtime, probe.mjs mục 2):** cho đồng hồ chạy nhanh 3 giờ, thuê An rồi `startWork` (trả 30 xu cho 6 phút), chỉnh đồng hồ về giờ thật rồi tải lại. Hợp đồng còn **186 phút** thay vì 6 phút.
- **Nguyên nhân:** model.js:59 đặt `lastAt=min(now, saved.lastAt)`, nhưng các mốc tuyệt đối `shiftUntil`/`restUntil` (model.js:114), `paidUntil` của quán (model.js:103), `readyAt` của mẻ và chuyến giao không được dời theo độ lệch. `advance()` (model.js:242) thấy `at===lastTick` nên không bù gì.
- **Hệ quả phụ (đọc code):** mẻ bắt đầu ở giờ tương lai bị kẹt thêm đúng độ lệch, người chơi tự chịu thiệt. Lùi đồng hồ còn làm `workDay` đổi (model.js:217) nên chợ hồi giá ngay (model.js:233) và câu hỏi ôn được hỏi lại sớm (model.js:219).
- **Chiều ngược lại (tiến đồng hồ):** cây lớn tối đa `OFFLINE_MS` = 8 giờ mỗi lần tải (model.js:243). Mẻ máy và chuyến giao xong ngay, không giới hạn. Hợp đồng nhân viên được tạm dừng đúng thiết kế (model.js:275). Đây là hành vi offline có chủ đích, nên không tính là lỗi.
- **Tự phản biện:** game chỉ chạy ở client nên sửa localStorage luôn làm được. Lỗi này vẫn báo vì đề bài có mục đồng hồ máy, và chỉ cần đổi giờ hệ điều hành là đủ. Mức P3.
- **Hướng sửa:** trong `createFarm`, tính `skew=max(0, saved.lastAt-now)`; nếu >0 thì trừ skew khỏi `shiftUntil`, `restUntil`, `paidUntil`, `startedAt/readyAt` của mẻ, `readyAt` chuyến giao, `deadline` đơn và `epoch`. Làm một lần ở chỗ load.
- **Rủi ro sửa:** trung bình (đụng nhiều mốc thời gian). **Cần quyết định thiết kế:** không.

### EX-3 · P3 · Đơn thu mua ở Chợ lặp vô hạn, giá cố định, bỏ qua độ bão hoà chợ và chất lượng
- **Bằng chứng (runtime, order-loop.mjs):** cùng 2000 g hạt rang chất lượng 20 trong một ngày công: bán chợ được **124,68 xu**, giao 10 đơn thu mua được **193,00 xu** (+55%), và `market.sold` vẫn bằng 0.
- **Nguyên nhân:** model.js:225 tính `reward=round(200*.07*priceScale*1.2)`, không phụ thuộc chất lượng lô. model.js:673 không cộng vào `progress.market.sold` và tạo đơn mới ngay (`orderIndex++`), không có thời gian chờ. `acceptOrder` (model.js:667) bấm lúc nào cũng được.
- **Tự phản biện:** đây không phải vòng tiền từ con số 0, vì vẫn phải tự trồng ra hạt (hạt nhà cung cấp chỉ vào kho quán, model.js:488, và không chuyển ngược về farm được). Nhưng nó vô hiệu hai luật trong rules.js:11–15: chợ giảm giá khi bán nhiều trong ngày, và hạt dư nên đem bán ở quán. Đơn xoay vòng giống theo cấp (model.js:225), nên người chơi phải có đủ các giống đang mở.
- **Hướng sửa (chọn 1):** cộng `quote.base` của đơn vào `market.sold`, hoặc giới hạn N đơn mỗi ngày công, hoặc nhân thưởng theo chất lượng lô.
- **Rủi ro sửa:** thấp. **Cần quyết định thiết kế:** có (cân bằng kinh tế).

### EX-4 · P3 · Nhiều tab cùng lúc: tab sau ghi đè tab trước, và «Xoá và chơi lại» có thể bị hoàn tác
- **Bằng chứng (code):** `saveFarm` (progress.js:27–31) ghi đè cả object `farm`, không có số phiên bản hay kiểm tra xung đột. Không có listener sự kiện `storage` (đã grep `src/`). Cờ `locked` (progress.js:5) chỉ có hiệu lực trong tab gọi reset. Tab farm khác vẫn chạy `tick` và `commit` mỗi ≥5 s (model.js:323), nên ghi lại save cũ sau khi tab kia đã reset.
- **Tự phản biện:** không nhân bản được tài sản, vì mỗi lần ghi là một trạng thái nguyên vẹn của một tab và tab ghi sau thắng. Hậu quả là mất tiến độ hoặc reset không ăn. Chưa chạy 2 tab thật.
- **Hướng sửa:** lắng nghe `storage` trên key `cog-coffee-progress`. Khi tab khác ghi thì khoá tab này (dừng commit, báo «Game đang mở ở tab khác, tải lại»).
- **Rủi ro sửa:** thấp. **Cần quyết định thiết kế:** không.

### EX-5 · P4 · Tải lại trang giữa ca quán né được phạt uy tín
- **Bằng chứng (code):** phạt «khách đang chờ bỏ về −1/khách» chỉ chạy trong `service.abandon()` (service.js:476), và hàm này chỉ được gọi từ `dispose()` (cafe/game.js:688). Phạt cuối ca (−1 khi phục vụ < nửa mục tiêu) nằm trong `endShift()` (service.js:443–453), chỉ chạy khi đóng cửa hoặc hết giờ. Khi tải lại trang, cả hai đều không chạy, còn `shift` chỉ là biến trong bộ nhớ (service.js:68).
- **Tự phản biện:** không lợi được xu; thưởng ca vẫn đòi đủ số ly thật. Chỉ tránh được tối đa vài điểm uy tín mỗi lần. Đây là save-scum nhẹ.
- **Hướng sửa:** lưu `{startedAt, served, goal}` của ca vào save; khi tải lại, nếu có ca dang dở thì chạy `act('shift', …)` với số đã có.
- **Rủi ro sửa:** thấp. **Cần quyết định thiết kế:** có (có đáng làm không).

### EX-6 · P4 · Huỷ mẻ chờ ở Sân phơi làm mới tuổi quả chín, né được hao chất lượng
- **Bằng chứng (runtime, probe.mjs mục 4):** quả chín đã 5 phút tuổi được xếp 2 mẻ, huỷ mẻ chờ, lô trả về có `createdAt` = đúng giờ huỷ.
- **Nguyên nhân:** model.js:645 `add(..., at, 'farm', 'returned')`; hao chất lượng tính theo `at-lot.createdAt>DAY_MS` (model.js:270).
- **Tự phản biện:** lợi rất nhỏ (−0,003 điểm/s sau 1 phút game), cần lặp tay. Đặt P4 cho đủ danh sách.
- **Hướng sửa:** giữ `createdAt` nhỏ nhất của các lô gốc trong job khi xếp mẻ, rồi dùng lại khi huỷ.
- **Rủi ro sửa:** thấp. **Cần quyết định thiết kế:** không.

### Đã kiểm, không thấy lỗi (đọc code)
- **Mua trùng do bấm nhanh:** `act` chạy đồng bộ và kiểm điều kiện trước khi trừ tiền. Các món mua một lần như ruộng (model.js:593), nâng cấp (379), thiết bị quán (534), bàn (567), thuê (394/543) đều fail ở lần bấm thứ hai. Hạt giống, phân, nguyên liệu thì mua lặp là đúng ý.
- **Số dư âm:** mọi lần trừ xu đều kiểm `coins>=giá` trước. Lương tự động của quán ở model.js:281; lương tự gia hạn đi qua `act('workers','shift')` (crew.js:221). Robot có `contractPrice` = `packPrice(wage,1)` (rules.js:79–83), nên `startTeam` không trừ hụt.
- **Nhận thưởng trùng:** nhiệm vụ có `claimed` (228), mẹo thiên đàng có `granted` (178), quà thiên đàng có `giftApplied` (172). Quà robot ghi `state` trước khi phát hàng (132–133), còn `robotGift` không rõ trạng thái thì coi là `done` (109).
- **Nhân bản kho:** `take` trừ lô rồi mới tạo shipment hoặc mẻ (202–211). Chuyến giao chỉ cộng một lần rồi bị lọc bỏ (271–272). `cargo` cũ trả về kho rồi được xoá (292). Ly ở quán đều được gỡ khỏi `hand`/`shelf` trước khi bán (service.js:343, 358, 540…).
- **Reload giữa giao dịch:** mỗi `act` thành công đều `commit` ngay (684). Không có giao dịch nhiều bước nào trải qua nhiều frame mà đã trừ tiền nửa chừng.
- **Mở khoá sai thứ tự:** model kiểm cấp giống (598, 660), ruộng liền kề (593), cấp nông trại khi nâng cấp (380), bàn theo cấp quán (566), robot quán chỉ thuê được khi đã mở Nhân viên (542).
- **resetProgress trong cùng tab:** `locked` chặn `saveFarm`/`saveHeaven`/`completeIntro`. `farm.flush()` lúc dispose cũng đi qua `saveFarm`, nên không ghi lại save cũ. Riêng `saveSettings` không bị chặn, nhưng nó chỉ ghi `settings` lên save đã reset, nên vô hại.

### Chưa đánh giá
- Save hỏng ở nhánh `heaven` (`createJourney`) và ở cảnh intro: chưa chạy thử.
- Hai tab thật, đổi giờ hệ điều hành thật: chưa chạy, chỉ suy ra từ code và mô phỏng `now` trong node.
- Cân bằng kinh tế quán (nhà cung cấp → pha → bán ly) không thuộc phạm vi exploit; xem `/balance-check`.

## Từ playtest trình duyệt — stress (Test C/D/E)

Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật. Thực tế: pane trình duyệt nội bộ (1024×768, không throttle, chạy nền ≤ 1 fps), origin `http://stress.localhost:5174`, fixture qua localStorage. Không phải human playtest. Chi tiết và ảnh: `02_PLAYER_JOURNEYS.md` mục Test C/D/E, `evidence/stress/`.

### Xác nhận runtime cho lỗi đã có
- **EX-1 (P2) xác nhận:** `workers:[{id:'nope'},null,5]`, `lots:[null]`, `decorations:[null]` → màn «Chưa mở được thế giới 3D», tải lại vẫn lỗi; `#game-settings-toggle` có trong DOM nhưng rộng 0 px. Ảnh `e01-workers-null-crash.jpg`.
- **EX-2 (P3) liên quan:** xem S-3.

### S-1 · P2 · Tiến độ offline được tính nhưng không bao giờ hiện cho người chơi
- **Bước:** save farm có cây đang lớn, lùi `farm.lastAt` 15 phút, tải lại.
- **Bằng chứng:** save có `offline:{seconds:900, message:'Cây, mẻ đã xếp…'}` nhưng body không có chữ nào về thời gian vắng. Grep `\.offline|offline:` trong `src/`: chỉ có model.js:71 (khởi tạo) và model.js:287 (gán). Không UI nào đọc.
- **Mong đợi:** quay lại thấy tóm tắt «Bạn vắng X phút: cây đã chín…».
- **Thực tế:** không có phản hồi; cây đổi trạng thái âm thầm.
- **Hướng sửa:** trong `farm/game.js`, sau `createFarm`, nếu `farm.progress.offline` thì `ui.notice(...)` một lần. **Rủi ro:** thấp. **Cần quyết định thiết kế:** có (nội dung, hiện ở đâu).

### S-2 · P2 · Offline mất phần thời gian thừa khi cây qua mốc trưởng thành
- **Bước:** ô `plot-0` cây non vối (`growMs` 90 s), ô `plot-1` cây trưởng thành `growthMs:0` (`regrowMs` 360 s), cùng nước 90, cỏ 0. Lùi `lastAt` 15 phút, tải lại.
- **Thực tế:** `plot-1` chín (2565 g); `plot-0` chỉ vừa trưởng thành, `growthMs=10`.
- **Mong đợi:** `plot-0` cũng chín (90 + 360 = 450 s < 900 s; ô bên cạnh cùng điều kiện đã có ≥ 360 s tăng trưởng).
- **Nguyên nhân:** model.js:263 `if(!p.mature){p.mature=true;p.growthMs=0;…}` bỏ phần dư; mỗi lần `advance` chỉ qua tối đa một mốc. Khi chơi online bước nhỏ nên không thấy; offline dài thì mất.
- **Hướng sửa:** giữ phần dư: `p.growthMs-=total` thay vì `=0` (và cho phép mốc chín ngay trong cùng lần nếu còn dư). **Rủi ro:** thấp–trung bình (đụng cân bằng offline). **Cần quyết định thiết kế:** có.

### S-3 · P3 · Tiến/lùi đồng hồ: lặp được +8 giờ mỗi lần tải, và mô phỏng đứng yên sau khi lùi
- **Bước:** ghi đè `Date.now` +8 giờ trong trang → game cộng ngay 8 giờ (`offline.seconds=28800`), `lastAt` lưu ở tương lai. Trả `Date.now` về giờ thật, mua 1 giống.
- **Thực tế:** `lastAt − now = +28.795.815 ms`; dòng ledger mua giống mang mốc +8 giờ; cây/máy không chạy tiếp trong phiên (model.js:242 `at=Math.max(lastTick,at)`). Tải lại: `lastAt` bị kẹp về hiện tại (model.js:59), còn 1 ledger + 1 journal mang mốc tương lai. Vòng «tiến 8 giờ → tải → lùi → tải» lặp được vô hạn.
- **Mong đợi:** lùi đồng hồ không làm game đứng; tiến đồng hồ không thành nguồn tăng tốc lặp lại miễn phí.
- **Tự phản biện:** game chỉ chạy client, ai sửa localStorage cũng làm được. Mức P3 vì chỉ cần đổi giờ máy.
- **Hướng sửa:** gộp với EX-2: khi load, nếu `saved.lastAt>now` thì dời mọi mốc tuyệt đối theo độ lệch; trong phiên, nếu `Date.now()<lastTick−60 s` thì đặt lại `lastTick=now` (coi như lùi giờ). **Rủi ro:** trung bình. **Cần quyết định thiết kế:** không.

### S-4 · P3 · Hộp xác nhận nâng cấp ghi nút «Bán ngay»
- **Bước:** Quản lý → Nâng cấp → bấm thẻ Sân sơ chế.
- **Thực tế:** tiêu đề «Xác nhận nâng cấp», nút xác nhận «Bán ngay».
- **Nguyên nhân:** ui.js:270 `confirmTrade` chọn nhãn theo tiêu đề (`mua`/`Xây`/`Phá dỡ`/`Nhận`), mọi tiêu đề khác rơi vào «Bán ngay». Gọi từ game.js:161 và game.js:491.
- **Hướng sửa:** thêm nhánh `title.includes('nâng cấp')?'Nâng cấp'`. **Rủi ro:** thấp. **Cần quyết định thiết kế:** không.

### S-5 · P4 · Bấm đúp nút xác nhận mở luôn xác nhận cho món bên dưới
- **Bước:** trong modal Nâng cấp, bấm đúp «Bán ngay» của Sân sơ chế.
- **Thực tế:** nâng cấp 1 lần (đúng), click thứ hai rơi xuống thẻ «Dụng cụ» và mở xác nhận mới. Không trừ tiền trùng.
- **Hướng sửa:** bỏ qua click vào thẻ trong ~300 ms sau khi dialog đóng. **Rủi ro:** thấp. **Cần quyết định thiết kế:** không.

### S-6 · P3 · Hết xu: cửa hàng hiện «0 xu» trên nút mờ, không nói vì sao
- **Bước:** save `coins:-500` (kẹp về 0), bấm xu để mở Cửa hàng.
- **Thực tế:** 3 nút mua đều `₫0 xu`, disabled; không hiện giá thật hay «thiếu X xu».
- **Nguyên nhân:** ui.js:520 `quantity=Math.max(maximum>0?1:0,…)` → 0 khi không mua nổi; giá = `unitPrice*0`.
- **Mong đợi:** vẫn hiện giá 1 món và chữ «Thiếu N xu».
- **Hướng sửa:** khi `maximum===0` tính giá với số lượng 1 và đổi nhãn nút. **Rủi ro:** thấp. **Cần quyết định thiết kế:** không.

### S-7 · P3 · Save JSON hỏng hoặc `version` lạ: về màn chọn nhân vật, chơi lại thì ghi đè mất save cũ
- **Bước:** đặt `localStorage['cog-coffee-progress']='{not json'` hoặc `version:99`, tải lại.
- **Thực tế:** về màn chọn nhân vật, không báo gì. `readProgress` (progress.js:7–11) trả `{}`; `completeIntro` (progress.js:37–52) coi save không phải v1 là rỗng và ghi đè.
- **Mong đợi:** báo save không đọc được, giữ bản sao trước khi ghi đè.
- **Hướng sửa:** khi chuỗi có nhưng không hợp lệ, chép sang key backup trước lần ghi đầu tiên. **Rủi ro:** thấp. **Cần quyết định thiết kế:** có.

### S-8 · P4 · Save thiếu `giftApplied` phát lại quà thiên đàng
- **Bước:** `farm:{version:3}` (hoặc `farm:null`/`[]`) với `startingGift:'capital'`.
- **Thực tế:** 350 xu (200 mặc định + 150 quà). Chỉ xảy ra khi save đã hỏng, nên P4.

### S-9 · P4 · Load không kiểm ruộng liền kề
- **Bước:** `fields:['field-3']`. **Thực tế:** chấp nhận field-0 + field-3 (chéo). Chơi thường đã chặn ở `adjacent()`; chỉ là save sửa tay.

### S-10 · P4 · AI heuristic · Lời xác nhận bán nói «Chợ đã mua nhiều trong ngày công này» ở lần bán đầu tiên
- **Bước:** lần bán đầu tiên trong ngày công, 19,75 kg hạt rang.
- **Thực tế:** «…Chợ đã mua nhiều trong ngày công này nên giá giảm (giá gốc 1.320,15 xu)», nhận 690,05 xu. Giá giảm do chính lượng bán lớn trong một lần, câu chữ dễ hiểu nhầm.

### S-11 · P4 · AI heuristic · Mở/đóng cửa quán liên tục kết thúc ca ngay với báo cáo «0 ly»
- **Bước:** trong quán, bấm «Mở cửa» 5 lần liên tiếp.
- **Thực tế:** hiện «Hết ca · Phục vụ 0 ly · Ca tập đầu tiên chưa đạt mục tiêu», quà robot từ `ready` thành `active`. Không mất xu. Nên có xác nhận khi đóng cửa giữa ca.

### Đã kiểm runtime, không thấy lỗi
- Bấm đúp/bấm 3 lần nút xác nhận mua, bán, nâng cấp: không trùng giao dịch (`act` commit ngay, model.js:684).
- 20 vòng mở/đóng modal Kho: đóng đúng, heap 34,9 → 35,9 MB, DOM +12 node.
- Bấm đúp «Vào quán»: chỉ dựng quán 1 lần (`enteringCafe`, game.js:770). Reload giữa loading quán: save nguyên vẹn.
- Offline 26 giờ, 400 ngày: kẹp 8 giờ, không crash, xu không đổi. Không có hệ thống thưởng theo giờ nên không có nhận trùng.
- Xu âm/chuỗi/quá lớn, `plots` sai kiểu, cấp nâng cấp ngoài khoảng, plot NaN: load OK và giá trị được kẹp.
