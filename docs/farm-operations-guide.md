# Luật gameplay hiện hành — Nông trại và quán cà phê

Cập nhật ngày 02/11/2026, theo các quyết định của người dùng trong đợt chỉnh gameplay và UI. Đây là tài liệu chính để cùng sửa tiếp. Khi yêu cầu mới thay luật, sửa trực tiếp mục tương ứng và ghi vào nhật ký cuối trang; không nối thêm một bản luật trái ngược ở cuối.

Tài liệu ghi nhận quyết định và cách code đang thực hiện, chưa có nghĩa mọi luồng đã được kiểm chứng trong game. Lượt cập nhật tài liệu này không chạy test/build/preview. Các điểm chưa chốt nằm ở mục 10.

## 1. Vòng chơi và ba luồng tách biệt

Người chơi trồng/chăm/hái cà phê → phơi và tách vỏ → rang → chuyển nguyên liệu sang quán → pha bán. Có thể xay hạt thành bột. Cây là cây lâu năm, thu hoạch không xóa cây.

| Luồng | Ai làm | Kết quả | Nơi mở |
|---|---|---|---|
| Nhiệm vụ cá nhân | Người chơi tự thao tác | Hoàn thành rồi nhận thưởng một lần | Nhiệm vụ |
| Đơn tiếp hàng cho quán | Nhân viên được phân công chuẩn bị; chủ chủ động gửi hoặc yêu cầu giao | Hàng rời kho farm, vận chuyển, vào kho quán | Đơn hàng |
| Bán lấy xu | Người chơi quyết định hàng và lượng bán | Trừ hàng, cộng xu | Cửa hàng → Chợ; hoặc Túi đồ |

- Việc nhân viên làm không tăng tiến độ nhiệm vụ cá nhân.
- Nhân viên chỉ xử lý nhu cầu đơn của quán được giao, không tự làm nhiệm vụ cá nhân hoặc đơn bán ở Chợ.
- Chuyển hàng nội bộ không sinh tiền. Mỗi chuyến đơn quán tốn 2 xu; quán kiếm doanh thu khi phục vụ khách.
- Quán là scene riêng. Farm tiếp tục cập nhật khi chủ sang quán. Không coi việc đóng game là nhân viên tự vận hành đầy đủ.

## 2. Đất, cây và thao tác trên bản đồ

- Farm có 4 ruộng, mỗi ruộng 12 ô, tổng 48 ô. Chỉ mua ruộng liền kề đủ điều kiện.
- Bấm ô/biển đất khóa: nhân vật tới biển trước; đủ tiền và liền kề mới mở xác nhận. Thiếu tiền báo số xu thiếu. Chỉ trừ khi xác nhận mua.
- Bấm ô trồng: sáng viền đúng ô, nhân vật tới gần. Chọn giống bằng dải icon nhỏ phía dưới, không làm tối bản đồ; có thể đổi ô ngay.
- Dải công cụ hỗ trợ chọn/kéo trên các ô hợp lệ. Giới hạn theo vật tư; không trừ nhiều lần trên cùng ô.
- Tưới, cỏ, phân, tỉa có điều kiện theo trạng thái cây. Phân không phải điều kiện bắt buộc để cây lớn.
- Hái một lượt sản lượng chín; giữ cây và chuyển sang chu kỳ tiếp theo. Nhịp vụ trưởng thành cơ sở là 6 phút game, không dùng đoạn mô tả cũ “hái phần dư” làm luật.
- Thông số chăm chi tiết lấy từ `src/features/farm/content.js` và `rules.js`; đây là mô phỏng game, không phải hướng dẫn canh tác thực tế.

## 3. Nhân viên: thợ chính, dự bị, lương

### Tuyển và bố trí

- Có thể thuê nhiều người trong danh sách ứng viên hiện có; chỉ tối đa **2 thợ chính tại farm**. Chưa có cơ chế sinh vô hạn ứng viên.
- Người mới thuê vào dự bị. Phí tuyển và lương ca là hai khoản khác nhau.
- Màn Nhân viên có hai tab: **Farm hiện tại (số đã thuê)** và **Tuyển dụng (số ứng viên)**. Menu dưới hiện tổng số người đã thuê.
- Farm hiện tại chia hai ô thợ chính và khu dự bị. Các box cùng kích thước gọn, cấp góc trái, trạng thái góc phải.
- Kéo dự bị vào ô trống để bố trí; kéo vào thợ chính để đổi người; kéo thợ chính xuống dự bị để rút ra.
- Khi thay người, đơn mở do người cũ phụ trách được chuyển sang người mới. Giải phóng quyền giữ việc/vật tư của người rút ra; không nhân bản hàng hay trừ phí tuyển lần nữa.
- Người chưa trả lương **vẫn được đưa lên thợ chính**. Hiện cảnh báo lương ở đầu; không được thực hiện công việc ngoài thời gian đã thanh toán. Nếu bật tự trả, có thể thanh toán khi nhận ca mới.

### Chỉ thị nông trại (Quản lý)

- Nút **Quản lý** ở menu dưới mở chỉ thị chung cho thợ chính: Tự chăm vườn, Trồng lấp ô trống (chọn giống), Dùng phân bón, Tự chế biến. Mặc định bật hết; lưu cùng tiến độ.
- Thợ làm theo chỉ thị **cả khi không có đơn quán**. Đơn quán vẫn được cộng điểm ưu tiên cho người phụ trách.
- Tự chế biến: phơi hết quả chín; chỉ rang tới tổng đơn đang mở + phần quán còn thiếu theo dự báo, dư giữ dạng nhân sạch. Không xay ở farm.
- Trồng lấp ô chỉ dùng đúng giống đã chọn; hết hạt thì báo, không tự đổi giống.
- Điểm ưu tiên tăng dần khi cây gần ngừng lớn vì thiếu nước/cỏ; thời gian đi bị tính nặng hơn để thợ đi theo luống, làm xong một việc là chọn ngay việc kế tiếp (ưu tiên việc tại chỗ).
- Thợ lấy nước đầy bình theo cấp giếng/bình, không còn giới hạn theo sức mạnh.

### Lương và trạng thái

- **Hợp đồng trả trước** thay cho ca 60 giây. **1 ngày làm việc = 6 phút** (một vụ cây); tuần = 7 ngày.
- Giá ngày D = `30 + 10 × (cấp − 1)` xu. Hợp đồng **tuần** = 6D cho 7 ngày (đã bỏ chọn gói Ngày/Tháng khỏi giao diện).
- Nút **Gia hạn · N xu** luôn hiện ở đầu hồ sơ, cạnh thời gian còn lại; ký thêm khi còn hạn sẽ **cộng dồn** từ ngày hết hạn hiện tại.
- **Tự gia hạn** (mặc định bật): khi còn dưới 30 giây và đang bố trí tại farm, tự ký gói đã chọn. Thiếu xu thì thử lại mỗi 10 giây và báo ở Cần xử lý. Người dự bị không tự gia hạn.
- Hết hợp đồng: thợ trả lại việc/vật tư đang giữ và dừng; không làm việc ngoài thời hạn đã trả.
- Chấm dứt sớm (xóa người dự bị) giải phóng vị trí, **không hoàn tiền** phần còn lại. Không còn điều kiện phải trả lương trước khi xóa.
- Nhận mẻ đã xong ưu tiên cao hơn hái. Khi có mẻ xong chờ nhận, thợ không hái nếu hái xong kho không còn chỗ cho mẻ đó. Bắt đầu mẻ mới chỉ tính mẻ chưa xong, nên kho đầy quả vẫn phơi tiếp được để giải phóng chỗ.
- Tìm đường cho thợ chừa thêm 4 cm ngoài bán kính (thợ không chọn khe sát rào chỉ dư ~2 cm); khi bước vướng góc thì trượt dọc mép như người chơi. Giả lập 2.000 lượt đi nối tiếp giữa 24 cây/giếng/trạm: 0 kẹt (code cũ kẹt 180). Ảnh lưới debug: `.claude/debug/farm-grid.jpg`.
- Vướng vật cản cố định: tìm đường lại từ chỗ đang đứng, quá 3 lần thì bỏ việc 4 giây; lỡ đứng lọt vào vật cản thì tự dời ra chỗ trống gần nhất.
- **Chia vùng chăm cây:** khi có từ 2 thợ đang làm được (đã bố trí, bật, còn hợp đồng, không nghỉ), mỗi thợ một ruộng (số ruộng nhiều hơn số thợ thì chia xen kẽ: 3 ruộng → thợ A ruộng 1+3, thợ B ruộng 2). Chỉ có 1 ruộng thì chia đôi theo cột: A 2 cột trái (6 ô), B 2 cột phải (6 ô). Trạm chế biến và giao hàng không chia vùng. Một người nghỉ hoặc hết hợp đồng thì người kia tạm lo cả farm.
- Hai thợ gặp nhau ở lối hẹp: người nhường bước sang bên; kẹt quá 0,8 giây thì được đi xuyên người kia 1,2 giây (không xuyên tường/rào). Tìm đường chỉ tránh vật cản cố định.
- Năng lượng: mỗi việc tốn ít hơn trước; dưới 20 thì tự **nghỉ giữa ca** 30 giây (rút ngắn theo cấp nhà nghỉ). Khi mệt (≤ 30) hoặc đang nghỉ, trên đầu thợ hiện **đồng vàng + giá** (nửa giá một ngày lương); bấm vào để bồi dưỡng: trừ xu, hết mệt (100) và làm tiếp ngay. Bồi dưỡng không cộng thêm thời hạn hợp đồng.
- Dữ liệu cũ: người đang có ca còn hạn được đổi thành hợp đồng 1 ngày, một lần (`contractVersion`).

### Hồ sơ và xóa

- Hồ sơ có mũi tên Back về đúng tab mở trước đó. Ứng viên có mô tả hài hước, 5 chỉ số, phí tuyển và lương.
- Chỉ hồ sơ ứng viên có Thuê/Từ chối cùng một hàng; không có Từ chối ở danh sách ngoài.
- Hồ sơ người đã thuê gồm **Đào tạo / Thiết lập**. Lương, ngày làm, ngày trả ở đầu; không lặp ở footer.
- Đào tạo hiển thị đầy đủ chỉ số và nâng cấp. Nhân viên tối đa cấp 10; tăng cấp cộng chỉ số theo luật, tối đa 100.
- Thiết lập gồm Bố trí tại farm, Làm việc, Tự trả lương, Chăm cây & thu hoạch, Chế biến, Vận chuyển. Không hiện chọn vai trò/giống chi tiết ở đây.
- Chỉ xóa người dự bị; phải trả lương theo điều kiện thanh toán hiện tại. Icon xóa góc phải mở modal xác nhận. Hủy không thay đổi dữ liệu.
- Xóa loại người đó khỏi đội và danh sách tuyển dụng. Không hoàn phí tuyển; không mất hàng trong kho. Điều kiện lương cần bàn kỹ thêm ở mục 10.

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
- Back quay về đúng danh sách/tab đã mở chi tiết. Đếm ngược cập nhật tại chỗ, không dựng lại toàn bộ danh sách mỗi frame.

## 5. Chế biến và nâng cấp công trình

### Công suất và thời gian hiện tại

| Trạm | Một phần nguyên liệu → đầu ra | Thời gian cơ sở/mẻ | Công suất đầu vào cấp 1 |
|---|---|---|---|
| Sân phơi | 600 g quả → 100 g nhân sạch | 30 giây | 18 kg |
| Lò rang | 100 g nhân sạch → 84 g hạt rang | 18 giây | 1 kg |
| Máy xay | 84 g hạt rang → 84 g bột | 10 giây | 1 kg |

- Thời gian tính **theo mẻ**, không theo số phần. Chọn 1 hoặc 2 phần cùng nằm trong một mẻ có thể mất cùng thời gian.
- Mỗi trạm hiện chạy **1 mẻ một lúc**. Vượt sức chứa thì chia thành các mẻ nối tiếp.
- **Cấp tối đa 999** cho mọi hạng mục, riêng Thiết bị quán tối đa 10 (quán có 10 chỗ bàn). Cấp 1–10 giữ nguyên số cũ.
- Qua cấp 10: công suất `2,62 + 0,04 × (cấp − 10)` (cấp 999 ≈ 42 lần); tốc độ `1,63 + 1,37 × (1 − e^(−(cấp−10)/200))`, tiến dần tới tối đa 3 lần để thời gian mẻ/thao tác không về 0; giếng thêm 1 lượt mỗi cấp. Không mở thêm mẻ chạy đồng thời.
- Giá: cấp < 10 = `base × 1,42^(cấp−1)`; từ 10 = `base × 1,42^9 × (1 + 0,15 × (cấp − 10))²` (cấp 999 khoảng 0,1 tỷ xu, dưới trần 1.000 tỷ).
- Điều kiện: lên cấp N ≤ 10 cần nông trại cấp N; qua 10 cần `10 + ⌈(N − 10)/10⌉`. Cấp nông trại cũng tới 999: XP cấp n > 10 = `2800 + 850(n−10) + 50(n−10)²`.
- **Diện mạo theo bậc:** Cơ bản (1), Cải tiến (10), Chuyên nghiệp (50), Công nghiệp (200), Huyền thoại (500). Mỗi bậc là một slot riêng `farm/<id>/tier-<n>`; chỉ bậc hiện tại hiện. Bậc 2+ hiện là bản sao khối tạm kèm cờ màu, thay asset không đổi luật. Dấu bậc trên công trình hiện số bậc đã đạt.
- Hàng chờ tối đa 48 mẻ, hiện tính cả mẻ xong chưa nhận. Bấm Bắt đầu nhiều lần tạo thêm mẻ; chưa gộp với mẻ chờ còn chỗ.
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
- Cửa hàng tách Cây giống / Vật tư / Chợ. Mua giống/phân chọn số lượng và tổng giá.
- Giữ hạt rang cho quán mặc định tắt với save mới; bật trong màn quán khi cần.
- Bán tự do hiện lượng đang có, chọn số gram và khách trả bao nhiêu. Giá theo chất lượng các lô xuất trước. Giữ hạt cho quán có thể chặn bán hạt rang.
- Đơn mua cố định ở Chợ có lượng và thưởng cố định; khác với bán tự do tùy lượng.
- Chỉ nút Mua/Bán mới mở giao dịch; bấm box không mua/bán.
- Mua và bán đều có modal xác nhận món, lượng, số xu. Xác nhận mới trừ/cộng; Hủy không giao dịch. Kiểm tra lại điều kiện lúc thực hiện.
- Mọi ô nhập số lượng hiện giới hạn **1–99**; nếu hàng/nguyên liệu/sức chứa hàng chờ hoặc xu không đủ thì hạ giới hạn. Đạt tối đa thì khóa +. Bán tự do hiện dùng **gram**, tức tối đa 99 g/lần nhập; chế biến dùng **phần nguyên liệu**, không phải 99 mẻ.
- Không giới hạn 99 cho các đơn cố định, tổng hàng tồn hoặc lượng một mẻ được nhận. Nhận một mẻ lấy cả đầu ra mẻ.

## 7. Nhiệm vụ cá nhân

- Tự chăm ruộng, hái quả, cho cá ăn theo yêu cầu; thao tác nhân viên không cộng.
- Mỗi nhiệm vụ có ngày nhận, yêu cầu rõ, tiến độ và thưởng xu. Việc chưa hoàn thành không bị làm mờ cả ô.
- Chỉ hiện Nhận thưởng khi hoàn thành; đã xong đưa lên đầu. Thưởng nhận một lần.
- Nhiệm vụ cá nhân đổi mới mỗi chu kỳ 6 ngày game (6 phút). Mỗi loại chỉ có một thẻ; việc chưa xong giữ sang chu kỳ sau, việc đã xong giữ tới khi nhận thưởng. Không hiểu là đơn của quán.
- Nhiệm vụ cố định (hái, tưới, phơi, rang…) chỉ tính thao tác của người chơi.

## 8. Quy tắc UI/UX chung

- Đây là game 3D: tương tác công trình/ô đất, HUD nhỏ; không dùng dashboard phủ map thay gameplay.
- Font ưu tiên Baloo 2, Fredoka, system-ui, sans-serif; hỗ trợ tiếng Việt. Font đang tải từ Google Fonts, có fallback.
- Khung gỗ, bảng kem, biển tiêu đề xanh nổi giữa mép trên, nút đóng tròn ngoài góc. Một kiểu nút xanh cho thao tác chính; xu dùng đồng vàng thống nhất.
- Modal khóa di chuyển; giữ kích thước ổn định giữa tab, nội dung dài cuộn bên trong, padding đều. Tab căn trái; túi và cài đặt ôm chữ/xuống dòng thay vì cuộn ngang.
- HUD trái: avatar/tên/cấp/XP → thống kê → Cần xử lý → Hoạt động. Bấm avatar/tên đưa camera về nhân vật, không có nút Về nhân vật riêng.
- Phải: chỉ hiện ô xu, bấm mở Cửa hàng; lượng nước nằm trong công cụ Tưới và màn Giếng nước. Dưới là menu dọc, Cài đặt đầu tiên, Hướng dẫn cuối. Menu dưới giữ Kho, Cửa hàng, Nâng cấp, Nhân viên, Nhiệm vụ, Đơn hàng, có thu gọn.
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
- Quà thiên đàng áp dụng một lần (cờ `giftApplied`): Túi hạt giống +6 hạt vối và 6 phân; Bộ dụng cụ pha nâng thiết bị quán lên cấp 2; Túi vốn nhỏ +150 xu.
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
4. **Đơn vị bán:** 99 hiện là gram nên bán lượng lớn khá chậm. Có đổi sang phần 100 g/đơn vị hoặc đơn vị linh hoạt không.
5. **Nợ lương khi xóa:** hiện kiểm tra ca đã trả còn hiệu lực, chưa có sổ nợ riêng. Cần quyết định xóa dự bị là trả một ca hay thanh toán số công chưa trả, và ca hết hạn khi dự bị có thực sự là nợ không.
6. **Nghỉ tự động:** vẫn có năng lượng/nghỉ nhưng đã bỏ nút hồi sức; cần cân bằng thời gian chờ và làm rõ người đang nghỉ không phải lỗi đứng yên.
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

- **02/11/2026:** Nâng cấp tới cấp 999 với đường cong giảm dần sau cấp 10; cấp nông trại tới 999; 5 bậc diện mạo có slot asset riêng.

- **02/11/2026 (nhân viên bước 2):** Hợp đồng Ngày/Tuần/Tháng trả trước, tự gia hạn, hết hạn dừng an toàn, bỏ bồi dưỡng, nghỉ giữa ca tự động.

- **02/11/2026 (nhân viên bước 1):** Chỉ thị nông trại; thợ làm việc không cần đơn; chế biến theo tồn mục tiêu; ưu tiên theo độ khẩn và quãng đường; mang đầy bình. Xem [đề xuất](design/farm-staff-ai.md).

- **02/11/2026 (đợt sửa 3):** Hiện lại khung mục tiêu; thông báo nhiệm vụ/lên cấp; thông báo đủ câu; chế biến mặc định tối đa, sửa ô nhập số; Đến lấy hàng nhận luôn; Esc không đóng modal cha.

- **02/11/2026 (đợt sửa 1):** Bỏ vốn thử cho save mới (200 xu); quà thiên đàng có tác dụng; nhiệm vụ cá nhân chu kỳ 6 phút, không trùng, không mất thưởng; đơn quán chỉ sinh khi có thợ chính, tối đa 2; tắt giữ hạt mặc định; việc của thợ không cộng nhiệm vụ cố định.

- **02/11/2026:** Tách nhiệm vụ cá nhân, đơn quán và Chợ; đội nhiều người/2 thợ chính; kéo đổi đội; hồ sơ/đào tạo/thiết lập và lương; xác nhận giao dịch; chọn lượng tối đa 99; ba tab đơn; tiến độ/nhận mẻ riêng hoặc tất cả; nâng cấp tại công trình; HUD, đồng vàng, modal và thông báo thống nhất. Ghi nhận chưa thay luật chạy mẻ tuần tự.
