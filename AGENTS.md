# Quy tắc làm việc

- Mặc định chỉ thực hiện thay đổi theo yêu cầu; người dùng tự kiểm tra.
- Không tự chạy test, build, kiểm tra cú pháp/lint, mở trình duyệt hoặc công cụ preview để kiểm tra kết quả.
- Chỉ kiểm tra khi người dùng yêu cầu rõ ràng. Quyền kiểm tra chỉ áp dụng cho yêu cầu đó; sau khi hoàn thành, tự quay lại mặc định người dùng tự test.
- Được đọc code và tài liệu cần thiết để thực hiện thay đổi. Không hỏi lại quyền kiểm tra khi người dùng không yêu cầu.
- Khi bàn giao, nói rõ phần đã sửa; không khẳng định đã kiểm tra nếu chưa chạy.

## Tài liệu

- Đọc `docs/README.md` (mục lục) và `docs/game-flow.md` (sơ đồ liên kết các màn) trước khi sửa gameplay.
- Mỗi màn có `docs/screens/<NN-màn>/README.md` ghi vào/ra, dữ liệu và code; thư mục khớp `src/features/<màn>/`.
- Luật hiện hành nằm ở `gameplay.md`/`rules.md` của màn; file `*-proposal.md` là đề xuất; `docs/archive/` là lịch sử, không dùng làm đặc tả.
- Đổi trường dữ liệu dùng chung phải sửa `docs/shared/contracts.md` cùng lúc. Đổi luật thì sửa tài liệu của màn trong cùng thay đổi.
- Không commit ảnh chụp màn hình, log hay kết quả test vào repo.

## Thiết kế game

- Đây là game, không phải website/dashboard. Thiết kế giao diện và tương tác theo ngữ cảnh game.
- Ưu tiên thế giới 3D, thao tác trên đối tượng, phản hồi thu hoạch và HUD nhỏ gọn. Không thay gameplay bằng các thẻ thông tin hoặc form web luôn mở.
- Shop, kho và nâng cấp mở bằng modal game giữa màn hình, có nút đóng và khóa di chuyển khi mở.
- Bản đồ, kích thước luống, nhân vật và công trình phải có tỷ lệ cân đối, đường đi rõ và vật cản hợp lý.
- Khối tạm vẫn phải thể hiện chức năng, trạng thái và điểm tương tác để sau này thay asset mà không viết lại luật chơi.

- Chọn giống khi trồng dùng dải icon nhỏ phía dưới, không mở modal hoặc làm tối map. Bấm ô đất phải sáng viền đúng ô đó, nhân vật tới gần; người chơi chọn giống hoặc bấm đổi ô ngay.

- Bấm ô đất/biển khóa đưa nhân vật tới biển trước. Tới nơi chỉ mở xác nhận mua ruộng nếu đủ tiền và liền kề; thiếu tiền báo số xu thiếu. Chỉ trừ tiền khi xác nhận.
