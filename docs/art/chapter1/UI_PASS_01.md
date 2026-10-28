# UI màn 1 — đợt 01 (2026-10-28)

Dùng UI vẽ bằng code và bộ màu kem/nâu/coral hiện có; không thêm PNG, thư viện hoặc hiệu ứng lặp.

## Đã triển khai

- Khung “BẠN TRẢ LỜI” gom hai lựa chọn, chữ 17px, nút cao tối thiểu 48px; câu dài tự xuống dòng và tăng chiều cao.
- Mobile dọc: khung nằm trên vùng joystick (chừa 148px từ đáy safe area). Màn ngang đủ rộng: khung nằm bên phải, dành góc trái cho joystick. Tôn trọng safe area trái/phải/dưới.
- Nền khung chặn bấm xuyên xuống bản đồ; ẩn cả hit area khi không có lựa chọn. Thông báo aside dưới đáy được ẩn khi đang chọn trả lời để tránh đè nhau.
- Khung hội thoại tính lại chiều cao sau khi đổi kích thước/chiều màn hình, thay vì giữ chiều cao từ cách xuống dòng cũ.
- Cài đặt: hàng công tắc/nút cao tối thiểu 48px trước scale; hai cột khi body rộng ít nhất 500px, một cột khi hẹp. Nút đóng modal sáng màu có vùng bấm 44px; header dành đủ chỗ.
- Trên viewport đặc biệt thấp, cài đặt vẫn có fallback thu nhỏ toàn body. Chưa thể cam kết kích thước chạm thực tế trên mọi điện thoại.

## Còn lại và tự duyệt

Chưa chạy game, test, typecheck hoặc build theo yêu cầu người dùng tự thử. Chỉ rà mã nguồn và diff; chưa nghiệm thu UI trên thiết bị thật.

Cần tự xem: mở hội thoại ở tám quầy, câu trả lời dài, xoay dọc/ngang trong lúc đang trả lời, thao tác joystick bên cạnh lựa chọn, nút đóng/âm thanh/ngôn ngữ/chơi lại trong cài đặt. Kiểm tra riêng iPhone có safe area và trình duyệt Android có thanh địa chỉ.

T-082 vẫn Doing: bong bóng thoại trong thế giới ở rìa camera, độ chồng các thoại cứu hộ, loading và chuyển cảnh cần lượt hoàn thiện tiếp. Không thêm lại Mục tiêu, nhấp nháy nhân vật hay sáu kết thúc theo thời gian đã bỏ.
