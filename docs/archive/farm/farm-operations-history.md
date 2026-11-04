# Lịch sử luật vận hành trước đợt cập nhật UI/gameplay

> **Lưu trữ.** Tài liệu lịch sử, có thể đã lệch code. Không dùng làm đặc tả; xem [docs/README.md](../../README.md) để tìm tài liệu hiện hành.

Tài liệu lưu để đối chiếu; có các luật đã bị thay thế. Không dùng làm đặc tả hiện hành. Xem [luật hiện hành](../../screens/03-farm/rules.md).

# Vận hành farm và quán — bản luật hiện tại

Thông số này thay thế thời gian và giới hạn tuyển người trong bản đề xuất trước. Đây là cấu hình gameplay rút gọn, không phải thời gian hay liều lượng canh tác thật. Chưa chạy test, build, lint hoặc preview trong lượt triển khai này.

## Vòng chơi dành cho chủ

1. Vào **Đơn từ quán** (xe giao hàng): chọn đơn, xem các bước và chỉ định người phụ trách.
2. Vào **Nhân viên**: thuê từ hồ sơ ứng viên. Có thể giữ nhiều người trong đội; nông trại hiện tại chỉ bố trí tối đa 2 người. Người dự bị không nhận việc hoặc lương ca mới.
3. Chọn nhân viên: xem chỉ số, bố trí/dự bị, trả lương ca, đào tạo, nhóm việc được phép và danh sách việc đã giao. Mặc định nhận việc theo đơn/nhiệm vụ, trả lương thủ công. Có thể bật tự trả hoặc tự chăm toàn farm.
4. Bật nhóm việc cần thiết: trồng, tưới, bón phân, làm cỏ, tỉa, hái, chế biến, giao, chăm cá. Chọn giống mặc định; đơn cụ thể xác định giống cần trồng. Người chơi cung cấp cây giống và phân; nhân viên không tự mua đồ.
5. **Nhiệm vụ** tạo việc mỗi ngày game, có người được giao, tiến độ và thưởng một lần. Đơn sản xuất không yêu cầu bỏ cây cũ để trồng lại.
6. Nhân viên kiểm tra tiền lương, vật tư, trạng thái cây, công suất và đường đi. Thiếu điều kiện thì chờ; không teleport hoặc tạo nguyên liệu.
7. Đủ hạt: người chơi bấm giao đúng đơn, hoặc yêu cầu nhân viên giao. Tách `đang chuẩn bị → đang giao → đã nhận`; không tự bán thành tiền khi chuyển nội bộ.
8. **Vào quán** chuyển sang một scene riêng. Mở cửa, bấm bàn khách để nhân vật tới phục vụ. Quầy mở kho và lựa chọn pha. Farm và nhân viên tiếp tục khi chủ ở quán. Quay về bằng nút Nông trại hoặc cửa ra.

## Nhịp thời gian

| Việc | Thời gian cấp 1 cơ sở |
|---|---|
| Ngày game | 60 giây |
| Cây giống vối/chè/mít kiến thiết | 90 / 120 / 150 giây, cần điều kiện chăm |
| Vụ cây trưởng thành | Khoảng 180 giây; mít dài hơn 10% |
| Sơ chế, gồm phơi và tách vỏ khô | 30 giây/mẻ |
| Rang | 18 giây/mẻ |
| Xay ở farm | 10 giây/mẻ |
| Giao đơn | 10 giây/chuyến |
| Pha tại quán | 3 giây/ly |
| Ca nhân viên | 8 phút, nghỉ cơ sở 4 phút |

Tốc độ dụng cụ, chỉ số và cấp làm thay đổi thời gian thao tác. Công suất giới hạn khối lượng mẻ; phần dư chờ lượt. Mỗi trạm có hàng chờ riêng, các trạm làm độc lập. Mẻ xong giữ tại trạm tới khi nhận, kho đầy không tự mất hàng. Mẻ chưa chạy được hủy và trả nguyên liệu.

Cây là cây lâu năm: kiến thiết → phục hồi → hoa → nuôi quả → chín. Hái chọn phần chín rồi đợi phần còn lại; giữ cây sang vụ sau. Nước chỉ tưới khi cần, mưa thay tưới, cửa sổ khô có kiểm soát không bắt tưới. Phân chỉ nhận một liều đúng đợt khi đất đủ ẩm. Làm cỏ và tỉa có điều kiện riêng. Không áp dụng con số độ ẩm này ra vườn thật.

## Thuê, lương và cấp

- Danh sách hiện có 8 ứng viên cố định, có thể tuyển tất cả. Giới hạn 2 là số **đang bố trí trên mỗi farm**, không phải giới hạn toàn bộ đội.
- Chỉ số: tốc độ, thông minh, sức mạnh, khéo léo, thể lực. Chỉ số gốc lưu ổn định; cấp tăng chỉ số, giới hạn 100.
- Cấp nhân viên tối đa 10; làm xong việc hợp lệ nhận XP. Đào tạo bằng xu đưa tới cấp kế tiếp.
- Lương ca = `8 + 4 × (cấp − 1)` xu: cấp 1 là 8, cấp 10 là 44 xu. Trả trước ca; không thu hai lần cho cùng ca. Đào tạo không truy thu ca đã thanh toán.
- Tự trả lương chỉ thanh toán khi có việc nhận ca mới. Hết tiền chờ chủ; người dự bị không tự bắt đầu ca.
- Phúc lợi giảm thời gian nghỉ. Nhân viên mạnh mang/hái được nhiều hơn mỗi thao tác, nhanh di chuyển và làm nhanh hơn, khéo giúp thao tác, thông minh giúp lựa chọn công việc, thể lực làm giảm hao năng lượng.
- Không có nhà điều hành hoặc điểm tập kết trên map. Nhận hàng vào cùng kho farm như người chơi, không yêu cầu đi một điểm giả để nộp hàng.

## Thuật toán việc

Một bảng việc chung tạo ứng viên từ nhu cầu thật. Với tối đa 2 người, xét các cặp phân công không trùng mục tiêu; chấm theo mức khẩn, vai trò, chỉ số và thời gian đi ước tính. Trước khi di chuyển giữ quyền việc và vật tư cây giống/phân. Khi làm xong gọi cùng lệnh mà người chơi dùng; kiểm tra lại điều kiện rồi mới tiêu vật tư. Khi hủy, nhường chủ hoặc đổi bố trí trả quyền giữ.

Đơn được phân tích ngược: hạt rang cần → nhân sạch cần → quả chín cần → cây cần. Tính cả đầu ra mẻ đang giữ trong trạm để tránh sản xuất lặp. Nếu đã có cây phù hợp thì chăm cây đó, không bắt trồng cây mới cho mỗi đơn. Nếu đủ thành phẩm, chờ chủ giao. Nhiệm vụ ngày có thể tạo thêm việc chăm/cá độc lập.

Đường đi dùng cùng hàng rào, cổng, vật cản và thuật toán tìm đường của chủ. Tìm đường chia thời gian qua nhiều frame. Có nhường người chơi, tránh nhân viên kia và tìm lại đường khi bị chặn; mục tiêu không tới được thì lùi nhiệm vụ và thử lại sau. Không đổi nhiệm vụ mỗi frame. Chỉ số thấp không được phép đi xuyên vật cản.

## UI và asset

- HUD nhỏ: tên, cấp, XP, tiền, nước, ngày và sức chứa.
- Nhân viên ở danh sách chỉ hiện tên/cấp/trạng thái; bấm hồ sơ hoặc nhân vật trong map mới hiện chỉ số và điều khiển.
- Icon công cụ mở dải dưới. Có thể kéo hạt, nước, phân, cỏ, tỉa, hái và cuốc theo ô hợp lệ; kéo ngược bớt ô, giới hạn theo vật tư, một ô không dùng nhiều hạt.
- Người chơi và nhân viên có cùng bộ phản hồi thao tác 3D: đạo cụ tạm, nhãn hành động và tiến độ trên đầu. Thành phẩm/tiền có phản hồi bay về HUD.
- Shop, kho, nhân sự, đơn và nâng cấp là modal giữa màn, khóa di chuyển chủ khi mở. Chọn cây giống vẫn là dải công cụ không khóa map.
- Ao giữ nguyên vai trò ao dự trữ, có cá, cho ăn và thu cá. Không thay thành quán.
- Danh mục nâng cấp tối đa 10: phúc lợi, đất, rào, ao, giếng, dụng cụ, sân, lò, máy, kho, giao hàng, thiết bị quán. Mỗi hạng mục có hiệu quả thật; không tăng sản lượng vô hạn. Khối có dấu cấp và các slot thay asset; phúc lợi là chính sách, không dựng lại nhà đã bỏ.
- Slot nhân viên `farm/worker/<id>`, cây `farm/<plot>/bed|crop`, trạm `farm/<id>`, quán `cafe/room`, `cafe/counter`, `cafe/espresso-machine`, `cafe/table-<n>`. API thay asset giữ luật và điểm tương tác.

## Lưu hàng và kinh tế

Tồn kho lấy từ các lô có id, nguồn, khối lượng gram, chất lượng, thời điểm. Có kho farm, hàng đang giao và kho quán; một lô chỉ tính ở một vị trí. Bán thu mua tối đa 100 g mỗi lần, giá xét chất lượng. Giữ hàng quán có thể bật/tắt. Chuyển nội bộ chỉ mất cước, không tạo doanh thu; quán thu tiền sau khi pha xong. Có nhập hạt dự phòng để không kẹt lúc cây non.

Lưu schema 3, chuyển hàng phiên bản 1/2 sang gram, giữ ruộng, giống, tiền thử 100 triệu và mẻ cũ. Không tự nạp đầy bình khi tải lại. Đổi màn không tạo bản sao mô hình dữ liệu. Khi đóng game chỉ tính cây/mẻ/chuyến tối đa 8 giờ; không tự vận hành nhân viên hoặc sinh khách offline. Đây là chế độ offline bảo vệ, không phải mô phỏng nhân viên offline đầy đủ.

Các thông số kinh tế vẫn cần người chơi thử để cân bằng. Chưa có map nông trại thứ hai hay tuyển dụng thủ tục vô hạn; đội hiện tại và ràng buộc bố trí đã tách để thêm farm sau. Sâu bệnh chi tiết, vùng khí hậu riêng, nhiều công thức quán và hồ sơ rang chuyên sâu thuộc lớp mở rộng, không được coi đã hoàn thành trong bản này.

### Gợi ý phân công phiên đầu

- Thuê An và Bình; hai vị trí farm đầu tự được bố trí nếu còn chỗ. Những người thuê thêm vào dự bị.
- Trả lương một ca cho mỗi người. Chọn đơn vối đầu tiên, giao cả hai phụ trách; người ưu tiên cây chăm/hái, người ưu tiên chế biến xử lý mẻ. Vai trò chỉ là ưu tiên, không chặn nhóm việc đã bật.
- Chưa cần mua ruộng nếu chưa có đủ cây giống, nước, kho và đầu ra. Có thể tự hái bốn cây chín ban đầu để chủ động học vòng chế biến.
- Chờ một ngày game để có nhiệm vụ mới; nhiệm vụ cá chỉ xuất hiện khi đã có cá. Cho cá ăn bằng nhân viên cần giao nhiệm vụ cá hoặc bật chế độ tự làm và nhóm Chăm cá.
- Mở hồ sơ xem trạng thái chờ: chưa trả lương, đang nghỉ, chờ nguyên liệu/cây/mẻ. Những điều kiện này được tách khỏi lỗi đường đi.
- Đủ đơn bấm Giao hoặc Nhờ nhân viên giao; tự giao không đòi đi tới điểm tập kết. Vào quán bán thành ly để tạo doanh thu rồi quay về đầu tư.

Nước hồi cơ sở 3,6 lượt/phút, tăng theo giếng tới 17,1 lượt/phút ở cấp 10; ao tăng sức dự trữ. Mục tiêu là một ruộng có thể vận hành bền vững từ đầu, bốn ruộng cần nâng hạ tầng. Thông số cần tiếp tục cân bằng sau khi người dùng chơi thử.

### Điều chỉnh thao tác giao việc

- Đóng dải công cụ bằng X hoặc Escape hủy việc đang chọn, hàng kéo, viền chọn và chế độ công cụ; lần bấm sau trở về thao tác tự chọn.
- Hồ sơ nhân viên mặc định mở tab **Làm việc**. Bấm **Làm việc ngay** để trả ca còn thiếu và nhận việc đã giao. Nếu chưa có đơn/nhiệm vụ, nhân viên tự chăm farm theo các nhóm đang bật. Bấm lại trong cùng ca không thu lương lần nữa.
- Trong đơn hoặc nhiệm vụ có **Giao đội làm**: gộp chỉ định người, trả lương còn thiếu và bắt đầu. Nếu thiếu tổng tiền hoặc còn người đang nghỉ, không trừ một phần tiền rồi để đội ở trạng thái nửa chừng.
- Tab **Đào tạo** chỉ hiện nâng cấp; **Thiết lập** chứa nhóm việc, giống, ưu tiên, tự trả lương và bố trí. Trạng thái chờ phân biệt rõ chưa trả lương, chưa giao việc, nghỉ, tắt nhóm việc và chờ vật tư/cây/mẻ.

Đơn quán và việc theo ngày được gom vào **📋 Công việc**, với hai tab **Đơn quán / Việc hôm nay**. Chọn một việc rồi dùng nút **Giao đội làm**; danh sách người phụ trách riêng vẫn có khi muốn chỉnh tay. Không cần lần lượt đi qua màn trả lương và phân công chỉ để bắt đầu một nhiệm vụ.

### Nhận diện người và trạng thái

Nhân sự mặc định ở tab **Farm hiện tại**; người dự bị và tuyển dụng tách riêng. Chỉ tab **Đào tạo** hiện XP và các thanh chỉ số. Thiết lập nhóm việc/tự trả lương/tự chăm dùng công tắc. Giao một người vào đơn hoặc nhiệm vụ sẽ bắt đầu ca và trả phần lương còn thiếu, không chỉ gắn tên rồi đứng chờ. Các đơn phân nhóm Chưa giao ai, Đang làm, Đủ hàng, Đang giao, Đã nhận. Người đứng rảnh nhường lối cho người đang làm; đường tới mục tiêu tránh vị trí nhân viên khác.

### Nhân viên tự vận hành và mệt mỏi

Nhân viên mới bố trí tại farm mặc định tự làm việc và tự trả ca khi có việc, không phải trả lương/giao việc nhiều lần để khởi động. Người dự bị vẫn không làm tại farm. Phân công đơn tăng ưu tiên cho đơn nhưng không tự thay đổi công tắc Tự chăm khi rảnh của người chơi. Khi một mẻ đang chạy, người làm tìm việc chăm/hái khác đang hợp lệ. Đã sửa việc nhận thành phẩm theo đơn bị bỏ qua do trạm không mang cropId như cây.

Trên đầu luôn có tên, % mệt và trạng thái cụ thể; đang thao tác có tiến độ và đạo cụ. Đi bộ/làm việc giảm năng lượng. Mệt từ 80% tự nghỉ khoảng một phút (phúc lợi rút ngắn nghỉ), hoặc chủ bấm Bồi dưỡng trong tab Làm việc, giá bằng nửa lương ca làm tròn lên. Bồi dưỡng hồi năng lượng lên 75%, cho làm tiếp ít nhất hai phút, không được bấm liên tục khi chưa mệt. Kết ca chỉ thanh toán ca tiếp khi có việc; không ép nghỉ bốn phút khi nhân viên vẫn khỏe. Thiết lập mặc định chỉ có vài điều khiển chính; nhóm việc, giống và ưu tiên đặt trong Tùy chỉnh chi tiết.

### Thao tác trực tiếp trên bảng việc và nhân viên

Dòng việc có một hành động theo trạng thái: chưa giao bấm Giao làm để giao cho người sẵn sàng, đủ hàng bấm Giao ngay không mở thêm modal, đã giao bấm xem tiến độ. Nhiệm vụ hoàn thành bấm nhận thưởng ngay. Chi tiết chỉ hiện bước hiện tại, số bước xong và hành động còn dùng được; Đổi người là mục mở thêm, không dàn nút vô hiệu. Người đang nghỉ/mệt có icon xu với giá ngay trên đầu; bấm đúng icon bồi dưỡng làm tiếp, bấm thân người vẫn mở hồ sơ. Giao đội ưu tiên người sẵn sàng, không bắt cả đội chờ chỉ vì một người đang nghỉ.

## Hợp đồng ngày, ưu tiên đơn và uy tín (cập nhật)

- Hợp đồng thuê liên tục đến khi chủ tạm dừng/chuyển dự bị. Ngày làm việc game dài 60 giây chơi; lương ngày = 8 + 4 × (cấp − 1) xu. Trả trước ngày khi có việc; không thu hai lần trong ngày đã trả. Ngày làm tích lũy từ thời gian nhân viên được bố trí, bật làm và đang trong thời gian đã thanh toán; thời gian đóng game không cộng công, không truy thu nhiều ngày offline. Ca cũ đã trả được giữ tới hết trước khi chuyển cách tính mới. Hồ sơ ghi ngày đã làm và ngày đã trả.
- Tự chăm khi rảnh: ưu tiên đơn chủ chỉ định rồi chăm/hái/chế biến, trồng các ô trống trên tất cả ruộng đã mua. Không tự mua cây giống; hết giống có thông báo. Nếu chưa chủ động chọn giống cho người đó, chọn giống còn trong kho và ít cây hiện có để đa dạng vườn.
- Chủ làm hộ cây hoặc nhận/chạy mẻ trước: nhân viên kiểm tra lại cả lúc đang đi, hủy bước không cần nữa và chuyển việc khác. Vật tư chỉ trừ khi hoàn thành.
- Đơn shop nhận xong mới bắt đầu hạn 8 ngày game (480 giây). Giao đúng hạn nhận tiền, +3 uy tín và lưu đánh giá; hết hạn −5 uy tín, chuyển vào lịch sử quá hạn. Đơn quán nội bộ có hạn, giao đúng hạn đánh giá 5 sao/+2 uy tín; trễ hoặc không làm ảnh hưởng uy tín. Giao nội bộ không sinh tiền; tiền thật đến từ quán bán ly và đơn shop/thu mua.
- Bảng Công việc dùng tab Tất cả / Chờ xử lý / Đang làm / Chờ giao–nhận / Đang giao / Hoàn thành / Quá hạn. Dòng ghi người phụ trách và thời gian còn lại. Người chơi bấm trực tiếp nút phù hợp trạng thái.
- Góc phải có nhật ký thu gọn, thể hiện hai người đang làm gì và các việc vừa hoàn tất, giao hàng, uy tín thay đổi. Menu chức năng được gom sau một nút Menu bên phải phía dưới; các nút cũ không còn trải ở cả đầu và cuối màn hình.

Đây vẫn là thời gian gameplay nén, không phải lịch canh tác thật. Chưa chạy test/build/preview cho thay đổi này.

## Menu gọn và nguyên nhân đang tắc

Thanh đáy duy nhất: Thế giới (chưa mở), Kho, Cửa hàng (mua giống/vật tư và thu mua), Nâng cấp, Thêm (nhân viên, công việc, ao, quán và tiện ích). Thiết lập nhân viên và các thao tác làm việc chia hai cột. Việc hoàn tất/quá hạn không còn trộn với việc đang theo dõi; mở Lịch sử khi cần.

Góc trái có bảng Cần xử lý thu gọn được: ô trống hết giống, đơn thiếu loại giống, thiếu phân, thiếu nước dự trữ, kho đầy, người bị tạm dừng/chưa trả lương/tắt trồng. Có nút mở đúng nơi khắc phục. Khi hết điều kiện tắc dòng tự biến mất; không bịa thông báo thiếu giống khi không còn ô trống.

Bộ chọn việc cộng ưu tiên theo thời gian chờ (có trần), để trồng trên ô trống không bị bỏ đói bởi vòng hái/sơ chế lặp lại. Giống ưu tiên hết vẫn dùng giống khác còn trong kho, trong giới hạn cấp và nhóm việc được bật. Nhân viên không tự mua thêm giống bằng tiền chủ. Các trường hợp này đã có mã kiểm thử nhưng chưa chạy theo quy tắc người dùng tự test.

### Bố cục HUD không chồng nhau

Cụm trái xếp theo luồng: tên/cấp → Ngày game, nhân viên và kho → Cần xử lý. Ngày game là bộ đếm ngày mô phỏng, không phải mã lỗi; hai dòng trạng thái tránh cắt mất sức chứa kho. Cụm phải xếp tiền/nước rồi nhật ký có thể thu gọn. Các khung không còn dùng tọa độ top cố định độc lập nên chiều cao thay đổi không đè lên nhau. Bảng Thêm mở ngay phía trên mép phải thanh đáy; chức năng Về nhân vật đặt tên đúng để không nhầm hồ sơ nhân vật. Bấm ngoài hoặc mở modal sẽ đóng bảng Thêm.

### Vụ cây, thống kê và cách đọc kho

Vụ trưởng thành đổi sang khoảng 6 phút cơ sở: phục hồi → ra hoa → nuôi quả → chín. Một đợt chín cho đủ sản lượng rồi hái một lượt, không chia vì sức mang của từng nhân viên và không quay lại hái phần dư sau vài giây. Sau hái cây về đầu chu kỳ. Giảm tốc mất nước/cỏ tương ứng; nước và phân không biến thành thao tác lặp sau mỗi lần nhặt quả. Cây có hoa trắng ở giai đoạn ra hoa. Giữ thời gian sơ chế/rang ngắn để nhân viên có thời gian chăm ô khác.

HUD thay số ngày bằng Hôm nay: khối lượng hái, chế biến và tiền bán. Số ngày vẫn dùng nội bộ cho lương/nhiệm vụ, không phô trên map. Túi ghi tổng kg/tối đa kg và số gram còn trống. Các ô là nhóm vật phẩm, không phải ô sức chứa; bỏ lưới ô trống lớn dễ hiểu nhầm. Ví dụ 59,39/60 kg còn 610 g, không nhận được mẻ 1 kg. Trạm nhận những mẻ đã xong còn vừa kho trước, giữ các mẻ còn lại; nhân viên bỏ qua việc hái/nhận không vừa kho và ưu tiên chế biến để giảm khối lượng tồn.
