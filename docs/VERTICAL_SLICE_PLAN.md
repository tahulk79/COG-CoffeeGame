# Kế hoạch chốt Vertical Slice — Chương 1

Ngày rà: 2026-10-29. Kế hoạch theo mã đang có trong workspace, gồm thay đổi mới từ Claude; không coi các lỗi ở lần rà cũ là vẫn tồn tại khi chưa đối chiếu lại. Theo dõi trạng thái duy nhất tại [TASK_LIST.md](task-list/TASK_LIST.md), T-099–T-108. Các mục bên dưới là phạm vi và điều kiện bàn giao, không phải bảng trạng thái thứ hai.

## Phạm vi cần đạt

Một chương phố cổ Hà Nội ban ngày, 2.5D isometric bằng sprite/atlas trong Phaser: đi lại, tương tác/hội thoại, phố có sinh hoạt, 12 loại sự cố, ngất → cứu hộ → trùng sinh/chuyển sang chương tiếp. Không cần hoàn thiện gameplay chương 2 để nghiệm thu chương 1; cần bàn giao sang cảnh kế tiếp được.

Giữ các quyết định đã chốt: bỏ hồ và landmark hồ, bỏ quán cà phê ông Tám, sáu kết thúc sống đủ thời gian, bảng mục tiêu, hiệu ứng nhấp nháy nhận diện và kéo map màn 1. Không chuyển engine/3D runtime. Không thay hàng loạt asset trước khi duyệt đoạn mẫu trong game.

## Căn cứ lần rà này

- Đọc code hiện tại: NPC có ghé quầy rồi rời đi, chủ quầy/khách có idle/shuffle, né người giữ hướng; khởi tạo hiện là **8 người đi bộ, 4 xe máy**, khác số cũ. Chưa tự xác nhận mọi tình huống của các hành vi này.
- Cảnh barie hiện dừng nhân vật tại chỗ thay vì tự dẫn ra giữa đường. Hai nhận xét ở lần rà trước cần đối chiếu bản mới; không đưa lại thành lỗi đã xác nhận.
- Cứu hộ có tính thân xe là vật cản, đường vòng của người khiêng và lệch giờ xuống xe của hai bác sĩ. Các số mô phỏng ở readiness §13 là ghi nhận từ lượt khác, không phải lượt này chạy lại.
- 33 atlas runtime WebP khoảng 5,3 MB, master PNG khoảng 48 MB nằm ngoài public. Việc xuất ảnh đã có; hiệu năng thiết bị thật còn cần đo.
- Đã mở bản chạy local, xem khung PC 1280×720, mobile dọc 390×844 và cài đặt PC. Ảnh đầu xem toàn map theo chế độ trình duyệt tự động; lượt sau dùng `story=1&close=1` để xem camera theo người. Giả lập chiều rộng không đồng nghĩa thiết bị cảm ứng thật.
- Quan sát thấy dãy nhà ảnh chi tiết phía trên và dãy quán khối đơn giản phía dưới chưa cùng mức hoàn thiện. Đây là việc cần duyệt mỹ thuật, không mặc định phải bỏ toàn bộ đồ họa vẽ bằng code.
- Lúc rà ban đầu: `story.json` đặt S03.next=S04 nhưng WorldScene dùng CHAPTER1_ONLY=true để đổi về S03 ở trình duyệt thường. T-100 đã gỡ override này; xem ghi nhận triển khai bên dưới.
- Không chạy suite unit/e2e, typecheck hoặc build trong lượt rà. Chưa nghe duyệt âm thanh, chưa chơi đủ 12 sự cố/các góc cứu hộ, chưa đo mạng/RAM hay kiểm tra điện thoại thật. Không kết luận đã nghiệm thu từ FPS overlay trên desktop.

## Cách làm từng phần

Mỗi phần: đối chiếu bản mới → sửa đúng phạm vi → mở game và lưu bằng chứng → bạn tự chơi/duyệt → sửa lỗi phát sinh → cập nhật task. Không chuyển Review thành Done chỉ vì đã viết code. Mọi lần triển khai đều giữ thay đổi khác đang có trong workspace. Không tự chạy lại bộ test khi bạn vẫn giữ yêu cầu tự test.

### 1. Khóa luồng chơi và bản dùng để nghiệm thu — T-100

**Tôi làm:** tách chế độ lặp màn 1 phục vụ phát triển khỏi luồng bàn giao; bỏ phụ thuộc `navigator.webdriver` trong hành vi người chơi; kiểm trạng thái mới/có save/chơi lại, mở menu, quay lại tab và chuyển cảnh. Kiểm lại phạm vi đã bỏ không còn xuất hiện trong màn chơi.

**Bạn duyệt:** mở game như người chơi bình thường, chơi mới rồi quay lại; xác nhận sau cứu hộ phải thấy gì ở đầu chương kế tiếp. Mặc định theo yêu cầu trước là trùng sinh/chuyển chương.

**Xong khi:** trình duyệt thường và bản bàn giao có cùng luồng; một lượt từ bắt đầu tới cứu hộ/chuyển cảnh kết thúc được, không lặp màn 1 ngoài ý muốn, không khóa điều khiển khi quay lại. Có đường chơi lại rõ ràng; không ép ngất bằng thời gian.

### 2. Phố có sinh hoạt và lối đi rõ — T-101

**Tôi làm:** quan sát người đi qua các khu trà đá, ngõ, quầy phía nam và hai barie; phân biệt chủ quầy, khách dừng ngắn, người qua đường. Rà NPC ghé quầy có rời đi được, không chờ nhau vô hạn hoặc xuyên người khi hết timeout. Điều chỉnh mật độ theo số người nhìn thấy trong camera, tốc độ và vị trí xuất hiện; chỉ tăng số NPC sau khi đường đi ổn. Giữ đủ lối cho hero và bác sĩ.

**Bạn duyệt:** đoạn đầu/giữa/cuối phố có cảm giác thành phố đang sống; chủ quầy đứng bán hợp lý, người qua đường không thành tượng hoặc đoàn diễu hành giống nhau. Duyệt một đoạn mẫu trước khi tăng toàn phố.

**Xong khi:** người qua lại hai chiều và ghé/rời quầy; không dồn thành đám đứng lâu, đi xuyên vật cản, giật hướng liên tục hoặc chắn đường bắt buộc. Khi cứu hộ chỉ nhóm gần đó tụ lại, phố xung quanh vẫn có hoạt động. Không lấy một con số NPC cố định làm tiêu chí duy nhất.

### 3. Đồng bộ cảnh, nền ngoài map và camera — T-102

**Tôi làm:** chụp ba khung gần/trung/xa trên PC và mobile; chốt tỉ lệ hero–cửa–quầy–cây–xe, góc chiếu, màu/ánh sáng/bóng. Làm mẫu một đoạn có cả hai bên phố, một quầy, cây và NPC theo art đang dùng, rồi mới mở rộng. Rà đường/vỉa hè/miệng ngõ, dãy quán phía nam, nhà xa, chỗ nối ngoài map, fade khi che người và footprint hình/collider. Chọn từng asset cần sửa sau khi có ảnh mẫu, không mua/tạo thêm cả bộ ngay.

**Bạn duyệt:** ảnh chụp từ game của đoạn mẫu ở PC và mobile; chỉ khi đồng ý mới áp dụng toàn màn. Bối cảnh Việt Nam, vui và rõ; ưu tiên đọc được người/nguy hiểm hơn chi tiết trang trí.

**Xong khi:** hai phía phố cùng chất lượng/phong cách; không mái/vật thừa, mối nối lộ, nền lật gương, nhà đè nhân vật hoặc vùng trống vô nghĩa tại giới hạn camera. Chân nhân vật nằm đúng mặt đất; trên mobile nhận ra hero và nguy hiểm mà không cần thêm điều khiển zoom.

### 4. Nhân vật và cảnh cứu hộ — T-103

**Tôi làm:** xem đi/đứng/đổi hướng/vấp/ngã/nằm/nâng/khiêng/lên xe; chỉnh điểm neo, kích thước và chuyển frame khi cần. Duyệt đường xe từ hai hướng, vào ngõ/đỗ/quay ra, cửa xe, tiếp xúc bác sĩ–hero, portal và nhánh rụng bánh. Dùng lại logic đã sửa, chỉ sửa chỗ còn tái hiện lỗi.

**Bạn duyệt:** cứu hộ ở hai barie, cuối ngõ, sát quầy, sát cây/xe đỗ và vị trí thông thường; thấy xe tới và hiểu bác sĩ đang làm gì.

**Xong khi:** không ngã trên mái/cổng, bác sĩ không mất/đè nhau, không xuyên xe/quầy, không khiêng hụt; xe đỗ đủ gần và camera không bỏ mất hero lúc đón. Mọi vị trí chơi tới được có đường cứu hộ hợp lệ hoặc phương án tiếp cận hợp lý, không nằm chờ vô hạn.

### 5. Duyệt đủ nội dung 12 sự cố — T-104

Danh sách: mèo, chó, hố/nắp cống, sầu riêng, xe máy chở hàng, bồ câu, vỏ chuối, nước, dây phơi, đá cầu, dép và gà. Barie là cảnh riêng, không tính thay một trong 12 loại.

**Tôi làm:** lập bảng tình huống với vị trí, điều kiện mở, cảnh báo, vùng va chạm, nhánh phụ và kết quả; cung cấp cách xem từng loại trong bản phát triển để không phải chờ ngẫu nhiên. Rà việc lưu lịch sử sự cố, lặp nội dung và xung đột nhiều sự cố/cứu hộ. VFX đơn giản, không che UI.

**Bạn duyệt:** từng loại có dễ hiểu, né được và đủ vui; không chỉ xem vài lượt ngẫu nhiên rồi đánh dấu đủ nội dung.

**Xong khi:** cả 12 loại và các nhánh cấu hình có bằng chứng chơi qua; cảnh báo khớp hình và hitbox, vật đã biến mất không còn gây hit, một lần ngất không khởi tạo nhiều cảnh cứu hộ/chuyển chương.

### 6. UI, camera và điều khiển — T-105

**Tôi làm:** rà điện thoại dọc/ngang và PC; thoại dài/nhiều người, lựa chọn quầy, cài đặt, loading, lỗi tải và quay lại game. Kiểm joystick/chạm đi tới/phím, không bấm xuyên UI, kéo ngón không thành lệnh đi ngoài ý muốn, xoay máy giữa hội thoại/cứu hộ; kiểm menu có dừng nguy hiểm đúng chỗ. Tách nút phát triển khỏi giao diện bàn giao.

**Bạn duyệt:** độ dễ đọc và tầm với ngón tay trên điện thoại thật; nhân vật có vừa mắt, quan sát kịp nguy hiểm và bấm lựa chọn thoải mái.

**Xong khi:** không cắt chữ/đè joystick hoặc nút âm thanh/cài đặt; mở/đóng menu không làm tự chạy, lệnh điều khiển không bị giữ khi rời tab. Không tái thêm kéo map, bảng mục tiêu hay blink đã bỏ. Loading không mắc vô hạn; khi lỗi có thông báo và cách thử lại.

### 7. Âm thanh hoàn chỉnh cho một chương — T-106

**Tôi làm:** kiểm kê và cân nhạc/ambience/SFX UI, bước chân/xe/cảnh báo, ngất/cứu hộ/portal; chọn phần tổng hợp có thể giữ và phần cần thay. Ghi nguồn/quyền dùng asset bổ sung. Rà loop, âm lượng chồng, mute được nhớ, audio unlock và rời/quay lại ứng dụng trên mobile. Không bắt buộc voice.

**Bạn duyệt:** nghe bằng loa điện thoại và tai nghe; duyệt cảm giác phố Việt, âm không chói/ồn/lặp khó chịu.

**Xong khi:** toàn luồng có âm đúng nhịp và mức âm dễ chịu; cue nguy hiểm nghe rõ; tắt âm thật sự im lặng và bật lại được, không nhân đôi nhạc sau chơi lại/chuyển cảnh.

### 8. Hiệu năng và gói bàn giao — T-107

**Tôi làm:** kiểm kê WebP/texture thực tải, lỗi console/tải asset và phụ thuộc mạng/font; đo tải lạnh, đi phố, nhiều sự cố, cứu hộ/portal và chơi lại nhiều lượt. Phân biệt FPS canvas/simulation với bộ đếm requestAnimationFrame hiện có; không dùng riêng overlay làm bằng chứng đạt. Xử lý điểm nghẽn đo được, không cắt art/NPC theo phỏng đoán.

**Bạn làm cùng:** chọn ít nhất một Android và một iPhone nếu có, ghi model/OS/trình duyệt, chạy các cảnh giống nhau. Nếu thiếu nền tảng phải ghi rõ giới hạn hỗ trợ khi bàn giao.

**Xong khi:** mục tiêu đề xuất mobile duy trì ≥30 FPS, PC gần 60 FPS trên máy tham chiếu đã ghi; không đứng hình kéo dài/đen màn hình, lỗi tải hoặc bộ nhớ tăng liên tục qua các lượt. Ghi thời gian tải lạnh thực tế với mạng tham chiếu rồi chốt ngưỡng hợp lý; không suy từ 5,3 MB ảnh. Chỉ chạy build/check tự động khi được bạn cho phép lại; bản release cuối vẫn cần xác nhận build được.

### 9. Buổi nghiệm thu và khóa bản — T-108

**Tôi làm:** chuẩn bị checklist một trang, mã phiên bản/commit và danh sách lỗi còn mở. Gộp bằng chứng các phần trước, không buộc chơi lại mọi thứ sau thay đổi không liên quan. Sau mỗi sửa lỗi, rà vùng ảnh hưởng.

**Bạn làm:** một lượt người chơi mới từ đầu tới trùng sinh trên PC và điện thoại dọc/ngang, kèm các lượt theo bảng nội dung/cứu hộ. Xác nhận chất lượng hình/âm/cảm giác điều khiển.

**Xong khi:** không còn lỗi chặn tiến trình, mất điều khiển, xuyên vật cản nghiêm trọng, mất người cứu hộ hoặc chuyển sai chương; đủ bằng chứng nội dung và thiết bị; các lỗi nhẹ được ghi và bạn chấp nhận. Lưu bản đã duyệt để tránh thay đổi tiếp làm mất mốc.

## Thứ tự triển khai và điều kiện dừng mở rộng

Làm **T-100 → T-101 → mẫu T-102 → T-103 → T-104 → T-105 → T-106 → T-107 → T-108**. Nếu lỗi cứu hộ chặn chơi xuất hiện, sửa trước mẫu mỹ thuật. Khi duyệt đoạn mẫu, ghi rõ bộ phận nào được thay; không đổi style toàn game giữa chừng.

Chưa thêm loại sự cố/chương/landmark mới. Không yêu cầu mọi NPC phải luôn đi; chủ quầy, người đang nói chuyện và người xem cứu hộ được đứng có lý do. Mỗi lần làm tiếp chọn một task cụ thể, trả ảnh/bằng chứng cùng phần còn cần bạn tự duyệt.


## Triển khai luồng 1 — 2026-10-29

T-100 đang Review, chưa nghiệm thu toàn bộ Vertical Slice.

- Chơi mới ở URL thường vào S03, không phụ thuộc trình duyệt có tự động hóa hay không. Bỏ `CHAPTER1_ONLY` và `playContent`; mọi bản dùng next từ cấu hình (S03 → S04).
- Tải lại tiếp tục chương/flags đã lưu; không tự xóa tiến trình cốt truyện. Nếu save được ghi lúc chuyển cảnh với chương mới nhưng map cũ, chọn map của chương để tránh kẹt ở màn trước.
- Giữ nút Xem lại cốt truyện: bắt đầu S03 qua luồng travel có sẵn, giữ tiến trình kinh tế/phần thưởng. Các pha tạm như sự cố/đám đông không được serialize; reload giữa màn 1 tạo lượt chạy mới ở checkpoint đã lưu.
- Chuyển scene mang state trong bộ nhớ, tránh đọc lại save cũ nếu storage không ghi được. Vẫn tôn trọng saveBlocked của save phiên bản mới hơn. Không đảm bảo khôi phục qua đóng tab khi trình duyệt từ chối ghi save.
- Game mới vẫn cần bấm xác nhận; chặn autosave/pagehide của session cũ ghi lại slot vừa xóa; mở lại đường dẫn sạch để không kế thừa `map`, `cheat`, `skipStory` của URL phát triển.
- Mất focus/ẩn tab: bỏ joystick, reset phím và ngừng steer để tránh giữ hướng khi quay lại.
- Dev muốn bỏ cốt truyện dùng `?skipStory=1` rõ ràng, không dùng ở production. Các URL vào bộ e2e ngoài cốt truyện đã đổi theo cách này; chưa chạy chúng. `?chapter2=1` không còn cần thiết. `fit/close` vẫn chỉ hỗ trợ camera phát triển, không đổi next/chương.

**Đã quan sát bằng UI local trên cổng riêng 5190:** mở `/` vào màn 1 không có tham số story; thao tác đi phố dẫn tới ngất/cứu hộ và sang cảnh S04; reload `/` vẫn ở S04; chọn Xem lại cốt truyện về màn 1; mở Game mới thấy bước xác nhận. Console không có error tại các lần đọc. Không dùng bot/suite hay gọi debug để ép chuyển chương.

Bằng chứng: [đã sang S04](screenshots/flow1-chapter2.png), [xem lại về S03](screenshots/flow1-replay.png).

**Bạn tự kiểm trước khi đóng T-100:**

1. Mở URL thường không có map/skipStory; đi phố và gặp sự cố, chờ bác sĩ khiêng lên xe rồi vào cảnh trùng sinh. Không quay lại phố tự động.
2. Reload khi đã ở S04: giữ chương và các viên đá đã kích hoạt. Reload giữa màn 1: giữ checkpoint/flags, bắt đầu lại phần sự cố tạm.
3. Xem lại cốt truyện: quay về S03; kiểm tài sản/phần thưởng cũ không bị mất hoặc cấp đôi.
4. Game mới: chỉ xóa sau xác nhận, vào S03 từ đầu; reload không hồi save cũ. Thử cả khi URL cũ có map override. Lượt triển khai chưa bấm xóa save qua UI.
5. Mở/đóng menu, giữ phím/joystick rồi đổi tab/quay lại: không giữ hướng chạy. Cần kiểm trên điện thoại thật.
6. Trường hợp storage bị chặn/ghi lỗi và đóng tab giữa chuyển cảnh chưa được mô phỏng; phần xử lý mới đã rà code, chưa xác nhận runtime. Không đánh dấu các trường hợp này đã qua.

Không chạy unit/e2e/typecheck/build theo yêu cầu tự test; chưa push/commit. Bước tiếp sau khi duyệt T-100 là T-101 (sinh hoạt NPC/lối đi), giữ nguyên art trong lượt này.
