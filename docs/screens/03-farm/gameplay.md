# Nông trại cà phê

> Luật vận hành và UI hiện hành: [farm-operations-guide](rules.md), cập nhật 02/11/2026. Nội dung dưới đây lưu các mô tả kỹ thuật/lịch sử; khi có mâu thuẫn về nhiệm vụ, nhân viên, mẻ hoặc giao diện, dùng tài liệu hiện hành.

## Bố cục

Bốn ruộng theo cụm 2×2 ở góc trái phía trên. Mỗi ruộng gồm 12 ô vuông theo lưới 4×3: cạnh ô 1.35, khoảng cách tâm 1.5 đơn vị, khe giữa ô 0.15. Tất cả ô của ruộng chưa mua vẫn hiện; mỗi ruộng chỉ có một biển khóa kèm giá, không lặp khóa trên từng ô. Ô trống thuộc ruộng đã mua có dấu cộng nằm phẳng giữa ô. Biển ruộng hiển thị giá 120/180/300 xu. Mua ruộng liền kề mở cả 12 ô và mở rộng giới hạn đi lại.

Giếng sát cạnh phải ruộng đầu (-3.5,-6). Xưởng ở bên phải; mua giống, thu mua và bản đồ và nâng cấp là các nút ở góc phải HUD, mở trực tiếp modal và không cần đi tới quầy. Đã bỏ các cây trang trí và các dải đường dài; chưa đưa asset cảnh quan mới vào. Tán lá và nền luống không chặn chân, thân cây và công trình có va chạm. Ô đang chọn có viền vàng.

## Nhịp chăm sóc

Thời gian dưới đây là nhịp game, không phải thời gian trồng ngoài đời.

| Công việc | Khi nào hiển thị/được thực hiện |
|---|---|
| Gieo | Dấu cộng giữa ô trống; mở chọn giống đang có, sau đó nhân vật tới trồng |
| Tưới | Độ ẩm dưới 45%; mỗi lần tốn 1 nước, hồi lên 100% |
| Làm cỏ | Cỏ từ 30%; dọn về 0% |
| Bón phân | Từ 15% đến dưới 65% tiến độ lứa, chưa bón và còn phân; mỗi lứa một lần |
| Hái | Quả chín; giữ cây để tiếp tục lứa mới |

Nước giảm 0.32%/giây khi cây đang phát triển: sau khoảng 172 giây từ khi tưới đầy sẽ cần tưới tiếp. Cỏ tăng 0.22%/giây: từ nền sạch sau khoảng 137 giây sẽ cần dọn. Khi nước còn 15% hoặc cỏ đạt 75%, tăng trưởng tạm dừng; đồng hồ còn lại chỉ giảm khi đủ điều kiện. Biểu tượng ưu tiên hái → tưới → làm cỏ → bón phân. Bấm biểu tượng là nhân vật tự đi tới đúng cây và làm luôn. Hết nước thì nhắc tới giếng; hết phân vẫn có thể lớn bình thường.

Bón phân tăng tốc 15% và thêm một quả. Không bón quá sớm, quá muộn hoặc lặp lại trong cùng lứa. Cây khỏe hiện số giây còn lại; bấm sẽ giải thích thời gian chín và mốc tưới tiếp. Quả đã chín giữ nguyên chờ hái, không âm thầm giảm nước/tăng cỏ khi người chơi vắng mặt. Sau hái giữ lại độ ẩm/cỏ, reset tiến độ và lượt bón phân. Mỗi giống có thời gian lứa đầu/tái vụ riêng: vối 60/45 giây, chè 100/70 giây, mít 140/90 giây. Tính bù khi vắng mặt tối đa 4 giờ, không làm cây chết.

## Chế biến và UI

Quả → phơi → tách vỏ → rang → xay → bán/giao đơn → mở ruộng/nâng xưởng. Mẻ sản xuất tiêu thụ nguyên liệu khi bắt đầu; hết giờ thành phẩm chờ trên công trình, phải bấm tới nhận. Không tự cộng sản phẩm hoặc nhận trùng. Nhiệm vụ thưởng một lần; đơn hàng nối tiếp và nâng cấp tạo mục tiêu dài hạn.

HUD nhỏ, kho/shop ở giữa màn hình. Kho có lưới ô và nhóm hạt giống/nông sản. Không mở bảng chăm cây cho các thao tác một chạm. Hình ảnh hiện là khối tạm, có các vị trí thay asset riêng.

Khi thay bố cục cũ, sáu cây cũ của mỗi ruộng giữ nguyên ID; sáu ô bổ sung dùng ID mới. Dữ liệu ruộng vượt quá bốn ruộng từ phiên bản cũ được giữ trong `archivedLand`, không xóa âm thầm.

`/tools/farm-preview/` dùng lưu trong bộ nhớ, không ghi đè tiến trình người chơi.

Cửa hàng chỉ mua giống/phân bón. Nút Nâng cấp riêng mở danh sách bình tưới (tối đa cấp 3) và bốn xưởng với giá/điều kiện cấp. Giếng chỉ lấy nước; bình đầy thì báo đầy, không mở nâng cấp. Bản đồ hiển thị bốn ruộng đúng thứ tự theo vị trí, xem giá mở đất hoặc chọn đi tới giếng/xưởng.

## Quan sát bản đồ

Bấm mặt đất để đi; kéo chuột hoặc một ngón tay trên bản đồ để dịch góc nhìn. Ngưỡng kéo 8px tách khỏi thao tác chạm. Thả sau khi kéo không phát sinh lệnh đi/chăm cây. Góc nhìn được giới hạn trong phạm vi nông trại và khu ruộng xem trước; không bị chặn ở vị trí nhân vật. Nút 🎯 đưa camera về theo nhân vật; di chuyển bằng WASD/joystick cũng trở lại chế độ theo nhân vật. HUD và cửa sổ game không kéo camera.

Bấm ô trống → chọn giống trong số đang có → nhân vật đi tới và trồng đúng ô. Không còn giống thì có nút sang cửa hàng. Chọn giống không trừ hạt ngay; chỉ trừ một hạt khi hoàn tất thao tác trồng hợp lệ.

Tham khảo bố cục ảnh mới: kho, mua giống, thu mua, bản đồ nằm trong thanh gỗ gọn dưới bên phải; nâng cấp và về nhân vật nằm cạnh phải. Góc camera nông trại chéo từ trên cao (offset 10,15,12), giữ cây và nhân vật đủ lớn, có thể kéo để quan sát khu khác. Phần thiên đàng giữ góc nhìn cũ.

Điều chỉnh tỷ lệ: camera gần hơn, bỏ điểm nhìn tự kéo ra giữa cả cụm ruộng; xưởng xếp gọn ở (1/7, -5/-11), nhà ở (-2,3), bỏ hồ trang trí. Giới hạn nền phía phải 11, phía dưới 7; chỉ nới phía ruộng khi mua đất. Không đổi kích thước nhân vật hoặc số ô ruộng.

Bố cục gọn lại: bỏ hẳn nhà không có tương tác và cọc góc ruộng. Nền cỏ liền mạch dưới cả bốn ruộng xem trước; mua đất vẫn mở giới hạn đi lại. Luống đất bo góc thấp, có rãnh canh tác, không dùng viền ván. Dấu cộng vàng không có ô nền trắng, nằm sát tâm mặt luống.

Bố trí khu nước: giếng (-3.4,-11) cạnh phía trên khu ruộng, ao nhỏ (-1.2,-15.3) có bờ và hàng rào bao quanh. Giếng ở ngoài hàng rào, tiếp cận từ phía trước; không phải đi qua ao để lấy nước.

Chọn ô: ưu tiên giao điểm con trỏ với mặt luống và kiểm tra đúng diện tích ô 1.35×1.35. Khe giữa ô không bị hút vào ô gần nhất. Khi chọn biểu tượng/cây, chỉ xét phần đang hiển thị; vòng chọn và dấu hướng dẫn không bắt chuột.

Nút Thế giới được dành riêng cho bản đồ thế giới ở giai đoạn sau và đang khóa. Đã bỏ cửa sổ bản đồ nông trại/danh sách điểm đến cũ. Kéo camera chỉ quan sát nông trại, độc lập với tính năng bản đồ thế giới.

Bố cục tham khảo ảnh mới: ruộng hoạt động phía trái trước, ba ruộng mở rộng phía sau/trái; sân phơi (0,-4) ở giữa cụm chế biến, lò rang (2,-11) phía sau, máy xay bột (7,-8) bên phải sau, xưởng xay xát (6,-2) bên phải trước. Giếng (-3.2,-10) ở đầu lối đi giữa ruộng và xưởng; ao nhỏ lùi phía sau. Nhân vật vào ở khoảng trống phía trước (-3.5,0.3). Các đoạn đường ngắn và nền sân dưới trạm nối khu vực làm việc, không chạy vượt ra ngoài map. Không thêm cây/trang trí rậm vào lối đi.

## Ranh giới thống nhất

Toàn khu dùng chung `FARM_BOUNDS`: x từ -20 đến 11, z từ -19 đến 4. Nền, tìm đường, giới hạn nhân vật và kéo camera dùng cùng phạm vi, không còn nới riêng nền xem trước bên ngoài vùng đi lại. Ruộng, giếng, ao và bốn xưởng đều nằm trong khung này, có khoảng lùi trước hàng rào. Rào bao ngoài chừa cổng trước ở x -4.8 đến -1.8. Ruộng khóa nằm bên trong nông trại nhưng chưa cho bước vào; mua ruộng mở vùng sử dụng đó, giữ nguyên ranh ngoài. Các đường dẫn và công trình không vượt qua rào.

Chọn giống được thay bằng dải icon dưới màn hình, không dùng modal/nền tối hoặc khóa di chuyển. Bấm ô trống viền vuông vàng đúng ô, nhân vật tự đi tới; bấm giống để trồng tại ô đó (nếu còn xa thì đợi tới nơi mới gieo). Đổi ô/hủy sẽ hủy lựa chọn trước mà không mất hạt.

Luồng rút gọn: quả → phơi → rang → xay bột. Bỏ xưởng tách vỏ, cà phê nhân, nhiệm vụ tách vỏ và mục nâng cấp liên quan. Dữ liệu cà phê nhân cũ và nguyên liệu đang nằm trong mẻ tách vỏ chuyển về quả khô để tiếp tục rang, chỉ chuyển một lần khi đọc dữ liệu cũ. Ẩn dòng hướng dẫn bấm/kéo trên màn hình nông trại.

Đã ẩn khung nhiệm vụ ở góc trái, tắt mũi tên chỉ mục tiêu và dòng thông báo hoàn thành nhiệm vụ. Giữ luật thưởng cũ trong dữ liệu. Rào phía trước khép kín, không còn khoảng hở đi ra; vùng tâm nhân vật lùi 1.15 so với mép map để toàn thân luôn ở bên trong hàng rào. Áp dụng chung cho tìm đường, bàn phím và joystick.

Lưới cửa hàng/nâng cấp dùng cột auto-fill: lọc còn một món vẫn giữ bề rộng một ô, không kéo giãn hết khung. Thẻ nâng cấp chỉ giữ tên, cấp hiện tại, thay đổi công suất/thời gian và nút Nâng kèm giá. Điều kiện cấp chỉ hiện khi món đang khóa.

Tên giếng và trạm chế biến đặt sát chân phía trước công trình. Mẻ đang chạy dùng huy hiệu icon với vòng tiến độ tròn cập nhật theo thời gian, không hiện số giây nổi. Xong thì vòng vàng phát sáng/nhấp nhẹ, có dấu tích; bấm huy hiệu để đi tới nhận, không tự cộng sản phẩm.

Bố cục ảnh tham khảo cuối: dịch cụm ruộng về phía trước một đơn vị; giếng (-2.5,-10.5) ở đầu đường phía sau; sân phơi có mái nhẹ (0,-2.5) ở giữa phía trước; lò rang (6,-10.5) và máy xay (6,-3.5) xếp cùng cột bên phải. Các đường lát đá ngắn nối đầu giếng, phía trước ruộng và hai công trình, có đường vòng qua cạnh sân phơi. Huy hiệu tiến độ sân phơi nâng lên trên mái để không bị che. Ao và hàng rào vẫn giữ trong ranh map, không thêm công trình tách vỏ hoặc khung nhiệm vụ.

Mở ruộng bằng nút khóa kèm số tiền trên ruộng, không mở modal. Bấm nút là giao dịch trực tiếp nếu đủ tiền và ruộng liền kề; thiếu điều kiện báo ngắn. Bấm ô đất bên trong ruộng khóa không tự mua hoặc trừ tiền.

Mẻ đang chạy không mở modal: sân phơi tới nửa thời gian hiện icon đảo, bấm để đi tới đảo một lần (rút 5 giây). Xong đổi giỏ nhận sáng vàng, bấm tới nhận. Bắt đầu mẻ mới xong đóng bảng chọn nguyên liệu ngay. Các trạm đang chạy chỉ có huy hiệu trạng thái, không mở bảng trung gian.

Góc nhìn dễ đọc: camera nông trại dùng phép chiếu song song, cây xa không bị thu bé theo chiều sâu. Khung gần hơn (cao 13.6 đơn vị desktop, 15 mobile), điểm bắt đầu sát ruộng đầu, bỏ sương mờ nông trại. Nút +/− và con lăn cho phóng đại trong mức 0.8–1.65; kéo để xem khu khác, nút 🎯 về nhân vật. Tên công trình tăng tương phản/cỡ chữ; huy hiệu cây ghi rõ Tưới/Làm cỏ/Bón phân/Hái khi có thao tác cần làm.

Camera tự theo nhân vật trong mọi cách di chuyển, gồm bấm mặt đất/bấm đối tượng, WASD và joystick. Lệnh di chuyển mới thoát chế độ kéo xem tự do; lúc đi lấy nhân vật làm tâm, không kéo tâm về đối tượng ở xa. Khi đứng yên vẫn kéo map để quan sát được.

## Tìm đường và tiếp cận

A* dùng lưới 0.35 thay cho 0.5; kiểm tra đoạn nối mỗi 0.1 và làm mượt đường chỉ khi đoạn đó không cắt vật cản. Bán kính nhân vật và khoảng cách an toàn dùng chung khi tìm đường/di chuyển. Giếng có ba điểm tiếp cận phía trước, lò rang/máy xay có ba điểm trước cửa, sân phơi có điểm phía trước và hai bên. Thuật toán tìm một điểm có thể đi tới trong nhóm, không ép vào điểm gần nhưng bị kẹt ở phía sau. Đang đi mà bị chặn sẽ tính lại đường tối đa hai lần, không tự đi xuyên qua.

Giếng ở (-2,-10.5); ao lùi sang (0,-15.5), chừa hơn hai đơn vị giữa khu nước và ruộng/giếng. Lối chính đi phía trước giếng, nối ngang tới cửa xưởng; không đi xuyên qua hàng rào ao. Chỉ tới điểm thao tác hợp lệ mới tự kích hoạt lấy nước/chế biến.

Cân đối khoảng trống ruộng: hàng trước dịch từ z=-5 xuống -3.8, hàng sau từ -11 lên -13. Khoảng cách hai hàng ruộng tăng lên 9.2, tạo hành lang giữa rộng 3.8. Đường ngang z=-8.1 chạy xuyên hành lang nối các ruộng tới khu chế biến; đường cạnh ruộng chuyển sang x=-4, không nằm trong phạm vi ruộng khóa. Vị trí ô/biển giá tính từ tâm ruộng nên dịch đồng bộ, không đổi ID hay cây đang trồng.

Giảm khựng khi chọn công trình: camera nông trại không đổi tâm theo trạng thái chọn/đứng/đi; luôn theo nhân vật trừ lúc kéo xem tự do. Chia vật cản vào vùng 2×2, truy vấn đường đi chỉ xét vật cản lân cận với biên an toàn 0.48. Việc quét lưới/chọn nút A* nhường xử lý theo lô nhỏ để giữ ngân sách mỗi khung hình.

Chọn ô dựa trên raycast trực tiếp hình học mặt luống (kể cả góc bo), thay cho ước lượng bằng mặt phẳng/hộp bao. Mục tiêu được giữ theo ID ô xuyên suốt chọn giống, tìm đường và thao tác. Ẩn nút E kèm tên cây/số ruộng khi đứng gần cây; HUD hồ sơ chỉ còn tên/cấp, bỏ avatar và thanh XP.

Giếng chuyển tới cuối hành lang giữa hai hàng ruộng ở (-17.5,-8.4), gần rào trái. Ba điểm lấy nước ở phía phải giếng hướng vào hành lang; không phải chen qua khe giữa giếng và rào. Thanh giống bỏ tiêu đề/khung thẻ sáng, dùng các ô túi hạt nhỏ, tên ngắn, số lượng ở góc và nút đóng tách ở góc phải; nhiều giống cuộn ngang.

## Kho, kéo công cụ và bố cục cuối

Kho dùng ô vuông có số lượng ở góc, chỗ trống và vùng mô tả món đang chọn. Chỉ nông sản có nút bán một món, giống có nút dùng, phân hiển thị số lượng. Bán ngay trong kho dùng cùng giao dịch thu mua, không nhận tiền khi hết hàng.

Kéo túi giống/bình nước từ thanh công cụ qua các ô: raycast mặt đất giữ danh sách ô không lặp, bỏ ô khóa hoặc sai trạng thái. Thả tay mới xếp hàng; nhân vật tới lần lượt để gieo/tưới, chỉ trừ tài nguyên khi hoàn thành. Lệnh di chuyển khác hủy việc chưa làm; ô đang nhắm sáng viền. Không tự mua ruộng khi kéo.

Rào đặt quanh từng ruộng, không quanh từng ô. Rào cách mép ruộng 0.4, có bốn lối mở rộng 2.2; slot asset `farm/field-N/fence` dành cho mẫu/nâng cấp sau. Header tên/cấp có thanh XP trở lại, không có avatar. Nhân vật bắt đầu ngoài vùng rào và được đưa về chỗ đứng hợp lệ gần nhất nếu thay bố cục khiến điểm đứng cũ lọt vật cản.

Hai hàng ruộng ở z=-3.1 và -14.2, tách xa hơn để cân vùng trước/sau. Giếng (-16.8,-8.4) nằm trong hành lang giữa, quay ngang về lối tiếp cận phía phải. Tên công trình là bảng phẳng theo nền/hướng nhà; ẩn toàn bộ nút nhắc E trong farm. Đường cạnh ruộng chuyển sang x=-3.1 để không trùng rào mới.

## Cập nhật mở đất và va chạm rào

Bỏ vùng hình chữ nhật ảo chặn cả ruộng. Va chạm dựa trên rào quanh ruộng và cổng gỗ thật: ruộng chưa mua đóng cả bốn cổng, mở ruộng thì ẩn cổng để đi qua, rào xung quanh giữ va chạm. Tìm đường và di chuyển dùng cùng chỉ mục vật cản/bán kính an toàn.

Bấm ô khóa hoặc biển khóa đều đưa nhân vật tới điểm tiếp cận biển. Tới nơi kiểm tra ruộng liền kề và tiền: thiếu báo số tiền thiếu; đủ mở cửa sổ xác nhận 12 ô và số xu. Chỉ bấm xác nhận mới gọi giao dịch trừ tiền/mở ruộng, có kiểm tra lại số dư. Hủy không mất tiền.

Kéo công cụ giữ camera cố định, chặn kéo mặc định của trình duyệt, bắt pointer xuyên qua vùng UI và lấy lại ô tại vị trí thả. Không dựng lại các nút giống trong lúc kéo để tránh mất pointer capture. Túi hạt dùng hình SVG riêng trong ô thanh đồ, không dùng khung thẻ web.

## Công cụ và phản hồi giao dịch

Nút Công cụ mở/đóng thanh giống, tưới, bón phân, cuốc; mặc định không hiện thanh. Mỗi lần vào nông trại lấy đầy bình theo cấp, sau đó mỗi thao tác tưới trừ một lượt. Cuốc bỏ cây đưa ô về trống, không hoàn hạt hoặc nhận quả. Phân bón tuân theo giai đoạn phát triển và một lần mỗi lứa.

Kéo qua 1–2–3–4 rồi quay về 3 rút lựa chọn còn 1–2–3, không tự thực hiện trước khi thả. Tới giới hạn hạt/nước/phân thì không nhận thêm ô mới, vẫn cho kéo ngược để bớt ô. Ô không hợp lệ hiện dấu cấm; một ô không lặp trong danh sách. Thả về thanh công cụ hoặc hủy cử chỉ thì hủy lựa chọn. Tất cả ô chờ làm giữ sáng viền, mỗi ô chỉ tắt sau khi hoàn thành hoặc bị hủy/không thể tiếp cận. Nhận xu có hiệu ứng bay lên bộ đếm tiền; thu hoạch/nhận thành phẩm bay về kho.

Vốn thử 100.000.000 xu được cấp một lần cho dữ liệu cũ và tiến trình mới, đánh dấu `debugFundsGranted`; tải lại không cộng lại hoặc cắt xuống một triệu. Bộ đếm tiền được lưu tới 1.000.000.000.000, không dùng giới hạn số lượng vật phẩm.

## Chế biến nhiều mẻ và chọn công trình

Mỗi sân phơi/lò/máy xay nhận thêm nhiều lượt khi đủ nguyên liệu, không chặn bởi mẻ đang chạy. Thanh chọn nguyên liệu có Làm 1 và Làm tất cả số mẻ đủ nguyên liệu; nguyên liệu được trừ đúng lúc bắt đầu. Mỗi lượt có giờ bắt đầu/kết thúc riêng, lưu cùng tiến trình; các công trình chạy đồng thời. Nâng cấp rút thời gian mẻ mới, không đổi mẻ đang làm.

Huy hiệu trên trạm dùng icon + thanh tiến độ + giây bên dưới và tổng số mẻ. Huy hiệu ưu tiên mẻ hoàn thành sớm nhất. Chỉ bấm icon giỏ để đi tới nhận tất cả mẻ đã xong tại trạm; mẻ chưa xong tiếp tục chạy. Bấm vào nhà chỉ chọn, sáng viền nền và mở thanh thao tác, không tự nhận/đảo. Icon đảo xử lý các mẻ đủ nửa thời gian và chưa đảo. Nút Hướng dẫn mở nội dung cách chơi dạng chữ trong khung game.
