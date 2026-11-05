# 3 slot đội, sao theo người làm, lười/mệt và chế độ Auto (farm + quán)

Trạng thái: **đã chốt 04/11/2026 (Quang), đã code; test tự động 35/35 qua ngày 04/11, chưa chơi thử**. Ghi đè các luật cũ: farm 2 chỗ thợ / tối đa 1 robot, quán tối đa 10 người, robot pha không thuê được ([robot-staff](robot-staff.md) mục 1–2). Hợp đồng dữ liệu: [contracts](contracts.md) mục 6.

## 1. Tóm tắt

| Ai | Farm | Quán | Sao ly | Lười/sự cố |
|---|---|---|---|---|
| Robot | Đúng **1 việc** (tưới / làm cỏ / chế biến / giao) | Đúng 1 vai: bưng, dọn, hoặc **Robot pha 01** (chỉ Phin đen) | **★** (50 điểm cố định) | Không bao giờ |
| Nhân viên | **1 mảng việc**; cấp 4 → 2 mảng; cấp 7 → 3 mảng (đa nhiệm) | 1 vai; cấp 3 → rảnh thì phụ bưng/dọn (đa nhiệm) | Tối đa **★★** (mệt −12 điểm → có thể ★) | Mệt, lười, ghét việc + sự cố cũ (mải chơi, ốm, chửi khách) |
| Bạn | Mọi việc | Mọi việc | Tối đa **★★★**, ly tự pha ×2 giá | Không; nhưng bạn pha lâu thì khách chờ lâu |

- **Farm 3 slot, quán 3 slot**, trộn robot/người tùy ý (nhiều robot được). Máy (kiosk, Robot pha espresso) là nâng cấp, không chiếm slot; Robot pha espresso giờ ra ly ★ như mọi robot.
- **Không ai làm trùng việc**: robot, nhân viên và bạn dùng chung một bảng giữ chỗ (mục 3).
- **Auto**: 3 lượt miễn phí × 10 phút (≈ 30 phút). Bấm Auto là nhân vật tự chơi bằng đúng thao tác của người chơi, bàn tay 👆 chỉ chỗ bấm, dòng chữ giải thích. Chỉ bấm ⏸ (hoặc hết giờ) mới dừng Auto; vuốt xoay camera, chạm, joystick, phím, HUD và cửa sổ đều không dừng (mục 5).

Trụ cột: (1) cuốn ngay — xem Auto chơi là hiểu vòng lặp; (4) học thật — Auto bấm đúng nút người chơi phải bấm, kể cả bàn pha; (2) quay lại — đội 3 người có tính cách, phải sắp việc cho hợp.

## 2. Slot và giới hạn việc

**Farm** (`farm/rules.js`): `FARM_SLOTS = 3`. Mảng việc: `care` (trồng, tưới, bón, làm cỏ, tỉa, hái) · `processing` · `delivery`.

| Biến | Công thức | Khoảng |
|---|---|---|
| `groupLimit(w)` | robot: 1 việc · người: cấp ≥ 7 → 3, cấp ≥ 4 → 2, còn lại 1 (mảng) | 1–3 |
| `activeJobs(w)` | robot: việc bật đầu tiên · người: các việc bật nằm trong `groupLimit` mảng bật đầu tiên (thứ tự care → processing → delivery) | tập con của `WORKER_JOBS` |

- Thuê mới tự nhận **mảng đội đang thiếu** (người) hoặc **việc đội đang thiếu** (robot), nên 3 lần thuê phủ đủ chăm cây, chế biến, giao.
- Bật thêm mảng vượt giới hạn → từ chối "Cấp X làm tối đa N mảng · Đa nhiệm từ cấp Y". Robot bật việc mới → việc cũ tự tắt.
- Save cũ: dữ liệu `jobs` giữ nguyên, chỉ `activeJobs` cắt theo cấp; Thiết lập hiển thị đúng việc thật sự làm. Save có người dự bị: lấp đủ 3 slot rồi mới hoàn phí người dư. Không còn xóa robot thứ hai.

**Quán** (`cafe/recipes.js`): `MAX_CREW = 3`, giới hạn vai giữ nguyên trong 3 slot. Save cũ nhiều hơn 3 người: **giữ 3 người đầu danh sách, người dư bị bỏ khi tải** (quán không có phí tuyển, chỉ mất phần ca đã trả còn lại).

## 3. Chia việc không trùng và di chuyển

- **Bảng giữ chỗ chung.** Farm: `farm.reserve(id, action, owner)`; bạn giữ chỗ bằng owner `player`. Thợ không nhận việc đã có người giữ, và **nhường** việc bạn đang đi tới (đã có). Auto của bạn bỏ qua việc thợ đang giữ. Quán: `claims` (`order:`, `brew:`, `drink:`, `clean:`); ly bạn đang pha ở bàn pha (`benchTarget`) không barista nào pha trùng; bạn chỉ nhận order chưa có thu ngân giữ.
- **Phân công farm (mỗi 0,65 s hoặc khi dữ liệu đổi):** mỗi thợ rảnh lấy 6 việc điểm cao nhất; duyệt mọi tổ hợp gán cho tối đa 3 thợ (mỗi người 1 việc hoặc không, hai người không cùng mục tiêu), chọn **tổng điểm cao nhất**. Tối đa 7³ = 343 tổ hợp.
  `điểm = ưu tiên × 10 + thưởng chờ lâu + 15 (đơn được giao) + 2 (đúng vai) + kỹ năng/100 − 1,2 × ETA + 8 (đang đứng sát)`; việc ngoài `activeJobs` = −∞.
- **Vùng:** cây chia theo ruộng/cột cho thợ đang làm; thợ khác vào vùng của người đó chỉ khi người đó không làm được việc ấy (robot chỉ tưới → người vẫn hái trong vùng robot).
- **Di chuyển** (giữ cơ chế đã có, áp cho 3 thợ): tìm đường trên lưới chung; gặp người thì người rảnh tránh sang một bên, giữ hướng tránh tới khi thoáng; bị chặn > 0,8 s thì lách xuyên người tạm thời (không xuyên tường); kẹt vật cố định 3 lần thì bỏ việc 4 s.

## 4. Lười, mệt, ghét việc (chỉ người)

Năng lượng `E ∈ [0, 100]` sống theo phiên (không lưu), bắt đầu 100. Code: `src/shared/game/morale.js`.

| Biến | Giá trị | Ý nghĩa |
|---|---|---|
| Tính cách | `diligent` (base 0,02, hao ×0,8) · `normal` (0,05, ×1) · `lazy` (0,14, ×1,3) | Cố định theo id, tỉ lệ 1 : 2 : 1 |
| Việc ghét | 1 mảng (farm: care/processing/delivery; quán: order/brew/deliver/clean) | Cố định theo id |
| Hao | −1,5 × hệ số hao mỗi việc xong | |
| Hồi | +0,1/s khi rảnh hoặc đang nghỉ; nghỉ vì mệt xong +30 | |

Lúc bắt đầu mỗi việc quay một lần: `p = base + 0,4 × (1 − E/100)² + 0,15 × [việc ghét]`, trần 0,6. Khoảng: 0,02 (siêng, khỏe, việc thích) → 0,6.

| Lý do (theo thứ tự) | Điều kiện | Tác dụng |
|---|---|---|
| 😮‍💨 Mệt quá | E < 35 | Đứng nghỉ 10 s, xong +30 năng lượng |
| 🙅 Không muốn làm việc này | việc thuộc mảng ghét | Đứng 3 s rồi tính lại việc |
| 🥱 Khỏe mà lười | còn lại | Đứng chơi 8 s |

- Làm chậm khi mệt: thời gian làm × `1 + 0,4 × (1 − E/100)` (tối đa ×1,4).
- Barista người mệt (E < 35): −12 điểm ly. Sao ly nhân viên = `min(2, sao(điểm))`; robot = `min(1, sao(điểm))`.
- Bong bóng/trạng thái hiện lý do. Không có nút "Nhắc" cho các lần nghỉ này (ngắn ≤ 10 s); sự cố cũ (mải chơi 40 s, ốm, chửi khách) giữ nguyên luật [robot-staff](robot-staff.md) mục 4.
- Ví dụ: người `lazy` giao đúng mảng ghét, E = 30 → p = 0,14 + 0,4 × 0,49 + 0,15 = 0,486 → gần nửa số việc bị trễ 10 s. Đổi mảng (hoặc đổi người) là cách chữa.

## 5. Chế độ Auto

- **Lượt:** `AUTOPLAY = { runs: 3, runMs: 600000 }`. Bấm ▶ Auto: còn thời gian lượt cũ thì chạy tiếp, không thì trừ 1 lượt và nạp 10 phút. Thời gian chỉ trôi khi Auto đang chơi (ghi xuống save mỗi 5 s và khi dừng).
- **Dừng (đổi 05/11/2026, thay phương án A 04/11):** chỉ bấm ⏸ hoặc hết 10 phút mới dừng Auto. Khi Auto bật: vuốt/kéo màn hình và cuộn chuột vẫn xoay/zoom camera; chạm bản đồ/vật thể 3D, joystick, phím W A S D / mũi tên **bị bỏ qua** (không điều khiển nhân vật, không dừng Auto); chạm thợ/nhân viên vẫn mở bảng của họ; ở quán, chạm biển "＋" ô trống vẫn mở Nâng cấp › Tự động và chạm bàn (tay không) vẫn mở thẻ bàn, nhân vật không bị dời (sửa 05/11/2026). Bấm HUD, cửa hàng, kho, nhân viên, đơn hàng, nâng cấp **không** dừng Auto: nhân vật vẫn đi và làm việc phía sau cửa sổ (ngoại lệ của luật "modal khóa di chuyển", chỉ khi Auto bật), bàn tay ẩn, chỉ còn dòng chữ. Auto **không bao giờ đóng cửa sổ bạn mở**; Auto chỉ đóng bàn pha do nó mở và báo cáo cuối ca. Khi cửa sổ của bạn đang mở, Auto không làm việc mở giao diện đè lên (không pha ở bàn pha, không đổi cảnh); tới quầy pha chỉ lấy ly có sẵn. 
- **Một nhân vật, không nhân đôi:** Auto chỉ điều khiển nhân vật của bạn ở cảnh bạn đang đứng. Cảnh còn lại do thợ/nhân viên đã thuê lo (farm vẫn chạy khi bạn ở quán; quán tạm dừng khi bạn rời như luật cũ). Thuê thêm người khi Auto đang chạy: họ vào việc ngay, Auto tránh việc họ đã giữ.
- **Farm:** khi nhân vật rảnh, chọn việc `ưu tiên × 10 − 1,2 × khoảng cách`, ưu tiên: hái 6 · nhận mẻ 5 · tưới/lấy nước 4,5 · đảo 4 · chạy mẻ 3,5 · làm cỏ 3 · trồng 2,5 · bón 2 · tỉa 1. Đi bằng đúng luồng chạm ô của người chơi (`pendingTool` → `begin` → `applyAction`), nên mọi luật/nhiệm vụ tính như bạn tự làm. Không có việc → gợi ý vào quán. Auto **không** nâng cấp, không thuê người; mua bán/gửi đơn chỉ qua lớp hậu cần ở gạch dưới. Auto chỉ gửi/bán **phần hạt rang dư** sau khi trừ lượng các đơn đang mở (≥ 100 g), để gom đủ đơn 200/252 g (sửa 04/11/2026, GP-B3).
- **Quán:** thứ tự: mở cửa (nếu đóng và chưa có ca) → cầm ly thì mang ra bàn/quầy → lấy ly trên kệ chưa ai giữ → nhận order nếu không có thu ngân → pha order chưa ai lo (đủ nguyên liệu) → dọn bàn chưa ai giữ → đứng ở quầy thu ngân. Bàn pha: Auto bấm **⚡ Pha nhanh** (không chơi từng bước), chờ 6 s, bấm «Mang đi» ([04-cafe/gameplay](../screens/04-cafe/gameplay.md) mục Pha nhanh). Thiếu nguyên liệu → đóng bàn pha, 20 s không thử pha. Cửa sổ khác (báo cáo ca…) → bấm × sau 1,5 s.
- **Auto toàn phần (04/11/2026, vòng 2):** thứ tự mỗi nhịp: câu hỏi mẹo (**không trả lời thay**: bấm «Để sau» để câu hỏi chờ người chơi tự trả lời; đáp án đúng không còn nằm trong trang — sửa 04/11/2026 sau audit) → sự cố nhân viên (chửi khách: bấm sau 0,6 s; mải chơi: 1,2 s) → việc ruộng/quầy → việc hậu cần → đổi cảnh. Hậu cần farm (chỉ tay vào nút HUD 1,4 s rồi làm): giao đơn quán đủ hàng → giao đơn cửa hàng → quán dưới 400 g hạt thì gửi hạt rang (vùng có quán) / bán hạt rang ở chợ (vùng chỉ farm) → hết cây giống mà còn ô trống thì mua giống (giữ lại 20 xu, tối đa 12 cây). Hậu cần quán: order thiếu vật tư thì mua 1 gói (còn ≥ giá + 5 xu); quán dưới 120 g hạt thì gọi hạt từ farm. Farm hết việc 2 s → vào quán; hết ca mà farm có việc → về farm (vùng chỉ quán thì ở lại).
- **Chống lặp và kẹt (rà 04/11/2026):** việc ruộng/trạm làm thất bại (kho đầy, đường kẹt) nghỉ 15 s, không giữ được chỗ thì nghỉ 5 s; việc hậu cần thất bại nghỉ 15 s, rồi Auto chuyển việc khác. Hạt đang trên đường sang quán được tính vào lượng hạt của quán (không gửi chuyến mới liên tục). «Nhắc» thợ không làm mất chỗ giữ việc của bạn. Bàn pha: mọi order đã có người lo thì đóng bàn pha, không coi là thiếu nguyên liệu. Đang tải cảnh quán thì không lên việc ở farm.
- Ly Auto pha là ly Pha nhanh của bạn (×2 giá): sao theo điểm bạn đã tự pha món đó — chưa tự pha ★, tự pha đạt 70 thì ★★, đạt 90 thì ★★★ (đổi 04/11/2026 sau audit). Bật Auto khi chưa tự pha món nào thì ly chỉ ★, thu nhập và mốc ca thấp hơn.

## 6. Núm chỉnh

| Núm | Hiện tại | File |
|---|---|---|
| Slot farm / quán | 3 / 3 | `FARM_SLOTS` (`farm/rules.js`), `MAX_CREW` (`cafe/recipes.js`) |
| Mốc đa nhiệm farm / quán | cấp 4 & 7 / cấp 3 | `groupLimit` / `helps` (`cafe/service.js`) |
| Lượt Auto | 3 × 10 phút | `AUTOPLAY` |
| Lười | base, hao, hồi, ngưỡng mệt, thời gian nghỉ | `TRAITS`, `MORALE` (`shared/game/morale.js`) |
| Sao | robot 1, nhân viên 2, bạn 3 | `STAR_CAP` (`cafe/recipes.js`) |

## 7. Chưa làm / cần đo

- Test 04/11/2026: `node --test tests/*.test.js` 35/35 qua. Chưa chơi thử. Test đã cập nhật/thêm: `tests/farm-gameplay.test.js` (3 slot, robot 1 việc, đa nhiệm, công thức lười), `tests/worker-avoidance.test.js` (cố định `Math.random`).
- Cần đo: tỉ lệ thời gian nghỉ thực tế của đội 3 người; Auto farm có đủ việc trong 10 phút với 1 ruộng không; Auto có kẹt ở popup mẹo/hướng dẫn nào không.
- Chưa có: chọn tay việc cho từng nhân viên quán ngoài vai; nhắc khi nhân viên đang nghỉ vì lười.
