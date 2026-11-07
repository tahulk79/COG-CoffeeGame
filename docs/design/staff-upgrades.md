# Nâng cấp chỉ số Nhân viên & Robot (kế hoạch)

> 2026-11-07: **giai đoạn A, B, C và D đã code** (chưa commit, chưa thử trên trình duyệt). D theo luật mới ở mục 2.3.
> C: tỉ lệ lỗi theo bảng 2.2 (`MISTAKES` trong economy.js), câu thoại theo tính cách `realm.staff.oops.*`.
> Đã có ⬆️ trên đầu nhân viên đủ kinh nghiệm (bấm mở thẻ), icon chức năng trên đầu robot lúc rảnh (Auto có viền xanh 🔄),
> và phần cứng hiện trên thân robot: hộp pin sau lưng, vòng động cơ dưới chân, đầu ăng-ten (sạc) đổi màu theo bậc.
> Số liệu nằm trong `src/core/config/economy.js` (`STAFF_LEVELS`, `SMART_RULES`, `ROBOT_TASKS`, `ROBOT_PARTS`).
> Nối tiếp mục Tuyển dụng (đã code) trong `docs/design/staff-robot-gameplay.md` §6.
>
> Đã code khác bản đề xuất một chút:
> - Cấp 5 (luật mới, founder chốt): quán **tự nhập hạt** + **pha được latte**; trại **hái 2 cây một lượt**.
> - Luật trại cấp 4 là "làm xong sang việc khác ngay" (cấp thấp đứng 1,2 giây), thay cho "vòng ngắn nhất".
> - Robot luôn lấy việc theo thứ tự đến (không ưu tiên khách gấp) và không pha xong bưng luôn: đúng luật 1 chức năng.
> - Lỗi "đổ ly" xảy ra ngay tại bàn khách (ly quay lại hàng chờ pha), không phải giữa đường.

## 1. Mục tiêu

Người chơi thấy rõ: nhân viên **cấp cao làm thông minh hơn và chuẩn hơn** chứ không chỉ nhanh hơn một con số.
Mỗi lần nâng cấp phải **nhìn thấy được trong game**. Ví dụ: barista cấp 1 bưng 1 ly, cấp 3 bưng 2 ly và chọn bàn sắp
bỏ đi trước; nông dân cấp 1 hái cây gần nhất, cấp 3 hái cây sắp rụng trước.

## 2. Bốn chỉ số của nhân viên (robot chỉ có ⚡ Nhanh và 🔋 Bền, xem mục 4)

| Chỉ số | Ý nghĩa | Đang có trong code | Nâng cấp làm gì |
|---|---|---|---|
| ⚡ **Nhanh** | Tốc độ đi + tốc độ làm | `SPEED` trong `staff.js`, `effect.growSpeed / brewSpeed` | +% tốc độ đi, +% hiệu ứng |
| 🧠 **Thông minh** | Chọn **việc nào trước**, đi đường nào | Đã có sẵn các luật hay: ưu tiên khách gấp, bưng 2 ly, pha xong bưng luôn, gần trước | **Mở dần** các luật này theo cấp (cấp thấp thì "ngố" hơn) |
| 🎯 **Chuẩn** | Ít lỗi, chất lượng cao hơn | Chưa có lỗi nào | Thêm **lỗi nhỏ có hoạt cảnh** ở cấp thấp, giảm dần theo cấp. Sau này nối với chất lượng ★ |
| 🔋 **Bền** | Bao lâu mới nghỉ | `STAFF_BREAKS`: nhân viên lướt điện thoại, robot hết pin | Giảm tỉ lệ nghỉ (người) / tăng thời lượng pin (robot), giảm phí gọi lại |

### 2.1 Thông minh: mở luật theo cấp (không cần AI mới)

Phần lớn "độ thông minh" **đã code xong** trong `staff-brain.js`. Hiện mọi nhân viên đều dùng hết các luật đó.
Đề xuất: cấp thấp chỉ dùng một phần, nâng cấp thì mở thêm. Người chơi sẽ thấy nhân viên khôn lên thật.

**Quán café**

| Cấp | Luật mở | Người chơi thấy |
|---|---|---|
| 1 | Làm việc theo thứ tự đến (không xét khách nào gấp) | Có lúc bưng cho bàn mới tới, bàn sắp bỏ đi vẫn chờ |
| 2 | **Ưu tiên khách sắp hết kiên nhẫn** + đi nhanh khi gấp (`mostUrgent`, `URGENT_SPEED`) | Thấy nhân viên chạy tới bàn đang đỏ |
| 3 | **Bưng 2 ly một lần** (`secondCup`, gần trước) | Bưng hai tay |
| 4 | **Pha xong bưng luôn** (`CHAIN_WAIT_MS`) + tự báo hết hạt sớm | Ít ly nguội trên kệ |
| 5 | Làm được **món khó** ở 2★ (khi có hệ ★) | Không phải chủ tự pha mọi latte |

**Nông trại**

| Cấp | Luật mở | Người chơi thấy |
|---|---|---|
| 1 | Hái cây **gần nhất** | Có cây chín lâu ở xa bị bỏ sót |
| 2 | Hái cây **chín lâu nhất trước** (sắp rụng) | Ít cây rụng quả |
| 3 | **Trồng lại đúng giống đang bán chạy** (giống player chọn gần nhất) | Ruộng đồng đều |
| 4 | Đi theo **vòng ngắn nhất** qua nhiều ô (gom việc) | Ít đi tới đi lui |
| 5 | Làm thêm **một khâu kề** (vd. chăm cây, giao hàng) | Một người làm được 2 việc |

### 2.2 Chuẩn: lỗi nhỏ có hoạt cảnh (vui, không phạt nặng)

Lỗi chỉ làm **chậm** hoặc **mất một chút**, không làm mất khách hay mất người. Mỗi lỗi có câu thoại theo tính cách.

| Lỗi | Ở đâu | Hậu quả | Tỉ lệ cấp 1 → cấp 5 |
|---|---|---|---|
| Đổ ly | Quán, khi bưng | Pha lại ly đó (mất hạt của 1 ly) | 6% → 0% |
| Bưng nhầm bàn | Quán | Đi thêm một đoạn | 8% → 0% |
| Hái non | Trại | Mẻ đó ít hơn 1 hạt | 6% → 0% |
| Trồng lệch luống | Trại | Cây đó mọc chậm 10% | 5% → 0% |

Tính cách cộng thêm: 🥱 Lười +50% tỉ lệ lỗi, 😀 Siêng −30%, 😄 Vui tính bằng chuẩn (nhưng làm đổ thì khách cười, không giận).
Robot **không bao giờ mắc lỗi** nhưng cũng **không bao giờ làm món khó / hái 3★** (đúng luật "robot ổn định, 1★").

### 2.3 Chất lượng ★ (đã code, luật đơn giản founder chốt 2026-11-07)

Không thêm món mới. Sao do **ai làm** quyết định (`QUALITY` trong economy.js):

| Ai làm | Ly ở quán | Mẻ hái ở trại |
|---|---|---|
| Chủ (người chơi) | 3★ | 3★ nếu hái trong 10 giây sau khi chín, trễ hơn thì 1★ |
| Nhân viên cấp 3–5 | 2★ | 2★ |
| Nhân viên cấp 1–2 | 1★ | 1★ |
| Robot | 1★ | 1★ |

- Giá ly: 1★ ×1, 2★ ×1,2, 3★ ×1,5. Số hạt: 1★ ×1, 2★ ×1,25, 3★ ×1,5 (làm tròn).
- **Món khó = Latte.** Robot không bao giờ pha. Nhân viên pha được từ cấp 5. Chủ luôn pha được. Đơn latte không ai pha
  được thì chờ chủ, robot / nhân viên nói câu nhắc (mỗi 20 giây).
- Bán hoặc hái 2★ / 3★ thì hiện ⭐ bay lên.
- Mô phỏng kinh tế (người chơi tự làm hết nên luôn 3★): 60 phút đạt Lv14 (trước Lv13), thu nhập mỗi phút cuối ván khoảng gấp đôi.

## 3. Nhân viên lên cấp thế nào

Hai bước, để người chơi vừa thấy nhân viên "tự lớn" vừa có chỗ tiêu xu:

1. **Kinh nghiệm (tự có):** mỗi việc làm xong +1 XP cho nhân viên đó. Đủ XP thì hiện mũi tên ⬆️ trên đầu.
2. **Đào tạo (trả xu):** bấm mũi tên hoặc vào Staff → Đội của bạn → **Đào tạo**. Trả xu, chạy hoạt cảnh ngắn
   (đội mũ tốt nghiệp 🎓), lên cấp.

| Cấp nhân viên | XP cần | Phí đào tạo (gợi ý) | Cần cấp người chơi |
|---|---|---|---|
| 1 → 2 | 30 việc | 150 | Lv 3 |
| 2 → 3 | 80 việc | 400 | Lv 5 |
| 3 → 4 | 160 việc | 900 | Lv 8 |
| 4 → 5 | 300 việc | 2000 | Lv 12 |

Mỗi cấp tăng **cả 4 chỉ số** một chút (Nhanh +8%, Bền +15%) và mở **một luật Thông minh** (bảng 2.1),
giảm lỗi theo bảng 2.2. Không bắt người chơi chia điểm: đơn giản, dễ hiểu trên điện thoại.

Tính cách ảnh hưởng tốc độ học: 😀 Siêng +25% XP, 🥱 Lười −25% XP. Như vậy ứng viên Lười rẻ lúc thuê nhưng lâu giỏi.

## 4. Robot nâng cấp thế nào

**Robot chỉ là robot** (founder chốt 2026-11-07): không học, không khôn lên, không mắc lỗi. Lúc nào cũng làm đúng
khâu của nó, cùng một cách, ở 1★. Muốn có người làm thông minh hay làm món khó thì phải thuê nhân viên.

### 4.1 Mỗi robot chỉ làm 1 chức năng: người chơi cài, hoặc để Auto

Founder chốt 2026-11-07. Một robot lúc nào cũng chỉ làm **đúng một chức năng**. Người chơi chọn chức năng đó trên thẻ
robot (Staff → Đội của bạn → bấm robot), hoặc chọn **🔄 Auto**.

| Robot (tên hiển thị trong game luôn là **Robot**) | Chức năng cài được |
|---|---|
| 🤖 Robot ở trại (`sproutBot` trong code) | 🌱 Trồng · 🌾 Hái · 🔄 Auto |
| 🦾 Robot ở quán (`brewBot` trong code) | 🧾 Nhận order · ☕ Pha · 🚶 Bưng · 🔄 Auto |

Sau này có khâu mới (Chăm, Giao ở trại; Dọn bàn ở quán) thì chỉ cần thêm vào danh sách này, không cần thêm loại robot.

- **Cài tay:** robot chỉ làm đúng chức năng đó. Hết việc của chức năng đó thì **đứng chờ** và nói kiểu báo cáo
  (🤖 «Chức năng: Hái. Cây chín: 0. Đang chờ.»). Người chơi hiểu ngay là mình cài chưa hợp lý.
- **Auto:** robot tự chọn **một** chức năng đang tồn việc nhiều nhất (hàng khách dài nhất, nhiều cây chín nhất…) rồi làm
  **chỉ chức năng đó**. Mỗi 30 giây nó xem lại và mới được đổi. Lúc đổi có hoạt cảnh ngắn (đèn đổi màu, 🤖 «Chuyển
  chế độ: Pha.»). Như vậy Auto vẫn đúng luật "1 chức năng", chỉ là máy tự chọn, và chậm thích nghi hơn người.
- Robot mới mua mặc định là **Auto**, để người chơi mới không phải cài gì.
- Trên đầu robot luôn có icon nhỏ của chức năng đang làm (🌱 / 🌾 / 🧾 / ☕ / 🚶). Ở chế độ Auto icon có viền 🔄.
- Đổi chức năng **miễn phí**, bấm bao nhiêu lần cũng được.
- Founder chốt 2026-11-07: robot không có tên riêng, trong game đều gọi là **Robot** (đã đổi chữ hiển thị).
- Code hiện tại khác luật này: robot ở trại vừa hái vừa trồng, robot ở quán làm được mọi việc của quán (chỉ ưu tiên quầy pha).
  Cần sửa: `unit.task` (`'plant' | 'harvest' | 'order' | 'brew' | 'deliver' | 'auto'`) được lưu trong save, và
  `staff-brain` / `staff.js` chỉ cho robot làm đúng `task` đó (Auto: chọn task theo tồn việc, giữ ít nhất 30 giây).

### 4.2 Nâng cấp phần cứng

Robot nâng cấp **phần cứng** bằng xu (mua là có ngay, không có kinh nghiệm):

| Linh kiện | Làm gì | Bậc 1 / 2 / 3 |
|---|---|---|
| 🔋 **Pin** | Chạy lâu hơn mới phải sạc | 3 → 4 → 6 → 9 phút mỗi lần sạc |
| ⚡ **Sạc nhanh** | Phí sạc rẻ hơn | phí sạc −20% / −40% / −60% |
| ⚙️ **Động cơ** | Đi và làm nhanh hơn | +10% / +20% / +35% |

- Giá gợi ý: bậc 1 = 30% giá robot, bậc 2 = 60%, bậc 3 = 100%. Bậc 3 cần cấp người chơi Lv 8.
- Nhìn thấy được: pin lớn hơn trên lưng, đèn pin trên thân sáng nhiều vạch hơn, bánh xe / chân đổi màu khi có động cơ mới.
- Không có "chip thông minh": cách robot chọn việc giữ nguyên ở mọi bậc.

## 5. Giao diện (điện thoại dọc)

- **Staff → Đội của bạn:** mỗi dòng thêm thanh XP nhỏ + 4 chấm chỉ số (⚡🧠🎯🔋). Bấm vào dòng mở **thẻ chi tiết**:
  ảnh, tên, tính cách, cấp, 4 chỉ số dạng thanh, "Cấp sau mở: Bưng 2 ly", nút **Đào tạo 🪙400**.
- **Robot:** thẻ chi tiết có hàng nút chọn chức năng (🌱 Trồng / 🌾 Hái / 🔄 Auto…, nút đang chọn sáng lên) và 3 dòng (🔋 Pin, ⚡ Sạc nhanh, ⚙️ Động cơ), mỗi dòng một nút **Nâng cấp 🪙…**.
- **Trong game:** mũi tên ⬆️ vàng nổi trên đầu khi đủ XP (bấm là mở thẻ), giống bong bóng 🪙 khi nghỉ hiện có.
- Toolbar Staff có chấm đỏ khi có người đào tạo được.

### 5.1 Quản lý đội (đã code, founder yêu cầu 2026-11-07)

Menu Nhân viên có 3 tab: **Đội** (mặc định khi đã có người) · Ứng viên · Robot. Mỗi người trong Đội có:
- **Báo cáo**: đang làm gì, hoặc vì sao đứng chờ (cây đang mọc + còn mấy giây, kho đầy, thiếu xu mua hạt giống, hết khách,
  hết ghế, hết hạt, có latte không pha được, quán tạm nghỉ…), và dòng 👉 **bạn cần làm gì** kèm nút (làm tiếp, sạc, tưới,
  đào tạo, phân công). Tự cập nhật mỗi giây.
- **4 thanh chỉ số**: ⚡ Nhanh · 🧠 Thông minh · 🎯 Chuẩn (kèm số sao) · 🔋 Bền. Robot: Thông minh "cố định", Chuẩn luôn đầy.
- Bấm tên mở thẻ: nâng cấp (đào tạo / chức năng + phần cứng) và **Cách làm việc**: các bước theo thứ tự ưu tiên đúng với cấp
  hiện tại, kèm tỉ lệ lỗi và khả năng lười.

Trong game (nông trại): trên đầu nhân viên rảnh luôn có icon lý do (⏳ cây đang mọc, 📦 kho đầy, 💸 thiếu xu hạt giống).
Lười thì **đi lung tung** cầm điện thoại kèm bong bóng 🪙 (bấm = trả phí để làm tiếp). Hết việc vì cây đang mọc thì có
bong bóng 🪙 **Tưới cây** (`TEND`: 15 xu → tưới tối đa 4 cây đang mọc, mỗi cây chín sớm hơn 30% thời gian, mỗi lần trồng
chỉ tưới 1 lần).

## 6. Dữ liệu & code (để ước lượng)

- Save: `unit.level`, `unit.xp` (người), `unit.task` + `unit.parts = { battery, charger, motor }` (robot). Thêm vào `state.js` normalize.
- Config: `STAFF_LEVELS` (XP, phí, cấp yêu cầu, luật mở) và `ROBOT_PARTS` trong `economy.js`.
- Reducer: `staff/train { uid }`, `staff/upgradePart { uid, part }`, `staff/setTask { uid, task }`, `staff/workDone { uid }` (cộng XP, gom theo lô để
  không dispatch mỗi việc).
- `staff-brain.js` nhận thêm `ctx.skill` (cấp nhân viên; robot luôn dùng bộ luật cố định) để bật tắt từng luật; `staff.js` đọc tốc độ và tỉ lệ nghỉ theo cấp.
- Lỗi (mục 2.2): roll trong `staff.js` khi xong việc → action có `roll` trong payload (giữ reducer xác định được).
- Kinh tế: chạy lại `scripts/economy-sim.mjs` sau khi gắn phí đào tạo và linh kiện.

## 7. Lộ trình

| Giai đoạn | Nội dung | Ghi chú |
|---|---|---|
| A | Cấp nhân viên + XP + Đào tạo, mở luật Thông minh theo cấp (quán trước, trại sau) | Thấy khác biệt nhiều nhất, ít đổi kinh tế |
| B | Robot 1 chức năng (cài tay / Auto) + phần cứng (Pin, Sạc nhanh, Động cơ) | Sửa luật robot hiện tại, phần cứng chỉ là mua |
| C | Lỗi nhỏ có hoạt cảnh + thoại theo tính cách | Cần thêm hoạt cảnh đổ ly, hái non |
| D | Nối với chất lượng ★ và món khó | Phụ thuộc hệ ★ (staff-robot-gameplay giai đoạn 3) |

## 8. Cần bạn chốt

1. Cấp tối đa nhân viên là **5** (đang code theo đề xuất), hay muốn dài hơn (ví dụ 10, đi theo lộ trình Lv100)?
2. Lên cấp cần **cả XP lẫn xu** (đang code theo đề xuất), hay chỉ cần xu?
3. Có làm **lỗi nhỏ** (đổ ly, hái non) không, hay chỉ cần "cấp thấp thì chậm và ngố hơn"?
4. ~~Robot nâng cấp thế nào?~~ Đã chốt: robot chỉ là robot, chỉ nâng phần cứng (pin, sạc, động cơ). Xem mục 4.
5. Sự cố Lv10 xoá hết nhân viên (code giữ nguyên như cũ): có giữ lại **một người được chọn** (kèm cấp) để người chơi không mất công đào tạo không?
