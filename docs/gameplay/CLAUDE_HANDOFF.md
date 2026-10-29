# Bàn giao sửa NPC/cứu hộ — 2026-10-29

## Yêu cầu hiện tại

Hoàn thiện màn 1 để nghiệm thu Vertical Slice: bỏ ô tô đỗ trên vỉa hè, đưa vào giao thông; NPC đi linh hoạt, không xuyên vật/người, không xoay tại chỗ; sự cố ở chỗ thoáng; bong bóng gắn đúng người. Người dùng đã cho phép tự chạy test, typecheck và build. Chưa được yêu cầu push/deploy lượt này. Người dùng chuyển sang Claude vì sắp hết token.

## Giữ nguyên công việc đang có

Working tree có nhiều thay đổi chưa commit của người dùng/Claude/Codex. Đọc git diff trước, không reset/clean hoặc ghi đè hàng loạt. Luồng 1–7 đã được người dùng duyệt trước đó; luồng 8 vẫn Review. Chưa nghiệm thu Android thật.

## Các thay đổi hiện tại

- `incident.json`: bỏ các object car đỗ; `story.json`: cars=2. `StreetService` tạo 2 ô tô hai chiều trên đường, giữ làn, chờ cổng/nhường người và xe; `streetArt` dùng atlas parkedCars cho xe chạy. Đã nhìn thấy xe chạy trong trình duyệt, cần kiểm lại cả hai hướng/nhường đường.
- `StreetService`: NPC giữ đích đi vòng cụm xe máy, bỏ đảo hướng khi gặp vật; khi đường bị người chặn thì đợi ngắn và tìm lại đường. Người bán được đặt ở chỗ có khoảng trống xung quanh. Va chạm kiểm đoạn và khoảng cách người/props.
- `streetPath.ts` mới: A* lưới 1/4 ô, cache nền theo revision, xét props tròn, người, thân xe và kiểm đoạn liên tục. `GameSimulation` dùng helper này. Cần rà hiệu năng và các ca không có đường.
- Cứu hộ: bác sĩ đến điểm xa xuống trước, người cố định gần hiện trường cũng bước tránh; điểm đứng xem tránh cửa xe 1.6 ô; người bị kẹt có thể chọn đích tránh khác. `planRescue` có callback xét đường thực tế với bảo vệ để chọn phía cửa xe đi được.
- `carrySpot` có cache theo vị trí bệnh nhân; bác sĩ đổi phân công hai điểm đỡ khi tổng đường ngắn hơn. **Đội hình khiêng chưa đạt: điều kiện chờ hiện cho khoảng cách tới bệnh nhân 2.5 ô, trong khi test yêu cầu khoảng 1.2–1.3 ô. Cần sửa cách di chuyển nhóm/đội hình thật, không tăng ngưỡng test hay cho xuyên người.**
- Khi ngã sát/trong collider, cứu hộ đưa tọa độ về điểm trống gần đó trước chọn đường; cần rà để không tạo cảm giác dịch chuyển giả.
- `RunService`: điểm sinh sự cố cần clearance .65 ô, tránh props/người; retry sau 400ms nếu không sinh được. Cần kiểm đủ 12 loại/nhánh.
- `speechBubble` tách thẻ và đuôi tam giác: root bám đầu người nói, chỉ thẻ dịch ngang khi sát mép. Không có leader line. `streetArt` chỉ hiện 1 NPC nói, ưu tiên hội thoại/cứu hộ; không kéo lời NPC ngoài camera. Đã nhìn thấy thẻ bám đúng NPC ở desktop, chưa kiểm hết thoại dài/mobile.
- Các sửa trước vẫn phải giữ: reload bắt đầu S03 mới, chuyển S03→S04 trong cùng lượt vẫn hoạt động; cứu thương rời chỗ đón và đi 10 ô mới mở portal 6 ô phía trước; bỏ cột sáng chữ nhật/hạt vuông của portal.

## Kết quả thật, chưa được gọi là xong

- Typecheck và build đã qua trên source hiện tại trước thay đổi thông báo lỗi của test. Build gần nhất `index-ClGnyUck.js`.
- `rescue-corner-regressions.test.ts`: 7/7 qua (1.5,5.5; 1.5,8.5; 12,6.5; 21.5,4.5; 13.5,15.5; 1.5,9.5; 46.5,9.5). Kiểm đủ khiêng và chuyển S04, nhưng không thay thế kiểm khoảng cách đội hình.
- `street-acceptance.test.ts`: bản trước chỉnh ô tô hai chiều đã qua 2/2; cần chạy lại sau thay đổi chiều/làn và spacing mới nhất.
- `street-path.test.ts`: test đi vòng người đứng và xe máy đã qua; cần chạy lại với source cuối.
- Full suite mặc định chạy quá nhiều worker làm test thời gian bị nhiễu. Lượt cuối dùng `npm run test -- --maxWorkers=1 --testTimeout=120000`, **đã dừng theo yêu cầu bàn giao**, không có kết quả toàn suite.
- Trong lượt cuối, `chapter1-playtest.test.ts` có 4 fail / 24 test:
  1. wandering hero luôn đến S04;
  2. rescue giữ đủ thoại/không xuyên props;
  3. fuzz thao tác ngẫu nhiên luôn đến S04;
  4. qua hai cổng, khiêng đến xe rồi mới ẩn người.
- Test quét cứu hộ mọi ô đi được `rescue-routing.test.ts` chưa có kết quả cuối trên source cuối. Trước đó từng kẹt ở mép tây/ngõ; không bỏ test này.
- Vừa bổ sung thông báo lỗi chứa seed/player/rescue trong `chapter1-playtest.test.ts`, chưa chạy lại. Không sửa assertion để làm xanh.
- Log tạm nếu còn: `/tmp/cog-full-tests.log`, `/tmp/cog-corners.log`, `/tmp/cog-route.log`. Các log cũ có thể thuộc phiên bản trung gian, đối chiếu thời gian, không coi là source cuối.
- ZIP/SHA256 và release-manifest hiện **cũ so với source mới**. Đừng dùng chúng để nghiệm thu. Chỉ đóng gói lại sau khi checks đạt; ghi test thật trong manifest.

## Ưu tiên tiếp tục

1. Đọc diff và test, tái hiện 4 fail với chẩn đoán vừa thêm; ưu tiên cơ chế cả nhóm khiêng qua góc hẹp và nhường đường hai chiều. Không giải quyết bằng teleport, xuyên collider hoặc timeout tự biến mất.
2. Chạy lại 7 ca góc + street-path + street-acceptance. Sau đó quét mọi ô đi được và chapter1-playtest (1 worker). Giữ đủ nội dung và chuyển màn.
3. Rà hiệu năng tìm đường: tránh chạy A* lại mỗi frame khi không có đường; cache đúng, không dùng góc thử ngẫu nhiên gây xoay. Kiểm cả NPC thường, khách ghé quầy, bảo vệ, người xem và bác sĩ.
4. Chạy full suite/typecheck/build, chơi bản mới desktop và viewport mobile. Kiểm bong bóng khi người đang đi/sát mép/đổi camera; xe không chắn vỉa hè; portal không có ô vuông; reload từ S04 về S03.
5. Cập nhật TASK_LIST và FLOW8_HANDOFF, tạo lại manifest/ZIP nếu bàn giao gói. Nêu rõ Android thật vẫn chờ người dùng kiểm; không tự đánh dấu nghiệm thu.

Browser IAB và dev/preview đã mở ở 5191/5192 (có thể còn chạy), tab QA đã chuyển about:blank để giảm tải. Người dùng đang dùng Brave, tránh chiếm hoặc đổi tab của họ. Không cần tạo asset mới cho lượt sửa logic này.
