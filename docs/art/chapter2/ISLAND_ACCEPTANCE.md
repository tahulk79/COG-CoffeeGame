# Nghiệm thu web — Đảo Mây / UI ảnh mẫu

Ngày 2026-10-30. T-120 và luồng 8/T-118: **Review**, đã kiểm tra kỹ thuật trên web, chờ duyệt hình ảnh. Người dùng yêu cầu rõ việc ghép, đổi map/camera và test trong lượt này; quyền test/build của lượt này thay hướng dẫn “người dùng tự test” trước đó.

## Cập nhật 2026-10-30 — UI khung thoại, vị trí NPC, hiệu ứng

- Khung thoại làm lại theo ảnh mẫu: avatar tròn viền vàng đè góc, bảng tên trên mép khung, đáp án có số cam và mũi tên; cùng bố cục cho mobile dọc, PC và màn ngang. Khung cao tối thiểu 134px. Đã xem ở 375×812, 800×600, 1280×720, 844×390.
- Luật bấm: thoại thường bấm đâu cũng tiếp; có đáp án thì bấm ngoài làm đáp án nháy. Chi tiết ở CHAPTER_2 §2.5.
- Avatar hero lấy từ ảnh gốc Màn 1 (art-src/slice/chapter2/hero-avatar-v1.png, cắt tròn, xuất webp).
- NPC đặt lại trên ô sàn trống (chấm điểm màu nền): st1 (21.5, 15.5), st2 (34.3, 17.8), st3 (15.5, 16.5), st4 (14.5, 22.5), st5 (14.5, 12.6). Lối đi cầu thang phải còn 3 ô giữa hai lan can; bỏ dải đất lơ lửng phía dưới sân trái. Vị trí sân phải chưa kiểm trên mobile.
- **Bậc cầu thang trước cổng vòm (2026-10-30):** sân kề cổng vòm (bục có hoa văn, ô x13–15, y21–22) cao hơn quảng trường; ranh giới là dãy lan can/đèn ở hàng y=20. Đã chặn các ô (13..16, 20) trong `afterlife.json` nên chỉ lên được bục bằng cầu thang ở ô (16–17, 21), không bước ngang qua lan can. Ông Đồ lần 2 (st4) đứng ở ô (13,24), hero đứng ô (14,24) để mở thoại (`stand` trong `trials.json`, bán kính 0,8); mở các ô (13..15, 23..24) trong `afterlife.json` cho bục này. Mọi NPC (trừ Thần Cà Phê) quay mặt về phía hero (có vùng chết 26px để không nháy), ảnh gốc vẽ hướng phải nên tâm chân được lật theo ảnh.
- **Thuật toán đặt NPC (2026-10-30):** `node scripts/island-npc-layout.mjs [--write]` chấm điểm từng ô đi được bằng màu nền tranh (ô sạch = sàn trống, không đèn/cây/lan can/hoa văn), chọn mỗi trạm trong vùng của nó sao cho xa nhất các NPC khác và điểm xuất phát, đồng thời không đứng trên đường đi của các chặng khác (Dijkstra start → st1 → … → st5 → cửa). Ra bảng toạ độ và khung debug [island-npc-layout-debug.svg](island-npc-layout-debug.svg): xanh = sàn sạch, vàng = bận, đỏ = bị vật cản; elip nét đứt = 2,5 ô thở. `--write` ghi vào `trials.json`. **Cập nhật cùng ngày:** thuật toán tính khoảng cách **trên màn hình** (đảo là isometric nên hai ô cách 3 ô theo đường chéo nằm thẳng chồng nhau, làm bảng tên và bong bóng đè nhau dù "xa" theo ô). Mỗi NPC chiếm một hộp trên màn hình (bảng tên theo độ dài tên, thân, bong bóng phía trên); chọn tổ hợp vét cạn sao cho cặp hộp sát nhau nhất vẫn cách ≥ 1,2 lần bề rộng hộp, không ai nằm trên đường đi của chặng khác. Khung debug vẽ hộp này lên tranh. Sân trái chỉ đủ chỗ cho khoảng cách ≈1,2 lần giữa st1, st3 và st5.
- Thần Chết biến mất có hiệu ứng; ông Đồ trạm 4 hiện muộn. Chưa kiểm màn 320×568. Phần thiết bị thật và âm thanh do người dùng tự test.

## Cập nhật mới nhất — T-122: nhiệm vụ và câu hỏi theo ảnh bổ sung

Phản hồi mới của người dùng làm rõ phạm vi: **giữ Nhiệm vụ chính bên trái và toàn bộ khung hỏi đáp phía dưới**, chỉ bỏ cấp độ, HUD điểm số và menu phụ. Đây là quy cách hiện tại, thay cách diễn giải quá rộng ở T-121.

- Khôi phục nhiệm vụ theo tiến trình hồ sơ → năm trạm → Bà Gác Cửa; có thể chạm nhiệm vụ để đi tới NPC tiếp theo.
- Tab tên màu nâu/vàng dùng phần artwork đã có, portrait bên trái, câu hỏi và ba nút đáp án. Khung nền nine-slice giữ viền khi đổi kích thước; cloud nhỏ ở chân portrait.
- Hai trạm trước đây tự chuyển sau 6 giây, làm mất câu hỏi/đáp án khi chưa kịp đọc. Đổi sang countdown đọc 20 giây; về 0 hiện “Cứ từ từ”, giữ nguyên câu hỏi và đáp án tới khi chọn. Không tự cộng điểm hoặc ghi lời nhắn khi hết giờ.
- Chỉ nút Tiếp/Enter đẩy thoại; bấm nền không vô tình bỏ qua các dòng. Khi đang hỏi, Tiếp/Enter cũng không tự chọn đáp án.
- Thử hồi quy mô phỏng chờ 90 giây, câu hỏi/ba lựa chọn vẫn giữ, chỉ ghi đúng một lời nhắn sau khi chọn. Sáu test và typecheck qua; kiểm UI/ảnh trong thư mục mới bên dưới. Chưa kiểm điện thoại thật.

Đã kiểm trực tiếp trên web 1280×720, 390×844 và 844×390: chạm nhiệm vụ dẫn tới Ông Đồ; mở câu hỏi, chờ về “Cứ từ từ” vẫn còn ba lựa chọn; xoay màn hình giữ nguyên câu; chọn đáp án sau hết giờ vẫn nhận phản hồi và lời nhắn, nhiệm vụ cập nhật sang Bà Thủ Thư Mây. Console không có error/warn trong tab kiểm tra.

Ảnh mới: [PC đối chiếu](../../screenshots/chapter2-question-ui/desktop-reference.jpg), [câu hỏi trạm](../../screenshots/chapter2-question-ui/station-question.jpg), [hết giờ vẫn có đáp án](../../screenshots/chapter2-question-ui/question-after-timer.jpg), [điện thoại ngang](../../screenshots/chapter2-question-ui/phone-landscape.jpg). Ảnh ở T-121/T-120 phía dưới giữ làm lịch sử, không mô tả quy cách UI mới nhất.

## Lịch sử — T-121: UI màn dẫn truyện

Theo phản hồi của người dùng, Màn 2 chỉ giữ **Cài đặt** ngoài phần hội thoại/đáp án. Đã gỡ cụm avatar/thanh cấp độ, điểm Phúc Đức, tiến độ, nhiệm vụ và các nút bản đồ/túi/nhật ký. Điểm và lời nhắn vẫn thuộc dữ liệu câu chuyện, không hiển thị như HUD gameplay. Phần menu/HUD ở báo cáo T-120 bên dưới là lịch sử trước chỉnh sửa này.

Khung thoại chuyển sang nine-slice để giữ viền khi đổi chiều cao; bỏ tab tên có sẵn trong ảnh, tên người nói và nội dung có vị trí thống nhất. Thu cỡ chữ vừa màn nhỏ, giữ đáp án xếp dọc ở điện thoại và một hàng khi đủ rộng. Không phát hiệu ứng thẻ bay vào nút sổ đã gỡ khỏi màn.

Đã xem UI thực tế tại 1440×810, 390×844, 320×568, 844×390; thử đóng/mở Cài đặt trong câu hỏi, không mất câu đang đọc. Console tab kiểm tra không error/warn. Typecheck, 6/6 test và build qua (bundle `index-AvMzLZ-j.js`). Chưa kiểm Android thật.

Ảnh UI mới: [PC](../../screenshots/chapter2-clean-ui/desktop.jpg), [điện thoại dọc](../../screenshots/chapter2-clean-ui/phone-portrait.jpg), [điện thoại nhỏ](../../screenshots/chapter2-clean-ui/phone-small.jpg), [điện thoại ngang](../../screenshots/chapter2-clean-ui/phone-landscape.jpg).

## Kết quả

- Map hành lang 46×9 được thay bằng mask 42×42 cho quảng trường, cầu, bậc thang và sân thư viện trong ảnh. Nền ảnh phẳng được đặt ở hệ toạ độ chung qua `src/data/islandLayout.ts`; vùng ngoài mặt đường không đi được.
- PC rộng dùng camera cố định nhìn đảo; màn dọc và điện thoại theo hero, giới hạn trong nền. Màn siêu rộng được giới hạn zoom để không mất các sân chơi.
- Năm trạm theo thứ tự, gặp NPC theo khoảng cách hai chiều; không còn giới hạn X/rào vô hình của đường thẳng. NPC tiếp theo có dấu !; trạm đã qua có ✓. Cửa chuyển sinh nằm ở đền phía trên; cổng trái là cảnh trí.
- Ghép ảnh nhiệm vụ, phúc đức, tiến độ, hội thoại, nút và menu. “Túi” và “Nhật ký” cùng mở các lời nhắn trong Sổ Phúc Đức hiện có; chưa xây inventory riêng. “Bản đồ” mở toàn cảnh và hướng dẫn.
- Xuất WebP, giữ PNG master. Nền giảm từ khoảng 2.4 MB xuống 396 KB. Chữ và hit area giữ bằng code.
- UI/cue sen/sổ/SAI/chuông/đồng hồ, ánh cửa, nền synth và xử lý pause/reduced motion của luồng 8 được giữ cùng bản tích hợp.

## Đã kiểm tra

| Kiểm tra | Kết quả / phạm vi |
|---|---|
| `npm run typecheck` | Qua sau thay đổi cuối |
| `npm test` | 6/6 qua: 3 seed đi thực sự qua đủ 5 trạm bằng tap/path của simulation, kiểm body clearance mỗi bước, thu 5 lời nhắn, mở cửa và sang S05; camera; hết giờ/không ghi trùng; NPC ở xa/sai thứ tự và biên mây |
| `npm run build` | Qua, bundle `index-DcLw_5RW.js` |
| PC 1440×810 | Xem toàn cảnh, thoại/ba đáp án; chạm đi tới Ông Đồ, hết giờ vẫn lưu một lời nhắn, mở/đóng sổ, đi xuống sân thư viện và mở thoại Bà |
| Điện thoại dọc 390×844 | Xem thoại/ba đáp án, nút có thể bấm, chữ không chồng chân dung; camera theo hero. Đây là viewport web, không phải thiết bị thật |
| Điện thoại ngang 844×390 | Xoay khi hỏi, ba đáp án thành một hàng, footer không tràn khỏi màn |
| Menu | Mở/đóng bản đồ, sổ và cài đặt trong lúc thoại; sửa độ sâu để menu nhận click thay vì đẩy dòng thoại |
| Âm thanh/giảm chuyển động | Công tắc đổi trạng thái UI; thử chế độ giảm chuyển động và khôi phục về tắt, âm thanh khôi phục bật. Chưa nghe/đánh giá chất lượng âm thanh |
| Màn 1 | Smoke check: tải map và UI dùng chung; console không có error/warn trong tab kiểm tra. Chưa chơi lại trọn Màn 1 → 2 |

Các lỗi gặp trong lúc triển khai đã sửa: playerStart dùng số lẻ gây map validation fail; chữ đè tab tên; vòng tiến độ bị vẽ hai lần; menu nằm dưới lớp thoại; đệm alpha làm lệch panel điện thoại; timer rỗng để lại ô nền nhỏ. Các lần thử lỗi ban đầu không được tính là lần nghiệm thu cuối.

## Ảnh thực tế

- [PC](../../screenshots/chapter2-island/desktop.jpg)
- [Điện thoại dọc](../../screenshots/chapter2-island/phone-portrait.jpg)
- [Điện thoại ngang](../../screenshots/chapter2-island/phone-landscape.jpg)
- [Sổ sau một trạm](../../screenshots/chapter2-island/book-desktop.jpg)
- [Cài đặt](../../screenshots/chapter2-island/settings-desktop.jpg)
- [Màn 1 smoke](../../screenshots/chapter2-island/chapter1-smoke.jpg)

## Giới hạn nghiệm thu

Chưa chạy trên Android thật, chưa đo FPS/RAM/thời gian tải, chưa nghe âm thanh, chưa chơi trọn vòng Màn 1 → 2 trên UI. Bộ kiểm tra mô phỏng đi trọn Màn 2; browser kiểm các thao tác và bố cục nêu trên. Phím và joystick vẫn dùng HeroWalk chung, chưa xác minh thao tác bàn phím/touch bằng thiết bị thật trong lượt này.

Nền là một painting, không phải scene 3D hay bộ lớp che cây/lan can độc lập; mask giới hạn đường đi để tránh các vật trang trí. Chưa thêm hiệu ứng che khuất theo từng cành cây. Safe area/notch thật còn cần kiểm trên thiết bị.

Mở thử local: `http://127.0.0.1:5180/?chap=2`. Duyệt bố cục PC/điện thoại trước khi tiếp tục chỉnh art.

