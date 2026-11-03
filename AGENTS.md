# Quy tắc làm việc

- Mặc định chỉ thực hiện thay đổi theo yêu cầu; người dùng tự kiểm tra.
- Không tự chạy test, build, kiểm tra cú pháp/lint, mở trình duyệt hoặc công cụ preview để kiểm tra kết quả.
- Chỉ kiểm tra khi người dùng yêu cầu rõ ràng. Quyền kiểm tra chỉ áp dụng cho yêu cầu đó; sau khi hoàn thành, tự quay lại mặc định người dùng tự test.
- Được đọc code và tài liệu cần thiết để thực hiện thay đổi. Không hỏi lại quyền kiểm tra khi người dùng không yêu cầu.
- Khi bàn giao, nói rõ phần đã sửa; không khẳng định đã kiểm tra nếu chưa chạy.
- Ngoại lệ: khi người dùng gọi quy trình đội `/game-team`, agent `playtester` được mở dev server và chơi thử trong lượt đó; các agent khác vẫn không tự kiểm tra.

## Thiết kế game

- Đây là game, không phải website/dashboard. Thiết kế giao diện và tương tác theo ngữ cảnh game.
- Ưu tiên thế giới 3D, thao tác trên đối tượng, phản hồi thu hoạch và HUD nhỏ gọn. Không thay gameplay bằng các thẻ thông tin hoặc form web luôn mở.
- Shop, kho và nâng cấp mở bằng modal game giữa màn hình, có nút đóng và khóa di chuyển khi mở.
- Bản đồ, kích thước luống, nhân vật và công trình phải có tỷ lệ cân đối, đường đi rõ và vật cản hợp lý.
- Khối tạm vẫn phải thể hiện chức năng, trạng thái và điểm tương tác để sau này thay asset mà không viết lại luật chơi.

- Chọn giống khi trồng dùng dải icon nhỏ phía dưới, không mở modal hoặc làm tối map. Bấm ô đất phải sáng viền đúng ô đó, nhân vật tới gần; người chơi chọn giống hoặc bấm đổi ô ngay.

- Bấm ô đất/biển khóa đưa nhân vật tới biển trước. Tới nơi chỉ mở xác nhận mua ruộng nếu đủ tiền và liền kề; thiếu tiền báo số xu thiếu. Chỉ trừ tiền khi xác nhận.
