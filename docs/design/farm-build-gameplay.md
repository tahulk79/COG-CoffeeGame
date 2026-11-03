# Đề xuất gameplay xây dựng — Nông trại cà phê

Ngày 02/11/2026. Đây là đề xuất để người dùng và agent chốt, **chưa phải luật đã triển khai**. Tham chiếu [luật hiện hành](../farm-operations-guide.md). Không thay đổi công trình, tiền, bản đồ hoặc hàng đang chế biến khi tạo tài liệu này.

## Phạm vi được chọn sau đề xuất

Người dùng chọn làm **hoa, đèn và biển tên trước**. Phần này đã được nối vào game với đặt/xoay/xác nhận/lưu. Các công trình chức năng, di chuyển đồ đã đặt và đợt A bên dưới vẫn là ý tưởng chưa triển khai. Xem luật hiện hành để theo dõi giá và giới hạn trang trí.

## 1. Vai trò của xây dựng

Vòng chơi mở rộng: nhận nhu cầu của quán → nhìn ra điểm nghẽn → tích xu → chọn công trình → đặt trên map → sử dụng công trình để xử lý nhu cầu → tiếp tục nâng cấp.

Mỗi công trình có mục đích, vùng chiếm đất, điểm tương tác và trạng thái rõ. Tránh xây nhiều nhà chỉ để cộng một chỉ số khó hiểu hoặc đưa thêm nông sản không liên quan cà phê.

Phân biệt hai quyết định:

- **Xây thêm trạm:** tăng số công việc có thể thực hiện đồng thời nhờ một trạm độc lập mới.
- **Nâng cấp trạm:** tăng công suất/tốc độ của chính trạm đó. Không tự biến thành nhiều trạm chạy song song.

Ví dụ: lò rang thứ hai cho hai mẻ chạy đồng thời trên hai lò. Nâng lò thứ nhất chỉ tăng kg/mẻ và tốc độ của lò đó. Đây là cách giải quyết nhu cầu chạy song song đã ghi nhận, chưa áp dụng vào code hiện tại.

## 2. Danh mục công trình đề xuất

Kích thước tính theo ô xây dựng dự kiến, cần chốt theo tỷ lệ nhân vật và công trình hiện có. Giới hạn là đề xuất cho farm đầu, không phải giới hạn toàn game.

| Công trình | Công dụng và liên kết | Kích thước dự kiến | Giới hạn đề xuất |
|---|---|---|---|
| Sân phơi phụ | Thêm một hàng mẻ độc lập; giải quyết quả chín tồn và chờ phơi | 4×3 | Tổng 2 sân |
| Lò rang phụ | Chạy rang đồng thời để đáp ứng nhiều đơn quán | 3×3 | Tổng 2 lò |
| Máy xay | Chuyển hạt rang thành bột; chỉ ưu tiên mở rộng khi công thức quán thực sự cần bột | 2×2 | Giữ 1 ở giai đoạn đầu |
| Nhà kho phụ | Thêm sức chứa cho cùng kho farm; thành phẩm ở mọi trạm đều dùng được dung lượng này | 3×3 | 1 kho phụ |
| Bồn nước | Thêm dung lượng nước dự trữ, nhận nước từ giếng/mưa; không tự tạo nguồn nước mới | 2×2 | 2 bồn |
| Nhà ủ phân | Đổi quả cà phê thành phân, thêm lựa chọn dùng hàng để chăm cây thay vì bán | 2×2 | 1 nhà |
| Trạm giao hàng | Điểm xem/gửi đơn cho quán; nâng cấp giảm thời gian hoặc phí theo luật sẽ chốt | 3×2 | 1 trạm |
| Chòi nghỉ | Điểm nghỉ hữu hình cho thợ; gắn chính sách phúc lợi hiện có với công trình, không cộng giảm nghỉ hai lần | 2×2 | 1 chòi |
| Bàn ghế quán | Tạo vị trí khách ngồi và phục vụ thật; chỉ xây trong map quán | 2×2 | Theo diện tích quán |
| Cụm hoa, đèn, biển tên, hàng rào trang trí | Cá nhân hóa farm, không bắt buộc để hoàn thành đơn và không cộng sản lượng trực tiếp | 1×1 trở lên | Theo đất trống |

### Giới hạn phạm vi

- Ruộng vẫn mua theo 4 cụm hiện có; không tự mở cơ chế vẽ luống tự do trong phiên đầu.
- Không mở thêm vị trí thợ chính bằng xây nhà. Farm vẫn tối đa 2 thợ chính.
- Chưa thêm máy điện, nhiên liệu, độ hỏng mới hoặc loại nguyên liệu xây dựng mới.
- Chưa thêm tưới tự động, máy tự thu hoạch: các cơ chế này ảnh hưởng trực tiếp nhiệm vụ cá nhân và vai trò thợ, cần thiết kế riêng.
- Đường đi chủ yếu phục vụ bố cục/khả năng tiếp cận; không yêu cầu trải từng viên đường mới được tương tác công trình.
- Ao và giếng hiện có giữ công dụng. Chưa cho xây nhiều ao/giếng để tránh thay luật nước ngoài phạm vi.

## 3. Tiến trình mở khóa đề xuất

Không chốt giá/cấp bằng số trước khi cân bằng kinh tế; tài khoản thử hiện có nhiều xu không đại diện nhịp chơi thật.

1. **Bố trí farm:** mở chế độ xây, cho di chuyển/xoay công trình được phép và một vài vật trang trí. Học chọn footprint và lối tiếp cận.
2. **Giải phóng kho:** kho phụ và bồn nước mở khi người chơi đã gặp cảnh báo tồn kho/nước. Không tự khóa tiến trình chỉ vì người chơi chưa từng làm đầy kho.
3. **Mở rộng sản xuất:** sân phơi phụ, rồi lò rang phụ khi đã phục vụ các đơn quán đầu. Chỉ số mở khóa theo tiến trình/cấp, không ép chờ hết hạn đơn.
4. **Vận hành:** trạm giao hàng, nhà ủ phân, chòi nghỉ sau khi hiểu chuỗi hàng và nhân viên.
5. **Quán và trang trí:** bàn ghế theo diện tích quán; trang trí là lựa chọn cá nhân.

Giá xây trạm phụ nên là quyết định đầu tư lớn hơn một lần nâng cấp sớm, nhưng phải có đường kiếm xu thực tế. Không dùng phí ngẫu nhiên hoặc khóa bằng nguyên liệu chưa có cách kiếm.

## 4. Luồng UI Build

Nút **Xây dựng** ở menu dưới. Bấm mở dải game nhỏ với ba mục:

- **Xây mới:** danh mục công trình theo nhóm Sản xuất / Kho & nước / Vận hành / Trang trí.
- **Di chuyển & xoay:** chọn công trình hiện có rồi đặt lại vị trí hợp lệ.
- **Nâng cấp:** bấm công trình để mở modal hiện tại có bảng cấp/công suất/nâng cấp.

Không để một bảng web chiếm map trong lúc chọn vị trí. Chỉ một chế độ thao tác tại một thời điểm; vào Build sẽ kết thúc thao tác chọn/kéo công cụ chưa xác nhận. Không hủy mẻ chế biến đã chạy.

Thẻ xây mới phải hiện:

- Icon, tên, diện tích, công dụng cụ thể.
- Ví dụ lợi ích: “Thêm 1 lò chạy độc lập”, không ghi chung chung “tăng hiệu suất”.
- Đang có/tối đa, điều kiện mở khóa, giá xu vàng.
- Nút Đặt công trình; việc chọn thẻ chưa trừ tiền.

### Đặt vị trí

1. Hiện mô hình bóng mờ và lưới **cục bộ** quanh vùng đặt.
2. Xanh: hợp lệ. Đỏ: không hợp lệ, có lý do ngắn (chồng ruộng, chắn lối, ngoài đất đã mua...).
3. Kéo/bấm map để di chuyển bóng; Xoay bằng nút hoặc R, hủy bằng nút hoặc Esc.
4. Hiện footprint, cửa/điểm tương tác và khoảng trống tiếp cận phía trước.
5. Bấm Xây mở xác nhận công trình + giá + vị trí; xác nhận mới kiểm tra lại tiền/đất và trừ xu.
6. Xây thành công có bụi/nhún nhẹ và viền sáng; không tự bật lại shop. Có thể chọn Xây tiếp nếu còn điều kiện.

Bản đầu nên xây xong ngay sau xác nhận. Hoạt ảnh xây dựng chỉ là phản hồi ngắn, chưa tạo thêm đồng hồ thi công hoặc yêu cầu thợ xây.

## 5. Tính hợp lệ, di chuyển và thu hồi

- Không chồng ruộng, công trình, hàng rào biên, đường/cổng bắt buộc hoặc điểm spawn.
- Cửa tương tác phải có đường tới được từ khu đi lại; công trình mới không được khóa đường tới các điểm tương tác đang có.
- Không đặt đè lên người chơi hoặc nhân viên; có thể yêu cầu họ tránh ra trước khi xác nhận.
- Chỉ đặt trong đất đã sở hữu/vùng xây được chỉ định. Không tự mua ruộng khi thả công trình.
- Di chuyển/xoay không đổi cấp, hàng chờ, mẻ đang chạy, kho hoặc người phụ trách.
- Đề xuất không cho kéo trạm đang có nhân vật thực hiện thao tác; báo “Đợi thao tác kết thúc”. Mẻ máy chạy thụ động vẫn giữ nguyên khi di chuyển.
- Chưa mở phá/bán công trình sản xuất trong phiên đầu. Nút Hủy khi đang đặt chỉ hủy bóng mờ, không xóa nhà thật.
- Không đổi kích thước công trình sau nâng cấp nếu điều đó bất ngờ chồng vật cản; các cấp đầu giữ footprint.

## 6. Luật dữ liệu khi có nhiều trạm

Điểm cần thay đổi trước khi triển khai: code hiện dùng id loại công trình cho trạng thái mẻ. Không thể chỉ nhân đôi model 3D rồi cho dùng chung hàng chờ.

- Mỗi trạm xây thêm cần id riêng; lưu loại, vị trí, hướng, cấp và hàng mẻ riêng.
- Nâng cấp/phí/thời gian gắn với từng trạm; dữ liệu cũ chuyển thành trạm đầu tiên, không mất mẻ đang có.
- Nhân viên chọn đúng trạm hợp lệ; tổng nhu cầu sản xuất tính đầu ra trên tất cả trạm để tránh làm dư.
- Một nguyên liệu chỉ được giữ/trừ một lần, kể cả chủ và thợ khởi động hai trạm gần nhau.
- Kho phụ cộng vào sức chứa dùng chung, không tạo bản sao tồn kho. Nếu sau này cho thu hồi kho thì phải xử lý hàng vượt dung lượng trước.
- Nhà ủ phân cần công thức, thời gian và hành động thật trước khi xuất hiện như công trình có thể mua.
- Chuyển scene, lưu/tải lại phải giữ vị trí, mẻ, thời gian, cấp. Hệ thống tìm đường/va chạm cần cập nhật sau đặt hoặc di chuyển.

## 7. Gợi ý triển khai gọn theo hai đợt

**Đợt A — Build có giá trị ngay:** đặt/xoay/di chuyển; kho phụ; sân phơi phụ; lò rang phụ; một ít trang trí. Dùng xu hiện có, không thêm tài nguyên xây dựng. Giữ tối đa 2 thợ chính.

**Đợt B — mở vòng chơi mới:** bồn nước, ủ phân, trạm giao hàng, chòi nghỉ và bàn quán. Mỗi món chỉ mở sau khi chốt tác dụng thực tế và tránh trùng nâng cấp hiện hành.

Tiêu chí hoàn thành đợt A: đặt được trạm thật, hai trạm chạy độc lập, thợ biết chọn trạm, không nhân đôi hàng, không bít lối, lưu/tải không mất dữ liệu. Không chỉ dựng menu và mô hình trang trí mang tên công trình.

## 8. Những quyết định cần chốt

1. Có đồng ý cách phân biệt “xây thêm = thêm trạm song song; nâng cấp = lớn/nhanh hơn” không?
2. Đợt A gồm kho phụ, sân phơi phụ, lò rang phụ và di chuyển/trang trí; có cần thu hẹp hơn không?
3. Giá, cấp mở khóa, giới hạn số lượng; footprint đo theo map thật.
4. Thời gian thi công: đề xuất xây ngay ở bản đầu.
5. Chòi nghỉ có thay thế hoàn toàn hạng mục phúc lợi hiện có hay chỉ là hình đại diện cho cùng một chính sách?
6. Bàn quán tăng số khách đồng thời hay chỉ thêm chỗ ngồi? Phải thống nhất với nâng cấp thiết bị quán, không cộng đôi.
