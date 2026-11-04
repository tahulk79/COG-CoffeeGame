# Luật gameplay hiện hành — Nông trại và quán cà phê

Cập nhật ngày 02/11/2026, theo các quyết định của người dùng trong đợt chỉnh gameplay và UI. Đây là tài liệu chính để cùng sửa tiếp. Khi yêu cầu mới thay luật, sửa trực tiếp mục tương ứng và ghi vào nhật ký cuối trang; không nối thêm một bản luật trái ngược ở cuối.

Tài liệu ghi nhận quyết định và cách code đang thực hiện, chưa có nghĩa mọi luồng đã được kiểm chứng trong game. Lượt cập nhật tài liệu này không chạy test/build/preview. Các điểm chưa chốt nằm ở mục 10.

## 1. Vòng chơi và ba luồng tách biệt

Người chơi trồng/chăm/hái cà phê → phơi và tách vỏ → rang → chuyển nguyên liệu sang quán → pha bán. Có thể xay hạt thành bột. Cây là cây lâu năm, thu hoạch không xóa cây.

| Luồng | Ai làm | Kết quả | Nơi mở |
|---|---|---|---|
| Mục tiêu | Người chơi tự thao tác | Chuỗi nhiệm vụ cố định, thưởng một lần | Thẻ mục tiêu HUD trái |
| Đơn tiếp hàng cho quán | Nhân viên được phân công chuẩn bị; chủ chủ động gửi hoặc yêu cầu giao | Hàng rời kho farm, vận chuyển, vào kho quán | Đơn hàng |
| Bán lấy xu | Người chơi quyết định hàng và lượng bán | Trừ hàng, cộng xu | Cửa hàng → Chợ; hoặc Túi đồ |

- Việc nhân viên làm không tăng tiến độ mục tiêu của người chơi.
- Thợ chính làm theo chỉ thị nông trại (mục 3) cả khi không có đơn quán; đơn quán chỉ cộng ưu tiên cho người phụ trách. Thợ không làm nhiệm vụ cá nhân, không bán ở Chợ.
- Chuyển hàng nội bộ không sinh tiền. Mỗi chuyến đơn quán tốn 2 xu; quán kiếm doanh thu khi phục vụ khách.
- Quán là scene riêng. Farm tiếp tục cập nhật khi chủ sang quán. Không coi việc đóng game là nhân viên tự vận hành đầy đủ.

## 2. Đất, cây và thao tác trên bản đồ

- Farm có 4 ruộng, mỗi ruộng 12 ô, tổng 48 ô. Chỉ mua ruộng liền kề đủ điều kiện.
- Bấm ô/biển đất khóa: nhân vật tới biển trước; đủ tiền và liền kề mới mở xác nhận. Thiếu tiền báo số xu thiếu. Chỉ trừ khi xác nhận mua.
- Bấm ô trồng: sáng viền đúng ô, nhân vật tới gần. Chọn giống bằng dải icon nhỏ phía dưới, không làm tối bản đồ; có thể đổi ô ngay.
- Chạm cây = công cụ Tự chọn (mặc định): nhân vật tới làm việc cây cần nhất. Dải công cụ ⛏️ (chọn/kéo nhiều ô) **chỉ mở từ khi có ruộng thứ 2** (hoặc cấp 3, hoặc đã nhận nhiệm vụ Mua ruộng); giới hạn theo vật tư; không trừ nhiều lần trên cùng ô. Xem [luồng người chơi mới](design/onboarding-flow.md) mục 3.6.
- Tưới, cỏ, phân, tỉa có điều kiện theo trạng thái cây. Phân không phải điều kiện bắt buộc để cây lớn.
- Hái một lượt sản lượng chín; giữ cây và chuyển sang chu kỳ tiếp theo. Nhịp vụ trưởng thành cơ sở là 6 phút game, không dùng đoạn mô tả cũ “hái phần dư” làm luật.
- Thông số chăm chi tiết lấy từ `src/features/farm/content.js` và `rules.js`; đây là mô phỏng game, không phải hướng dẫn canh tác thực tế.

## 3. Nhân viên: thuê theo ca (đơn giản hóa 03/11/2026)

- Tối đa **2 thợ**, thuê là vào làm ngay tại farm; **không còn đội dự bị**, không kéo thả. Muốn đổi người: bấm × trên ô thợ hoặc "Cho nghỉ việc" trong hồ sơ (không hoàn phí tuyển và lương đã trả), rồi thuê người khác.
- Phí tuyển trả một lần khi thuê. **Lương D = `30 + 10 × (cấp − 1)` xu cho mỗi ngày công 6 phút**, tự trả khi còn dưới 30 giây nếu bật Tự gia hạn (mặc định bật) và đủ xu; trả thêm khi còn hạn sẽ **cộng dồn** từ lúc hết hạn. Hết xu thì thợ dừng an toàn, trả lại việc/vật tư đang giữ, báo ở Cần xử lý.
- **Không còn năng lượng, nghỉ giữa ca hay bồi dưỡng**: thợ làm liên tục trong thời gian đã trả. Nâng cấp "Phúc lợi nhân viên" bị bỏ cùng.
- Vắng mặt (tắt game/ẩn tab > 60 s) không tiêu ngày công đã trả.
- Thợ làm theo **chỉ thị nông trại** (nút Quản lý): Tự chăm vườn, Trồng lấp ô trống (chọn giống), Dùng phân bón, Tự chế biến — cả khi không có đơn quán; đơn quán cộng ưu tiên cho người phụ trách. Tự chế biến: phơi hết quả chín, chỉ rang tới đơn đang mở + phần quán thiếu, dư giữ dạng nhân sạch.
- Chia vùng chăm khi có 2 thợ (mỗi người một ruộng, 1 ruộng thì chia đôi theo cột); nhường nhau ở lối hẹp; bị người (thợ khác hoặc người chơi) chặn quá 0,8–1,5 giây thì đi xuyên người tạm thời (không xuyên tường/rào).
- Hồ sơ: Đào tạo (lên cấp, +2 mỗi chỉ số, tối đa cấp 10) / Thiết lập (Làm việc, Tự gia hạn, nhóm việc Chăm cây & thu hoạch, Chế biến, Vận chuyển, Cho nghỉ việc).
- Save cũ: người đang dự bị được đưa vào farm nếu còn chỗ; ai dư được hoàn phí tuyển. Năng lượng/nghỉ cũ được xóa.

### Robot vườn và sự cố của người (chốt 03/11/2026, chưa triển khai — spec [robot-staff.md](design/robot-staff.md))

- **Robot vườn dùng chung 2 chỗ thợ với người, tối đa 1 robot** (chốt vòng 2): farm là (người, người) hoặc (người, robot) hoặc (robot). Không phí tuyển, **15 xu/ngày công** cố định, gói trả trước 1/5/10 ngày công (**15/68/113 xu**, gói 5 rẻ 10%, gói 10 rẻ 25%), hết gói tự gia hạn 1 ngày giá lẻ; cho nghỉ không hoàn phần còn lại. Chỉ số cố định speed 70, dexterity 70 (chốt vòng 3): việc vặt nhanh hơn người cấp 1 ~5–6%, ngang người cấp 5, chậm hơn người cấp ≥ 6; không đào tạo, không sự cố. Số này chỉnh theo đo playtester (robot-staff mục 12). Chỉ **tưới, làm cỏ, chế biến, giao hàng**; không trồng, bón, tỉa, hái. Robot tính là thợ chính để nhận đơn quán.
- Modal Nhân viên có 2 tab **Robot / Người**.
- Người có thể gặp tối đa **1 sự cố mỗi ngày công**: **Mải chơi 📱** (~12%, đứng yên tối đa 40 s, chạm thợ → «Nhắc» để làm lại) và **Nghỉ ốm 🤒** (~4%, nghỉ trọn 1 ngày công, **không mất lương**: ngày đã trả được dời). «Thuê robot thay» chỉ hiện khi farm chưa có robot và còn chỗ trống. «Giao đội làm đơn» bỏ qua người đang ốm. Xác suất giảm theo cấp (`× max(0,4; 1 − 0,07 × (cấp − 1))`).
- Không có sự cố farm trong 2 ngày công đầu sau khi thuê, khi người chơi đang ở quán, hoặc khi uy tín quán < 30. **Riêng Nghỉ ốm** còn được miễn khi farm có **đúng 1 thợ** (người, không robot, không người thứ hai) và người đó đang giữ đơn quán mở; mải chơi vẫn xảy ra (chốt vòng 3). Gói thử robot **không** miễn sự cố farm (chỉ miễn cho nhân viên quán khi quán đang mở và robot gói còn trong ca). Không có tùy chọn tắt sự cố.
- **Không** khôi phục năng lượng, nghỉ giữa ca hay bồi dưỡng: nghỉ ốm là sự kiện hiếm, không phải nhu cầu hồi sức.

## 4. Đơn hàng cho quán

| Tab | Điều kiện vào | Hành động chính |
|---|---|---|
| Cần làm | Đơn mở, kho chưa đủ hạt rang | Chọn/đổi nhân viên phụ trách |
| Chờ chuyển | Đơn mở, kho đã đủ lượng yêu cầu | Chuyển từng đơn hoặc Chuyển hết |
| Đang chuyển | Hàng đã xuất kho, chưa tới quán | Xem % và giây còn lại |

- Đơn quán chỉ phát sinh khi farm đã có ít nhất một thợ chính, tối đa 2 đơn mở/đang chuyển; người chơi chưa thuê ai không nhận đơn.
- Mặc định mở Cần làm. Đơn gần hết hạn đứng trước; hiện thời gian còn lại và % thời hạn, gần hết hạn đổi màu.
- Đủ hàng sẵn trong kho thì tự vào Chờ chuyển, không bắt nhân viên sản xuất lại.
- Chuyển hết ưu tiên đơn gần hết hạn; kiểm tra lại hàng, xu, kho quán cho từng chuyến. Các đơn cùng loại dùng chung tồn kho, không coi mỗi thẻ là một phần hàng đã giữ riêng.
- Nếu chỉ chuyển được một phần danh sách, báo số đã chuyển và nguyên nhân còn lại. Không trừ hàng hoặc phí cho đơn bị từ chối.
- Hàng tới quán tự rời Đang chuyển và ghi vào Hoạt động.
- Chi tiết đơn gồm trạng thái, nhân viên, 5 bước chuẩn bị/giao, tiến độ chuyến khi có. Đủ hàng có một nút Chuyển về quán · 2 xu ở cuối.
- **Nhãn chốt (03/11/2026):** nút gửi hàng ở danh sách đơn và chi tiết đơn đều là «Chuyển về quán · 2 xu» (bỏ "Nhận hàng · 2 xu"). «Nhận hàng» chỉ dùng cho lấy mẻ xong ở trạm.
- Back quay về đúng danh sách/tab đã mở chi tiết. Đếm ngược cập nhật tại chỗ, không dựng lại toàn bộ danh sách mỗi frame.

## 5. Chế biến và nâng cấp công trình

### Công suất và thời gian hiện tại

| Trạm | Một phần nguyên liệu → đầu ra | Thời gian cơ sở/mẻ | Công suất đầu vào cấp 1 |
|---|---|---|---|
| Sân phơi | 600 g quả → 100 g nhân sạch | 30 giây | 18 kg |
| Lò rang | 100 g nhân sạch → 84 g hạt rang | 18 giây | 1 kg |

- Thời gian tính **theo mẻ**, không theo số phần. Chọn 1 hoặc 2 phần cùng nằm trong một mẻ có thể mất cùng thời gian.
- Mỗi trạm hiện chạy **1 mẻ một lúc**. Vượt sức chứa thì chia thành các mẻ nối tiếp.
- **Cấp tối đa 20** cho mọi hạng mục, riêng Thiết bị quán tối đa 10 (quán có 10 chỗ bàn). Lên cấp N cần nông trại cấp N.
- Tốc độ `1 + 0,07 × (cấp − 1)` (×2,33 ở cấp 20), công suất `1 + 0,18 × (cấp − 1)` (×4,42 ở cấp 20). Giá: cấp < 10 = `base × 1,42^(cấp−1)`; từ 10 = `base × 1,42^9 × (1 + 0,15 × (cấp − 10))²`.
- **Máy xay ở farm đã bỏ** (quán dùng hạt rang; bột chỉ hơn hạt rang ~3% giá). Bột còn trong kho vẫn bán được; mẻ xay đang chờ của save cũ được trả lại hạt rang.
- **Diện mạo theo bậc:** Cơ bản (1), Cải tiến (10), Chuyên nghiệp (20). Mỗi bậc là một slot riêng `farm/<id>/tier-<n>`; chỉ bậc hiện tại hiện. Bậc 2+ hiện là bản sao khối tạm kèm cờ màu, thay asset không đổi luật. Dấu bậc trên công trình hiện số bậc đã đạt.
- Hàng chờ tối đa 48 mẻ, hiện tính cả mẻ xong chưa nhận. Yêu cầu vượt chỗ trống thì xếp phần vừa và báo `Đã xếp x/y phần`, phần còn lại giữ trong kho (trước đây từ chối cả yêu cầu, làm kho nhân sạch kẹt vĩnh viễn). Bấm Bắt đầu nhiều lần tạo thêm mẻ; chưa gộp với mẻ chờ còn chỗ.
- Mẻ đã xếp giữ lịch/công suất đã tính lúc xếp; nâng cấp áp dụng cho yêu cầu mới.

### Giao diện trạm

- Bảng đầu hiện cấp, công suất hiện tại, cấp tiếp, giá và điều kiện nâng cấp. Kho/giếng/ao/quán cũng có nâng cấp ngay tại màn tương ứng.
- **Chế biến:** một ô mỗi loại cà phê; chọn số phần, thấy lượng vào → lượng ra và số mẻ; một nút Bắt đầu. Không còn cặp Làm 1/Xếp tất cả.
- Bắt đầu giữ modal mở, báo đã xếp chế biến. Không gọi mẻ chờ là đã chạy ngay.
- **Tiến độ & chờ nhận:** thanh %, giây trước khi bắt đầu hoặc giây còn lại; thứ tự Chờ → Đang làm → Chờ nhận. Màn đủ rộng 4 ô/hàng, màn nhỏ giảm cột.
- Nhận tất cả ở đầu; mỗi mẻ xong có nút Nhận riêng. Cả hai giữ modal mở.
- Mẻ chưa chạy được hủy, trả nguyên liệu; mẻ đang chạy không dùng nút hủy mẻ chờ.
- Kho đầy thì giữ thành phẩm tại trạm. Nhận tất cả có thể chỉ lấy các mẻ vừa chỗ, giữ phần còn lại.
- Chưa có mẻ: thông báo trống giữa vùng nội dung, không tạo thẻ hàng giả hoặc nút Chọn.
- Tương tác trạm tách rõ: bấm thân công trình mở modal; bấm giỏ thành phẩm nhận các mẻ đã xong vừa kho, đi tới điểm thao tác trước nếu đang xa. Nhận hết ẩn giỏ, không tự bật modal.
- Bấm đúng hình nhân viên mới mở hồ sơ và sáng viền; bảng trạng thái/đạo cụ nổi không được trở thành vùng mở hồ sơ.
- Trên map, mỗi trạm chỉ một dấu trạng thái: ưu tiên số mẻ đã xong; nếu đang làm, hiện đếm ngược và số mẻ chờ. Không trải hàng loạt icon trên mái công trình.

## 6. Kho, mua và bán

- Kho tính theo tổng gram của các lô, không theo số ô icon. Lô có chất lượng, nguồn và thời gian; hàng farm, đang chuyển và kho quán là ba vị trí khác nhau.
- Kho thiếu chỗ thì không mất hàng. Có thể bán bớt, chuyển về quán hoặc nâng cấp kho để giải phóng chỗ.
- Túi có Tất cả / Hạt giống / Nông sản; Vật tư chỉ hiện khi thực sự có vật tư. Hạt giống trong túi chỉ xem, không có nút Dùng giống; trồng từ ô đất/dải công cụ.
- Cửa hàng tách Cây giống / Vật tư / Chợ. Mua giống/phân chọn số lượng và tổng giá. Phân bón 1 xu/túi (`FERTILIZER_PRICE`): cây được bón cho hệ số 1,1, không bón 0,9 (+22%) và +5 chất lượng. Đo bằng `scripts/balance-sim.mjs`: bón sớm làm chậm mua ruộng (60 phút: kém ~430 xu giá trị), về sau có lời (120 phút: hơn ~320 xu, cao hơn 1 cấp) — lựa chọn có đánh đổi, không bên nào áp đảo.
- Giữ hạt rang cho quán mặc định tắt với save mới; bật trong màn quán khi cần.
- Bán tự do hiện lượng đang có, chọn số gram và khách trả bao nhiêu. Giá theo chất lượng các lô xuất trước. Giữ hạt cho quán có thể chặn bán hạt rang.
- **Chợ mua nhiều thì giá giảm** (mỗi ngày công 6 phút, `MARKET_DAILY = 1200` xu giá gốc trong `rules.js`): giá giảm tuyến tính từ 100% tới sàn 30% khi đã bán 840 xu giá gốc trong ngày công (2 ruộng bán gần đủ giá, 4 ruộng bão hòa và cần quán/nâng cấp); sang ngày công mới hồi lại. Lượng đã bán lưu trong save (`market`), tải lại không hồi giá. Tính theo tích phân nên bán một lần hay chia nhỏ đều nhận như nhau. Ô bán hiện giá gốc khi đang bị giảm. Hạt dư mang sang quán lời hơn.
- Bán tự do cho XP = ⌊xu nhận / 2⌋ (không còn +2 XP mỗi lần bấm).
- Đơn mua cố định ở Chợ có lượng và thưởng cố định; khác với bán tự do tùy lượng.
- Chỉ nút Mua/Bán mới mở giao dịch; bấm box không mua/bán.
- Mua và bán đều có modal xác nhận món, lượng, số xu. Xác nhận mới trừ/cộng; Hủy không giao dịch. Kiểm tra lại điều kiện lúc thực hiện.
- Mọi ô nhập số lượng hiện giới hạn **1–99**; nếu hàng/nguyên liệu/sức chứa hàng chờ hoặc xu không đủ thì hạ giới hạn. Đạt tối đa thì khóa +. Bán tự do dùng **gram**, không giới hạn 99 (tối đa bằng lượng đang có, mặc định bán hết); chế biến dùng **phần nguyên liệu**, không phải 99 mẻ.
- Không giới hạn 99 cho các đơn cố định, tổng hàng tồn hoặc lượng một mẻ được nhận. Nhận một mẻ lấy cả đầu ra mẻ.

## 7. Mục tiêu (một hệ duy nhất)

- **Nhiệm vụ cá nhân chu kỳ 6 phút đã bỏ** (trùng với chuỗi mục tiêu); nút Nhiệm vụ ở menu dưới bỏ cùng. Thưởng là nhiệm vụ cố định một lần, chỉ tính thao tác của người chơi.
- **Thứ tự nhiệm vụ đầu game (đổi và triển khai 03/11/2026):** Hái → **Bán ly cà phê đầu tiên** (`stats.served`, quán đã có 600 g hạt `starter`) → Phơi → Rang → Bán → **Gửi hạt rang về quán** (`stats.delivered`) → Mua ruộng 2 → Tưới → Làm cỏ. Bán ly lên vị trí 2 để phản hồi rót đúng vạch/tiền nhảy tới trước phút thứ 2; liên kết farm → quán vẫn dạy ở Gửi hạt. Bấm thẻ Gửi hạt: thiếu 252 g thì dẫn tới lò rang/sân phơi, đủ thì đặt đơn 252 g (nếu chưa có) và mở danh sách đơn để bấm «Chuyển về quán · 2 xu»; thẻ Bán ly mở quán. Tưới/làm cỏ để cuối vì cây vừa hái khoảng 6–8 phút sau mới khát. Chữ nhiệm vụ trích đúng nhãn nút; bảng chữ ở [onboarding-flow.md](design/onboarding-flow.md) mục 3.4. Save cũ giữ `claimed`, không trả/xóa thưởng.
- **Bấm thẻ mục tiêu** (HUD trái, có dấu ›) để nhân vật tự đi tới đúng chỗ: cây cần hái/tưới/làm cỏ, sân phơi/lò rang (có mẻ xong thì nhận luôn), biển ruộng kế tiếp; nhiệm vụ Bán mở Cửa hàng → Chợ. Chưa có việc để làm thì báo còn bao lâu và gợi ý việc khác trong lúc chờ. **Lần đầu:** thẻ nhấp nháy, có dòng "👆 Chạm/Bấm để được dẫn đường" và mũi chỉ 3D trên mục tiêu; tắt khi chạm thẻ lần đầu hoặc nhận nhiệm vụ Rang.

## 8. Quy tắc UI/UX chung

- Đây là game 3D: tương tác công trình/ô đất, HUD nhỏ; không dùng dashboard phủ map thay gameplay.
- Font ưu tiên Baloo 2, Fredoka, system-ui, sans-serif; hỗ trợ tiếng Việt. Font đang tải từ Google Fonts, có fallback.
- Khung gỗ, bảng kem, biển tiêu đề xanh nổi giữa mép trên, nút đóng tròn ngoài góc. Một kiểu nút xanh cho thao tác chính; xu dùng đồng vàng thống nhất.
- Modal khóa di chuyển; giữ kích thước ổn định giữa tab, nội dung dài cuộn bên trong, padding đều. Tab căn trái; túi và cài đặt ôm chữ/xuống dòng thay vì cuộn ngang.
- HUD trái: avatar/tên/cấp/XP → thẻ mục tiêu → Cần xử lý → Hoạt động. Bấm avatar/tên đưa camera về nhân vật, không có nút Về nhân vật riêng.
- Phải: ô xu (bấm mở Cửa hàng), rồi cụm Cài đặt · Vào quán · Hướng dẫn. **Chỉ một nút Cài đặt.** Lượng nước nằm trong công cụ Tưới và màn Giếng nước.
- **HUD mở dần (chốt và triển khai 03/11/2026):** lúc mới vào chỉ có avatar/XP, thẻ mục tiêu, xu, Kho, Cài đặt, Hướng dẫn. Vào quán, Cửa hàng, Đơn hàng, Nâng cấp, Nhân viên (Quản lý thành tab "Chỉ thị" bên trong), Xây dựng, dải công cụ mở theo mốc nhiệm vụ/cấp/state ở [onboarding-flow.md](design/onboarding-flow.md) mục 3.3; save cũ đã qua mốc thấy đủ ngay, không toast. Menu dưới tối đa 6 nút (Kho, Cửa hàng, Nâng cấp, Nhân viên, Đơn hàng, Xây dựng), không cuộn ngang, nút thu gọn chỉ khi ≥ 4 nút. Bỏ nút Thu mua (đã ẩn) và nút Thế giới (chưa có tính năng). Cần xử lý và Hoạt động **gập sẵn trên mọi màn**, tiêu đề hiện số mục; Cần xử lý chỉ hiện khi có mục, Hoạt động hiện khi đã mở Nhân viên.
- Gợi ý điều khiển lần đầu ở farm theo thiết bị (PC: bấm đất đi, WASD, cuộn zoom, kéo xoay; cảm ứng: joystick, chạm cây, kéo xoay); tắt sau khi đã đi + làm một việc, 15 s hoặc ×; không hiện lại.
- Đơn chờ phân công và nhiệm vụ có thưởng chưa nhận có chấm báo trên icon.
- Cần xử lý chỉ liệt kê việc cần can thiệp: lương, phân công, đủ hàng chưa chuyển, hạn đơn, vật tư, kho, mẻ cần đảo/nhận, cây cần chăm và vấn đề quán. Đã bỏ cảnh báo Cây chín chưa thu hoạch/Mở công cụ.
- Hoạt động có việc phát sinh/không còn vướng, diễn biến nhân viên, nhận hàng tại quán và các sự kiện vận hành.
- Thông báo ngắn ở giữa phía trên, nền mờ, hiện đủ nội dung, tự mất sau 3 giây, không chặn thao tác. Hoàn thành nhiệm vụ cố định (🎯) và lên cấp (⭐) đứng đầu thông báo.
- HUD trái hiện một khung mục tiêu nhỏ: nhiệm vụ cố định kế tiếp và cách làm.
- Ô số lượng chế biến mặc định bằng mức tối đa đủ nguyên liệu (≤ 99); gõ số không bị ghi đè giữa chừng. Nút Đến lấy hàng ở Cần xử lý đi tới trạm và nhận luôn các mẻ xong.
- Esc khi đang mở hộp xác nhận chỉ đóng hộp đó, không đóng modal bên dưới. Modal xác nhận chỉ dùng khi cần quyết định thật.
- Không hiện xu/cấp người chơi mặc định ở footer mọi modal. Hồ sơ nhân viên đưa lương/ngày làm/ngày trả lên đầu.
- Trạng thái kéo thợ giữ đầy đủ hình box, ô nhận sáng viền, đổi thành công có hiệu ứng và tên người vào/ra. Không dùng chỉ tên làm hình kéo.

### Xây dựng trang trí — phạm vi đã chốt

- Giai đoạn đầu chỉ xây **bồn hoa (25 xu), đèn vườn (40 xu), biển tên (30 xu)**. Giá hiện là cấu hình khởi điểm để người chơi thử.
- Menu Xây dựng mở danh sách; chọn món chuyển về map với bóng đặt xanh/đỏ, xoay bằng nút/R, hủy bằng nút/Esc.
- Bấm mặt đất để chốt vị trí; sau khi chốt, rê chuột sang nút không làm bóng đặt chạy theo. Bấm mặt đất khác để đổi. Chọn vị trí rồi xác nhận mua mới trừ xu và lưu. Không đặt trên ruộng, đường, sát công trình, ngoài farm hoặc chồng đồ trang trí. Vị trí có người chơi/vật cản cũng bị từ chối trong luồng đặt.
- Biển tên cho nhập tối đa 24 ký tự. Đồ giữ vị trí, góc xoay và nội dung khi lưu/tải.
- Đây là trang trí không cộng năng suất, không tăng số thợ, không mở chế biến song song. Xác nhận đặt sẽ trừ phí và tạo khung thi công; nhân vật của người chơi chạy tới, thao tác xây 5 giây (hoa/biển) hoặc 6 giây (đèn). Chỉ cộng tiến độ lúc đứng gần và đang thi công; ngắt việc có thể bấm công trình để tiếp tục.
- Bấm đồ trang trí mở quản lý: tiếp tục thi công nếu chưa xong, hoặc phá dỡ. Phá dỡ có xác nhận, nhân vật chạy tới tháo trong 3,5 giây; không hoàn xu. Chưa có di chuyển đồ đã đặt.
- Có giới hạn 100 món để giữ map gọn và tránh quá nhiều mô hình. Đồ hoàn thiện là vật cản: cả người chơi và nhân viên không đi xuyên. Hệ thống va chạm cập nhật khi xây xong, tải lại hoặc phá dỡ. Vẫn loại đường/điểm tương tác khỏi vùng đặt.

## 9. Lưu tiến độ và giới hạn kiểm chứng

- Save mới bắt đầu với 200 xu. Save đã có giữ nguyên số xu (không cấp lại hoặc cắt vốn thử 100 triệu cũ).
- Quà thiên đàng áp dụng một lần (cờ `giftApplied`): Túi hạt giống +6 hạt vối và 6 phân; **Gói mở rộng quán** (tên cũ "Bộ dụng cụ pha", id `tools`) nâng quán (`upgrades.cafe`) lên cấp 2, tức 4 bàn thay vì 3; Túi vốn nhỏ +150 xu. Thẻ chọn quà phải ghi đúng các số này.
- **Mẹo thiên đàng (chốt và triển khai 03/11/2026):** mỗi câu đúng ở thiên đàng cho một mẹo có tác dụng ở farm/quán (hái tay +5 chất lượng; bình tưới +2; Phin đen/Sữa đá bắt đầu ★; gợi ý "Sửa bước này trước"; +30 xu; uy tín quán +3). Câu sai được hỏi lại ở farm/quán, tối đa 1 câu mỗi ngày công, hoặc ôn ở Sổ tay trong Hướng dẫn. Thưởng một lần không lặp khi chơi lại chương. Lưu ở `farm.lessons` (xem [contracts.md](design/contracts.md) mục 5, [onboarding-flow.md](design/onboarding-flow.md) mục 3.1, 4.1).
- Giữ schema tiến độ hiện có; không tự reset kho, tiền, ruộng hay mẻ cũ khi chỉnh UI.
- Khách, hàng, lương và thao tác phải qua luật model; không trừ tiền chỉ bởi hover, chọn tab hoặc mở xác nhận.
- Thiết lập ẩn/hiện HUD hiện áp dụng trong lượt chơi; chưa chốt lưu các tùy chọn này qua lần mở game.
- Thay luật tính nhiệm vụ không có nghĩa đã tính lại tiến độ nhiệm vụ cũ trong save.
- Một số kiểm tra né người đã chạy ở giai đoạn sửa thuật toán; không suy ra toàn bộ UI và các thay đổi tiếp theo đã được test.
- Mặc định người dùng tự kiểm tra. Không tự chạy test/build/lint/preview trừ khi có yêu cầu rõ cho lượt đó.

## 10. Những điểm cần cùng chốt tiếp

Đề xuất mở rộng: [Gameplay xây dựng](design/farm-build-gameplay.md). Hiện chỉ chốt và triển khai phần hoa, đèn, biển tên; các công trình sản xuất phụ vẫn là đề xuất.

Các mục dưới đây **chưa phải luật đã triển khai/chấp thuận**:

1. **Gộp mẻ:** có gộp lần bấm mới vào mẻ chờ cùng loại còn chỗ hay không; tuyệt đối không sửa lượng mẻ đang chạy nếu chưa chốt.
2. **Chạy song song:** nâng cấp có mở 2/3/... mẻ cùng lúc không, cấp nào mở, khác gì với kg/mẻ. Hiện vẫn 1 mẻ/trạm.
3. **Giới hạn chờ:** giữ 48 hay giảm; có tính mẻ đã xong chưa nhận vào giới hạn không.
4. ~~**Đơn vị bán:**~~ Đã chốt 03/11/2026: bỏ giới hạn 99 g khi bán, mặc định bán hết.
5. ~~**Nợ lương khi xóa:**~~ Hết hiệu lực (03/11/2026: lương theo ngày công, cho nghỉ việc không hoàn). hiện kiểm tra ca đã trả còn hiệu lực, chưa có sổ nợ riêng. Cần quyết định xóa dự bị là trả một ca hay thanh toán số công chưa trả, và ca hết hạn khi dự bị có thực sự là nợ không.
6. ~~**Nghỉ tự động:**~~ Đã bỏ năng lượng/nghỉ/bồi dưỡng (03/11/2026). vẫn có năng lượng/nghỉ tự động và nút bồi dưỡng (đồng vàng trên đầu thợ, mục 3); cần cân bằng thời gian chờ và làm rõ người đang nghỉ không phải lỗi đứng yên.
7. **Dữ liệu cũ:** có chuyển lại nhiệm vụ đã được nhân viên làm trước đây, vai trò/giống cũ, ứng viên đã từ chối hay không. Chưa tự xóa/khôi phục dữ liệu.
8. **Cân bằng kinh tế:** giá, sản lượng, thời gian vụ, sức chứa kho và số đơn cần playtest; không lấy tiền thử nghiệm lớn làm bằng chứng cân bằng.

## 11. Nguồn đối chiếu khi sửa

- `src/features/farm/content.js`: cây, công trình, chuyển đổi đầu vào/đầu ra.
- `src/features/farm/rules.js`: cấp, lương, giá nâng cấp, công suất, tốc độ.
- `src/features/farm/model.js`: luật giao dịch, nhiệm vụ, mẻ, vận chuyển, nhân sự.
- `src/features/farm/crew.js`, `worker-planner.js`: nhận việc và thực hiện đơn của thợ.
- `src/features/farm/game.js`: kết nối hành động, màn/tab và phản hồi.
- `src/features/farm/ui.js`, `src/ui/styles/farm.css`: trình bày và tương tác UI.
- [Lịch sử luật cũ](design/farm-operations-history.md): chỉ đối chiếu, không dùng ghi đè bản này.
- [Bản đề xuất ban đầu](design/farm-cafe-gameplay-plan.md): ý tưởng cũ, các phần mâu thuẫn đã được thay thế.

## Nhật ký quyết định

- **03/11/2026 (robot vs nhân viên, vòng 3):** Soát vòng 3 thấy hai chỗ áp đảo ở farm; người dùng chốt. (1) **Miễn trừ "thợ người duy nhất giữ đơn" chỉ áp khi farm có đúng 1 thợ (không robot, không người thứ hai) và chỉ miễn Nghỉ ốm; Mải chơi vẫn xảy ra.** Lý do: farm luôn có 2 đơn mở, nên luật cũ cho (người, robot) và (người, người) chia mỗi người một đơn né gần hết sự cố farm; giữ miễn ốm cho farm một người vì ốm là sự cố duy nhất làm đứt chuỗi đơn cả ngày công. (2) **Robot vườn speed 20 → 70, dexterity 40 → 70** — đảo câu "chậm hơn người ~20%" đã chốt ở vòng 1 (chỉ cho Robot vườn; robot quán vẫn chậm hơn ~20%). Lý do: robot chậm + chỉ làm tập con việc người + chênh lương nhỏ hơn giá trị tay hái → người thứ hai luôn hơn; nay robot làm việc vặt nhanh hơn người cấp 1 ~5–6% nhưng vẫn không trồng/bón/tỉa/hái, thành đánh đổi theo quy mô farm. Chỉ số/lương robot chỉnh theo số đo playtester (ngưỡng ở robot-staff mục 12) vì `balance-sim.mjs` chưa có mô hình thợ; không chặn triển khai.

- **03/11/2026 (robot vs nhân viên, vòng 2):** Người dùng chốt thêm 3 điểm. (1) **Robot vườn dùng chung 2 chỗ thợ với người, tối đa 1 robot** — đảo câu "1 chỗ robot riêng" đã chốt ở mục ngay dưới. Lý do: `/balance-check` thấy chỗ riêng là chiến lược áp đảo (lương 15 xu/ngày công chỉ 1,3–2,2% thu mỗi vòng, ai cũng thuê, không phải chọn); dùng chung biến robot thành đánh đổi thật (rẻ, không sự cố nhưng mất một tay hái). Bớt được việc sửa mọi chỗ đếm "2 thợ" trong code. (2) **Gói trả trước chỉ cho Robot vườn**, chiết khấu sâu: 1/5/10 ngày công = 15/68/113 xu (gói 5 −10%, gói 10 −25%); robot quán thuê theo ca như người (3 xu/ca), không có gói. Lý do: gói ở quán chỉ tiết kiệm vài xu, thêm lựa chọn mà không thêm quyết định; ở farm gói lớn là cam kết giữ 1 trong 2 chỗ. (3) **Ly robot không làm mất combo** của người chơi. Kèm: gói tặng bù 500 ml sữa đặc và 1.500 g đá; dòng quà gộp vào toast mở khóa Nhân viên; «Giao đội làm đơn» bỏ qua người ốm.

- **03/11/2026 (robot vs nhân viên, spec [robot-staff.md](design/robot-staff.md), chưa triển khai):** Người dùng duyệt hệ thuê robot bên cạnh người. **Đảo một phần quyết định "cắt 6 mục" cùng ngày:** quyết định đó bỏ năng lượng/nghỉ/bồi dưỡng; nay thêm lại **nghỉ ốm hiếm** (~4%/ngày công, không mất lương) và mải chơi (~12%, tối đa 40 s, «Nhắc»). Lý do: robot rẻ hơn chỉ có nghĩa khi người có cái giá phải trông; không có sự cố thì người luôn hơn robot ở mọi mặt trừ lương. Vẫn không có năng lượng/nghỉ giữa ca/bồi dưỡng. Không cho tắt sự cố trong Cài đặt. ~~Farm thêm 1 chỗ robot riêng (ngoài 2 chỗ người)~~ (đã thay bằng mục vòng 2 bên dưới), robot là thợ chính. Quán: robot chỉ bưng/dọn, kiosk và máy espresso tự động đổi tên thành robot thu ngân/robot pha espresso; robot pha chỉ có trong gói thử một lần. Trường save mới: [contracts.md](design/contracts.md) mục 6.

- **03/11/2026 (chốt 3 điểm còn treo của luồng người chơi mới):** (1) Quà thiên đàng "Bộ dụng cụ pha" đổi tên thành **"Gói mở rộng quán"**, tác dụng giữ nguyên (quán cấp 2, 4 bàn), id `tools` không đổi nên save cũ không cần chuyển; lý do: tên cũ hứa dụng cụ pha nhưng tác dụng thật là thêm bàn. (2) Nút **Quản lý gộp thành tab "Chỉ thị" trong Nhân viên**, menu dưới tối đa 6 nút, không cuộn ngang trên màn 360 px. (3) Giữ mức mẹo thiên đàng **+30 xu, +3 uy tín quán, ★ khởi đầu ở điểm 40** (không đủ ngưỡng barista ≥ 53, không vượt ngưỡng món 55). Kèm hai điều đã xác minh trong code: farm chưa có pinch zoom (gợi ý điều khiển không nhắc, không thêm tính năng); nút Cài đặt trùng có thật (`#game-settings-toggle` chung + nút Cài đặt farm) → trong farm chỉ giữ nút Cài đặt farm.

- **03/11/2026 (luồng người chơi mới, spec [onboarding-flow.md](design/onboarding-flow.md), đã triển khai 03/11/2026):** Người chơi thật nói "chả hiểu gì", thao tác khó. Người dùng chốt **thiên đàng là bài học**, không phải câu chuyện có thể bỏ qua: giữ 3 chuyên gia × 2 câu, nhưng câu đúng cho mẹo có số thật ở farm/quán, câu sai được hỏi lại sau (lý do: điểm đúng/sai trước đây không tác dụng gì, nên 2–3 phút thiên đàng là thời gian chết; giữ lại để dạy kiến thức thật, trụ cột 4). Thoại thiên đàng 32 → 23 hộp, gợi ý điều khiển ngay khi vào. Các luật đã chốt bị thay: (1) thứ tự nhiệm vụ — Bán ly đầu lên vị trí 2 (trước là 6) vì quán có sẵn 600 g hạt; (2) HUD mục 8 — mở dần theo mốc, Quản lý gộp vào Nhân viên, bỏ Thu mua/Thế giới, một nút Cài đặt, bảng Cần xử lý/Hoạt động gập sẵn cả desktop (trước: mở sẵn trên desktop); (3) mục 2 — dải công cụ chỉ mở từ ruộng 2, trước đó chạm cây = Tự chọn; (4) nhãn gửi hàng chốt «Chuyển về quán · 2 xu», bỏ "Nhận hàng · 2 xu". Gợi ý hội thoại hiện "Chạm để tiếp" trên cảm ứng. Hướng dẫn trong game phải viết lại theo luật 03/11 (còn nói đội dự bị, hợp đồng tuần, nghỉ giữa ca, máy xay farm). Trường save mới `farm.lessons`, `farm.tutorial` (contracts mục 5).

- **03/11/2026 (cắt 6 mục để tập trung):** Người dùng chốt bỏ: (1) cá ở ao — ao chỉ còn là hồ nước cho giếng, cá cũ bán 8 xu/con; (2) máy xay ở farm và nhiệm vụ Xay — mẻ chờ trả hạt rang; (3) uy tín farm (chỉ số không tác dụng); (4) cấp tới 999 và 5 bậc → tối đa 20, 3 bậc (1/10/20), cấp cũ > 20 về 20; (5) nhiệm vụ cá nhân 6 phút và nút Nhiệm vụ; (6) hợp đồng tuần/tháng, năng lượng, nghỉ, bồi dưỡng, đội dự bị và kéo thả → thuê tối đa 2 thợ vào thẳng farm, lương theo ngày công, cho nghỉ việc bằng nút; người dư trong save cũ được hoàn phí tuyển. Bỏ luôn nâng cấp Phúc lợi nhân viên. Test chuyển save cũ: `tests/farm-gameplay.test.js` "saves from before the 03/11 cuts".

- **03/11/2026 (hành trình người chơi):** `/design-review flow` phát hiện không nhiệm vụ nào dẫn sang quán (báo cáo ban đầu nói quán không có hạt là sai: save mới đã có lô 600 g `starter` trong quán). Thêm nhiệm vụ Gửi hạt/Bán ly đầu và gợi ý quán "Quán chưa có hạt rang · Về farm gửi hạt hoặc Nhập hạt ngoài" khi kho quán dưới 10 g.

- **03/11/2026 (trải nghiệm 5 phút đầu):** Chơi thử như người mới phát hiện nhiệm vụ 2 "Tưới" bị chặn ~6,5 phút (cây vừa hái còn 68% nước) và nhiệm vụ trạm không chỉ đường trên điện thoại. Sắp lại thứ tự nhiệm vụ, thẻ mục tiêu bấm được để tự đi tới, sửa mô tả bán (quầy thu mua đang ẩn → Cửa hàng → Chợ).

- **03/11/2026 (cân bằng đo bằng mô phỏng):** `scripts/balance-sim.mjs` chạy chính `model.js` với người chơi mẫu (6 phút farm / ca quán 4 phút, tự mua ruộng và nâng cấp). Phát hiện và sửa: (1) phân bón bị áp đảo bởi "không bón" → 1 xu, hiệu quả +22%; (2) chợ bão hòa từ 2 ruộng khiến ruộng 3–4 gần vô giá trị → `MARKET_DAILY` 1200; (3) lệnh chế biến vượt hàng chờ bị từ chối cả gói làm kho nhân sạch kẹt (93.536 lần hái bị chặn trong 120 phút) → xếp phần vừa. Kết quả 120 phút: cấp 17–18, thu chợ ~9–10 nghìn xu, quán + thưởng ca ~1,5 nghìn, 54 mốc mở khóa, quãng trống dài nhất 6 phút.

- **03/11/2026 (thiết kế + mobile):** Chốt 2 điểm treo: hợp đồng tạm dừng khi vắng mặt; lương nhân viên quán theo ca 4 phút. Phân bón 8 → 4 xu, hạt nhập 50 → 75 xu/500 g, thêm món Phin cà phê mít (uy tín 55) cho cây mít. Mobile first: mức đồ họa mặc định theo thiết bị (máy yếu Thấp, cảm ứng Vừa, còn lại Cao), tự hạ một bậc trong lượt chơi khi dưới ~25 fps kéo dài (không lưu, không hạ nếu người chơi đã tự chọn; bỏ qua khung do trình duyệt kìm), gộp mesh cùng màu trên mỗi luống, điện thoại gập sẵn bảng Hoạt động/Cần xử lý và ẩn thẻ Hôm nay, bỏ MSAA trên điện thoại màn dày, giảm vẽ lại huy hiệu cây, bỏ deep clone mỗi khung hình.

- **03/11/2026 (soát tài liệu):** Mục 1 sửa theo chỉ thị nông trại (thợ làm cả khi không có đơn). Bồi dưỡng thợ **vẫn còn** theo code (`workers/overtime`, bấm đồng vàng trên đầu thợ mệt, nửa giá ngày lương); câu "bỏ bồi dưỡng" ở mục nhân viên bước 2 bên dưới đã bị thay thế.

- **03/11/2026 (cân bằng 2):** Chợ hồi giá theo ngày công 6 phút (`MARKET_DAILY` 600) thay vì mỗi phút, để bán vặt mỗi phút không lời hơn bán dồn. Quán chưa có barista đang làm hoặc máy espresso tự động thì khách tới chậm thêm 4 giây, tránh người chơi tự pha bị quá tải rồi tụt uy tín.

- **03/11/2026 (cân bằng):** Theo `/balance-check`: lương nhân viên quán trả theo ngày công 6 phút (`WORK_DAY_MS`) thay vì 60 giây (sau đó đổi sang ca 4 phút, xem mục "thiết kế + mobile"), vì đủ đội từng tốn 44 xu/phút > doanh thu quán; bán chợ bỏ giới hạn 99 g, XP theo xu nhận để chặn cày XP bằng bán 1 g; chợ giảm giá dần theo lượng bán trong ngày và khách quán tới nhanh gấp khoảng 2 lần để hạt farm có lý do sang quán (trụ cột hai màn phụ thuộc nhau).

- **02/11/2026:** Nâng cấp tới cấp 999 với đường cong giảm dần sau cấp 10; cấp nông trại tới 999; 5 bậc diện mạo có slot asset riêng.

- **02/11/2026 (nhân viên bước 2):** Hợp đồng Ngày/Tuần/Tháng trả trước, tự gia hạn, hết hạn dừng an toàn, bỏ bồi dưỡng, nghỉ giữa ca tự động.

- **02/11/2026 (nhân viên bước 1):** Chỉ thị nông trại; thợ làm việc không cần đơn; chế biến theo tồn mục tiêu; ưu tiên theo độ khẩn và quãng đường; mang đầy bình. Xem [đề xuất](design/farm-staff-ai.md).

- **02/11/2026 (đợt sửa 3):** Hiện lại khung mục tiêu; thông báo nhiệm vụ/lên cấp; thông báo đủ câu; chế biến mặc định tối đa, sửa ô nhập số; Đến lấy hàng nhận luôn; Esc không đóng modal cha.

- **02/11/2026 (đợt sửa 1):** Bỏ vốn thử cho save mới (200 xu); quà thiên đàng có tác dụng; nhiệm vụ cá nhân chu kỳ 6 phút, không trùng, không mất thưởng; đơn quán chỉ sinh khi có thợ chính, tối đa 2; tắt giữ hạt mặc định; việc của thợ không cộng nhiệm vụ cố định.

- **02/11/2026:** Tách nhiệm vụ cá nhân, đơn quán và Chợ; đội nhiều người/2 thợ chính; kéo đổi đội; hồ sơ/đào tạo/thiết lập và lương; xác nhận giao dịch; chọn lượng tối đa 99; ba tab đơn; tiến độ/nhận mẻ riêng hoặc tất cả; nâng cấp tại công trình; HUD, đồng vàng, modal và thông báo thống nhất. Ghi nhận chưa thay luật chạy mẻ tuần tự.
