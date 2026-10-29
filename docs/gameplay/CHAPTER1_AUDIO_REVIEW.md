# Luồng7 — âm thanh một chương

2026-10-29. T-106 Review triển khai, chưa được người dùng nghe duyệt. Luồng6 đã được người dùng duyệt.

## Kiểm kê và thay đổi

| Lớp | Nội dung / xử lý |
|---|---|
| Nhạc phố | Giữ loop ngũ cung tổng hợp; gain nhạc0,7→0,32 để nhường cảnh báo. Nhịp vẫn theo tiến độ lượt chơi |
| Tiếng phố | Nền xe gió nhẹ mỗi6,5giây simulation; không giả tiếng hội thoại thu âm |
| Bước chân | Tiếng chạm ngắn khi hero MOVING, cách tối thiểu330ms, dừng khi ngất |
| 12 sự cố | Giữ cue riêng cho mèo/chó/hố/sầu riêng/xe/chim/chuối/nước/dây phơi/cầu/dép/gà; cue đổi pha và ngất. Không thêm tiếng voice |
| Cứu hộ | Còi cao-thấp khi xe di chuyển, cách1,5giây simulation; cue nâng, lên xe, rụng bánh, nổ và mở vòng xoáy theo thay đổi trạng thái |
| UI | Click tổng hợp ngắn ở GameButton, kiểm mute sau hành động; nút tắt âm không phát click sau khi đã tắt |
| Chuyển chương | Giữ bản lề/va chạm/chime hiện có, nối qua master mute, dọn oscillator khi scene shutdown |
| Vườn S04 | Giữ nhạc và tiếng đá; sửa đường ra master/cleanup/catch-up để không chồng âm khi chuyển chương |

Toàn bộ âm là Web Audio synth từ code trong repo: RunAudio, GardenAudio, UiAudio, TransitionScene. Không tải âm bên ngoài, không thêm file nhạc/giọng nói hoặc giấy phép bên thứ ba mới. Âm nền phố hiện mang tính minh họa, chưa phải ghi âm phố Hà Nội thực.

## Sửa vòng đời và mute

Các nguồn trước đây nối thẳng context.destination, bỏ qua master mute của Phaser. Nay toàn bộ đi qua WebAudioSoundManager.destination (masterMuteNode), kể cả tiếng đã lên lịch. Lựa chọn mute dùng lại audioPrefs và khóa v2, không reset lựa chọn cũ.

Bộ lập lịch dừng tạo nốt khi mute, menu mở, context chưa chạy hoặc trang ẩn; nextNote luôn được kéo về thời gian hiện tại, không phát bù hàng phút nốt sau khi quay lại. Nhạc chỉ có một interval/instance. Run dọn interval/nguồn/gain/limiter/listener khi hủy; Garden dọn nguồn/interval/limiter. Ẩn trang cắt nguồn của Run ngay; mở menu hạ gain và ngừng cue. Unlock bằng gesture và xử lý resume thất bại thay vì unhandled rejection. Không tự ép bật âm.

## Cách nghe duyệt

1. Mở bản thường, chạm lần đầu để browser cho phát âm; đi/đứng để nghe bước chân và nền phố.
2. Dùng bộ chọn DEV của luồng5 để nghe từng cảnh báo/ngất. Bấm Bắt đầu; chỉ một cảnh mỗi lượt, không dùng chỉ ảnh để duyệt âm.
3. Cứu hộ: nghe còi khi xe tới, khiêng/lên xe, nhánh bánh/nổ nếu xuất hiện, vòng xoáy và S04. Không có hai loop phố/vườn chạy cùng lúc sau chuyển.
4. Tắt âm bằng nút hoặc M ngay khi có cue dài/chime: phải im lập tức. Reload vẫn tắt; bật lại nghe bình thường, không phát dồn cue đã bỏ qua.
5. Mở menu, ẩn/quay lại tab và khóa/mở màn hình: không dồn nốt, không tự đổi mute. Chơi lại/chuyển chương3lần để nghe có nhân đôi nhạc không.
6. Nghe bằng loa điện thoại và tai nghe: cảnh báo rõ hơn nhạc, còi không chói, ambience không gây mệt. Chỉnh gain theo phản hồi thực tế trước Done.

## Bằng chứng và giới hạn

Đã đọc đường gọi và graph Phaser cài tại repo; git diff --check. Đã mở browser local, M chuyển nhãn Tắt, reload vẫn Tắt, M trở lại Bật; lần đọc console không có error. Đã trả về trạng thái Bật như trước lượt kiểm. [Ảnh trạng thái bật](../screenshots/flow7-sound-on.png); chưa nghe trực tiếp hoặc đo waveform/loudness. Không chạy suite/typecheck/build theo yêu cầu tự test. Chưa nghiệm thu loa điện thoại, tai nghe, iOS audio interruption, độ trễ hoặc toàn cảnh cứu hộ có âm. Không suy từ console/screenshot thành âm đã đúng hay hay; T-106 chờ người dùng nghe duyệt.
