# Người chơi – Nhân viên – Robot: áp dụng vào Nông trại & Quán café

> Bản đề xuất để review (2026-11-06). Chưa code. Dựa trên công thức gameplay founder gửi và hệ thống nhân viên hiện có
> trong game (`src/core/config/economy.js` STAFF, `src/features/realm/staff.js`).

## 1. Kết luận nhanh

**Áp dụng được cho cả hai game.** Khung kỹ thuật đã có sẵn khá nhiều. Phần còn thiếu nằm ở luật chơi, ở việc cho thấy
trạng thái trong thế giới game, và ở mục Tuyển dụng.

| Đã có trong game | Còn thiếu so với công thức |
|---|---|
| 4 loại: Nông dân, Barista, Sprout Bot, Brew Bot | Robot đang làm nhiều việc (Sprout Bot vừa hái vừa trồng; Brew Bot vừa nhận order vừa pha), trái luật "robot = 1 thao tác" |
| 3 slot mỗi khu, thuê một lần, giữ mãi | Không có lương, đào tạo hay kinh nghiệm. Nhân viên chưa "đắt hơn nhưng linh hoạt hơn" robot |
| Nhân viên làm việc thật (đi tới, làm, có hoạt ảnh) | Chưa có chất lượng đầu ra ★, nên người chơi chưa có lý do để tự tay làm |
| Nghỉ giữa giờ: nhân viên lướt điện thoại, robot hết pin, trả phí để làm tiếp | Chưa có thoại hài theo tình huống |
| "Giữ việc" (claim): mỗi việc một người, tránh tranh nhau | Chưa có luật nhường việc khi người chơi xen vào |
| Bảng Staff chỉ có 4 thẻ thuê | Chưa có mục **Tuyển dụng** (ứng viên, tính cách, lương) |

## 2. Chuỗi công việc (mỗi khâu có một dấu hiệu nhìn thấy)

### Quán café: Nhận order → Pha → Bưng → Dọn bàn

| Khâu | Hiện có? | Dấu hiệu khi thiếu người | Chỗ để người chơi thể hiện kỹ năng |
|---|---|---|---|
| Nhận order | Có | Hàng khách dài ra, bong bóng 💬 nhấp nháy đỏ | Nhận trước khách sắp hết kiên nhẫn |
| Pha | Có | Phiếu order dán thành hàng trên quầy pha | **Món khó** (latte, món mới): chỉ người chơi pha được 3★ |
| Bưng | Có | **Ly chất trên kệ** quầy pha | Cứu bàn sắp bỏ đi, bưng đúng bàn |
| Dọn bàn | **Mới** | Ly bẩn trên bàn, ghế không ngồi được | Dọn nhanh khi quán đông, vì thiếu ghế thì khách không vào được |

> "Dọn bàn" là khâu mới: khách đi thì để lại ly bẩn, ghế đó bị khoá cho tới khi được dọn. Khâu này rẻ và dễ hiểu,
> rất hợp với robot.

### Nông trại: Trồng → Chăm → Hái → Phơi → Giao bán

| Khâu | Hiện có? | Dấu hiệu khi thiếu người | Chỗ để người chơi thể hiện kỹ năng |
|---|---|---|---|
| Trồng | Có | Ô đất nâu trống | Chọn giống hợp lúc |
| Chăm (cỏ / sâu) | **Mới** | Cỏ mọc, sâu bò trên luống, cây lớn chậm lại | Ưu tiên ruộng giá trị cao |
| Hái | Có | Cây đỏ quả, rồi **quả rụng xuống đất** nếu để quá lâu | **Hái đúng lúc** (vừa chín) cho hạt 3★ |
| Phơi | Có máy phơi (Dryer), chưa là khâu riêng | **Giỏ quả chất cạnh sân phơi** | Đảo mẻ đúng lúc |
| Giao bán | Có (Bán hạt) | **Bao hạt xếp ở kho**, xe thương lái đứng chờ | **Đơn gấp** của thương lái: giá cao, phải giao trong X phút |

> Nếu muốn ít việc hơn, có thể bỏ "Chăm" và "Phơi" ở bản đầu, giữ Trồng → Hái → Giao (vẫn đủ 3 khâu cho 3 vai).

## 3. Ba vai trong mỗi game

### Luật chung

| Ai | Luật | Cái giá |
|---|---|---|
| 🤖 Robot | Làm **đúng một khâu**, ổn định, chất lượng 1★ | Chiếm slot cả khi khâu đó rảnh. Thiếu đầu vào thì đứng chờ. Hết pin thì phải sạc (đã có) |
| 🧑 Nhân viên | Phụ trách **một nhóm việc**. Lên kinh nghiệm thì làm thêm được **một khâu kề**. Tối đa 2★ | Lương theo ca, mới vào thì làm chậm (đào tạo), đôi lúc nghỉ (đã có) |
| 👤 Người chơi | Làm được mọi khâu, tạo được 3★, làm được món khó / đơn đặc biệt | Chỉ ở một chỗ tại một thời điểm |

**Chất lượng ★ dùng vào đâu** (không thêm tài nguyên mới):
- Quán: ly 1★ / 2★ / 3★ bán giá ×1 / ×1,2 / ×1,5 và khách tip thêm ở 3★.
- Nông trại: mẻ hái 1★ / 2★ / 3★ cho thêm +0 / +1 / +2 hạt (tức là ít hao hơn).

### Quán café

| Vai | Đề xuất |
|---|---|
| 🤖 **Order Bot** | Chỉ nhận order. Không có khách thì đứng nhìn cửa |
| 🤖 **Brew Bot** | Chỉ pha (ly 1★). Gặp món khó thì không pha được, để lại cho người |
| 🤖 **Tray Bot** | Chỉ bưng, **1 ly một lần** |
| 🤖 **Clean Bot** | Chỉ dọn bàn |
| 🧑 **Barista** | Nhóm việc: Nhận order + Pha. Kinh nghiệm cấp 2: pha được món khó ở 2★ |
| 🧑 **Phục vụ** | Nhóm việc: Bưng (**2 ly một lần**) + Dọn. Kinh nghiệm cấp 2: nhận order khi quầy đông |
| 👤 **Chủ quán** | Mọi khâu. Món khó 3★. Món mới phải được chủ pha trước vài lần thì barista mới "học" được |

### Nông trại

| Vai | Đề xuất |
|---|---|
| 🤖 **Sprout Bot** | Chỉ trồng (sửa lại: hiện nó đang hái cả) |
| 🤖 **Weed Bot** | Chỉ chăm (nhổ cỏ, bắt sâu) |
| 🤖 **Picker Bot** | Chỉ hái, mẻ 1★. Không trồng lại |
| 🤖 **Cart Bot** | Chỉ chở bao hạt ra xe giao |
| 🧑 **Nông dân** | Nhóm việc: Trồng + Hái (2★). Kinh nghiệm cấp 2: chăm |
| 🧑 **Thủ kho** | Nhóm việc: Phơi + Giao. Kinh nghiệm cấp 2: nhận đơn gấp |
| 👤 **Chủ trại** | Mọi khâu. Hái đúng lúc thì được 3★. Giao đơn gấp giá cao |

### Mốc khởi đầu

- 3 slot mỗi game (như hiện tại).
- Robot đầu tiên: rẻ, chuyên 1 việc (Clean Bot ở quán, Sprout Bot ở trại).
- Nhân viên đầu tiên: cấp 1, đúng nhóm việc của mình.
- Nâng cấp: nhân viên làm thêm khâu kề; robot nhanh hơn và pin lâu hơn (vẫn chỉ 1 khâu).

## 4. Luật phối hợp

1. **Mỗi việc chỉ một người giữ.** Đã có (claim).
2. **Giữ chỗ khi bắt đầu đi tới.** Đã có.
3. **Trả việc về hàng chờ** khi bị chặn đường, hết ca hoặc thiếu vật tư (hết hạt, kho đầy). Cần bổ sung "hết ca" và "thiếu vật tư".
4. **Nhường cho người chơi ở bước còn bàn giao được** (mới):
   - Trại: nhân viên đang đi tới cây chưa hái mà người chơi chạm vào cây đó → nhân viên quay sang việc khác.
   - Quán: ly barista đang pha → pha xong đặt lên kệ để người khác bưng. Order mà chủ đang nhận → nhân viên bỏ qua.
5. **Không ai chặn đường mãi:** hai người gặp nhau ở lối hẹp thì một người đứng sang bên (kèm hoạt cảnh hài, mục 5).

## 5. Thoại hài từ việc đang xảy ra

Công thức: **việc thật trong game + phản ứng đúng tính nhân vật + trạng thái mà người chơi hiểu được.**
- Robot nói như **báo cáo**.
- Nhân viên nói theo **tính cách**: 😀 Siêng, 🥱 Lười, 😄 Vui tính (chọn khi tuyển, mục 6).
- Khách phản ứng với **điều vừa thấy**.

### Quán café

| Tình huống (trạng thái thật) | Câu thoại / hoạt cảnh | Người chơi hiểu |
|---|---|---|
| Brew Bot gặp món khó | 🤖 «Món này vượt quy trình. Đề nghị chủ quán biểu diễn.» | Phải tự pha món này |
| Barista gặp món chưa luyện | ☕ «Món này em thuộc tên. Phần còn lại xin anh biểu diễn.» | Chủ pha vài lần để dạy barista |
| Tray Bot cạnh kệ 3 ly | 🤖 «Tôi có hai tay. Hợp đồng ghi một ly.» | Phục vụ (2 ly) có lợi khi quán đông |
| Hết hạt, Brew Bot đứng chờ | 🤖 «Máy pha sẵn sàng. Hạt cà phê: 0.» | Cần nhập hạt |
| Hết hạt, barista siêng | 😀 «Em chạy ra nhập hạt nha anh!» (đi tới quầy rồi đứng chờ) | Cần nhập hạt |
| Hết hạt, barista lười | 🥱 «Hết hạt thì… mình bán nước lọc được không anh?» | Cần nhập hạt |
| Chủ bưng nhầm bàn | Khách nhìn ly rồi nhìn chủ: «Cảm ơn. Cho tôi gửi lời chào người đã gọi món này.» | Đang ở nhầm bàn, mang ly đi tiếp |
| Quán vắng, đội đã làm hết | Phục vụ nhìn chủ cầm giẻ: «Sếp xuống phụ hay xuống kiểm tra tụi em?» | Đội đang lo được hết |
| Bàn bẩn, khách mới đứng chờ | Khách: «Tôi đợi ghế, hay ghế đợi tôi?» | Cần dọn bàn |

### Nông trại

| Tình huống (trạng thái thật) | Câu thoại / hoạt cảnh | Người chơi hiểu |
|---|---|---|
| Sprout Bot trồng xong, có cây chín | 🤖 «Đã phát hiện 8 cây chín. Tôi sẽ tiếp tục quan sát chúng.» | Robot trồng không hái được |
| Cart Bot cạnh kho trống | 🤖 «Tôi giao được ngay. Phần hàng xin bổ sung sau.» | Kho đang hết hạt để giao |
| Kho đầy, Picker Bot đứng chờ | 🤖 «Kho đầy 100%. Tôi chuyển sang chế độ ngắm cây.» | Bán hạt hoặc nâng kho |
| Nhân viên lười gặp cỏ | 🥱 «Em đang đợi cỏ tự thấy có lỗi.» (ngồi xuống vài giây) | Việc hoãn ngắn, người khác nhận được |
| Nhân viên siêng gặp cỏ | 😀 «Để em, cỏ này em quen mặt!» | Đang được xử lý |
| Quả chín quá lâu sắp rụng | 😄 «Cây này chín tới mức muốn tự đi bán rồi anh ơi!» | Hái ngay kẻo mất 3★ |
| Hai nhân viên gặp nhau ở bờ ruộng hẹp | Cùng né trái, cùng né phải, rồi một người đứng hẳn sang bên | Đội tự nhường đường |
| Thương lái chờ đơn gấp | Thương lái gõ đồng hồ: «Hàng gấp mà chậm thì thành hàng… chậm.» | Còn ít thời gian cho đơn gấp |

### Luật tần suất (tách câu đùa khỏi sự cố)

- Câu thoại chỉ xuất hiện **khi trạng thái đổi** (kho vừa trống, ly thứ 3 vừa lên kệ…) hoặc sau **thời gian nghỉ ≥ 20 giây** cho mỗi nhân vật.
- Toàn màn hình **tối đa 1 câu mỗi 6 giây**. Ưu tiên câu báo trạng thái người chơi cần xử lý.
- Robot nói xong vẫn làm việc bình thường (câu đùa **không** gây sự cố).
- Nhân viên chỉ ngồi nghỉ khi luật mệt/lười thực sự kích hoạt (luật nghỉ hiện có), câu thoại chỉ đi kèm.
- Một robot đứng chờ lâu **không lặp lại cùng một câu**: mỗi tình huống có 2–3 biến thể, xoay vòng.

## 6. Mục Tuyển dụng (mới)

Một màn riêng trong menu **Staff** (mỗi game có danh sách riêng: trại tuyển người làm trại, quán tuyển người làm quán).

**Tab Nhân viên: bảng ứng viên**
- Luôn có **3 ứng viên**, làm mới sau mỗi X phút (hoặc trả ít xu để làm mới ngay).
- Mỗi thẻ ứng viên có:
  - avatar, tên;
  - **tính cách** (Siêng / Lười / Vui tính);
  - **nhóm việc** (vd. Barista: Nhận order + Pha);
  - **trần chất lượng** (★ / ★★);
  - **lương mỗi ca**, **phí tuyển**;
  - một câu tự giới thiệu hài (vd. 🥱 «Em làm việc rất hiệu quả, nhất là lúc nghỉ.»).
- Đánh đổi theo tính cách:
  - Siêng: lương cao, ít nghỉ.
  - Lười: lương rẻ, nghỉ nhiều.
  - Vui tính: khách tip thêm.

**Tab Robot: catalogue**
- Mỗi robot một chức năng, mua một lần, ghi rõ khâu nó làm, tốc độ và thời lượng pin.

**Quản lý đội (danh sách đã thuê)**
- Xếp vào slot (3 slot), bật/tắt ca, xem kinh nghiệm (thanh XP → cấp 2 mở khâu kề), nâng cấp robot, cho nghỉ việc (hoàn lại một phần).

**Lương (đề xuất đơn giản)**
- Trừ tự động mỗi **ca** (vd. 5 phút chơi). Không đủ xu thì nhân viên **nghỉ ca** (đứng chơi điện thoại) cho tới khi có xu. Không âm tiền, không mất người.

## 7. Lộ trình gợi ý

| Giai đoạn | Nội dung | Ghi chú |
|---|---|---|
| 1 | Robot chỉ 1 khâu, nhân viên theo nhóm việc, luật nhường cho người chơi, câu thoại theo trạng thái (dùng các khâu đang có) | Ít đổi luật kinh tế, thấy khác biệt ngay |
| 2 | Mục Tuyển dụng (ứng viên, tính cách, lương theo ca, kinh nghiệm) | Cần cân lại kinh tế (lương vs thu nhập) |
| 3 | Chất lượng ★ + món khó / hái đúng lúc / đơn gấp | Cho người chơi lý do tự tay làm |
| 4 | Khâu mới: Dọn bàn (quán), Chăm + Phơi (trại) | Thêm việc cho robot rẻ |

## 8. Cần bạn chốt

1. Nông trại thêm khâu **Chăm** và **Phơi**, hay giữ Trồng → Hái → Giao?
2. Quán thêm khâu **Dọn bàn**?
3. Lương trả **theo ca 5 phút** có ổn không, hay muốn trả theo cách khác?
4. Có làm **chất lượng ★** không? Món khó ở quán: chỉ cần bấm đúng lúc (mini-game nhỏ), hay chỉ cần chủ tự pha là đủ 3★?
5. Ứng viên làm mới bao lâu một lần, và có cho trả xu để làm mới ngay không?
6. Làm theo thứ tự giai đoạn 1 → 4 như trên chứ?
