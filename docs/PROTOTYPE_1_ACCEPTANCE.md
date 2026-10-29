# Prototype 1 – trạng thái nghiệm thu

Ngày: 2026-10-28. Phạm vi mới: phố cổ, quầy hàng ngoài trời, 12 sự cố, barie, cứu thương, chuyển chương, UI và âm thanh tạm. Đã bỏ quán cà phê ông Tám và toàn bộ nội thất/hội thoại của quán khỏi màn 1.

**Cập nhật phạm vi:** đã bỏ sáu kết thúc theo thời gian và mốc ép ngất120 giây; né được thì tiếp tục chơi. Tai nạn vẫn nối cứu thương → trùng sinh. Các lượt test cũ bên dưới không xác nhận thay đổi này hay các đợt art/UI mới.

**Kết luận hiện tại: chưa ký nghiệm thu. Người dùng yêu cầu dừng test tự động và sẽ tự chơi thử.**

## Bằng chứng trước khi dừng

- Lần chạy logic trước các chỉnh sửa cuối: 283/284 bài qua; bài còn lại yêu cầu người được khiêng tiếp tục cách barie ít nhất 3,5 ô, trong khi họ đang được đưa tới xe. Đã giới hạn lại điều kiện này cho giai đoạn chưa khiêng; chưa chạy lại theo yêu cầu.
- Lượt trình duyệt đang chạy đã dừng theo yêu cầu: 14 ca qua, 1 ca bị ngắt, 14 ca chưa chạy. Không coi lượt bị ngắt là đã qua hoặc là lỗi game.
- Kiểm tra UI/âm thanh trước đó xác nhận có tín hiệu Web Audio khi bật và không có tín hiệu khi tắt. Phát hiện menu cài đặt vẫn chạy đồng hồ nguy hiểm phía sau; đã sửa Chương 1 tạm dừng trong menu, chưa chạy lại nghiệm thu đầy đủ.
- Máy không phát hiện Android qua ADB hoặc iPhone/iPad qua CoreDevice. Chưa có bằng chứng thử điện thoại thật.
- Số đo nền trước chỉnh cảnh: ảnh texture RGBA giải nén ước tính khoảng 159,3 MiB, riêng nhà khoảng 47,1 MiB; Chrome trên máy phát triển khoảng 60 FPS trong mẫu 5 giây. Đây không phải bộ nhớ GPU thực đo, không phải hiệu năng điện thoại và không phải số đo sau chỉnh cảnh.

## Các thay đổi cuối đang chờ người dùng xác nhận

1. Một hàng nhà thấp, không có hàng sau chồng lên; hồ chỉ ở phía bờ hồ, không bao quanh thành phố.
2. Xe máy qua barie nhập vào dòng xe, không bị xóa theo thời gian hội thoại; xe đã tông người cũng chạy ra khỏi cảnh.
3. Cú tông ở barie đưa nhân vật về phần đường trước cổng; ngã/khiêng không nâng sprite lên trên tất cả mái nhà và tường.
4. Người đi bằng joystick hoặc nhấp chuột cùng bị chặn bởi vật cản/người khác. Bác sĩ không nối tắt qua góc tường tới điểm cuối không đủ khoảng trống.
5. Người bán được đặt trên nền đi được, cách nhau; không đặt trong quầy/nhà. NPC đứng lại không tiếp tục nhún bước hoặc đổi hướng vì sai số rất nhỏ; lớp vẽ của các nhân vật sát nhau được ổn định.
6. Không còn logic, cửa, biển hiệu, nội thất hoặc hội thoại cà phê ông Tám ở Chương 1.

## Tự chơi thử để quyết định nghiệm thu

- Mở lại trang để nhận mã và texture mới. Thử PC, mobile dọc và ngang; đổi hướng màn hình, kéo bản đồ, giữ rồi thả điều khiển.
- Đi vào tường/ngõ, cây, quầy, xe đỗ và người đứng yên: phải dừng ở rìa, nhấp đi tới thì đi vòng hoặc dừng, không xuyên vào.
- Gây ngã ở hai barie, sân cuối ngõ và sát quầy: người nằm dưới đường; xe đỗ gần, nhìn thấy được; hai bác sĩ tới nơi, khiêng ra xe rồi mới chuyển chương.
- Đứng gần NPC và người bị nạn: không nhấp nháy, lật hướng liên tục hoặc bước tại chỗ khi đã đứng yên.
- Chọn cả hai câu trả lời ở barie và các quầy hàng. Xem xe qua hết đường, không biến mất giữa khung hình; hội thoại không tự chạy lại khi đứng nguyên chỗ.
- Bật/tắt âm thanh, mở cài đặt và tải lại trang. Kiểm tra nghe rõ, chữ/nút dễ đọc, thao tác cảm ứng không bị ghì hoặc tự chạy.
- Gặp lỗi thì ghi vị trí, thao tác, thiết bị/trình duyệt và ảnh. Chỉ đóng mốc sau khi người dùng xác nhận các tình huống quan trọng trên thiết bị thật.
